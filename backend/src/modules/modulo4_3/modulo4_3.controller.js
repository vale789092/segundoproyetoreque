import { listLabHistory, listMaintenanceHistory } from "./modulo4_3.model.js";

function mapPg(e, res, next) {
  if (!e?.code) return next(e);
  const m = {
    "23505": [409, "Recurso duplicado"],
    "23503": [400, "Referencia inválida"],
    "23514": [400, "Violación de regla de datos"],
    "22P02": [400, "Dato inválido"],
  };
  const r = m[e.code];
  return r
    ? res.status(r[0]).json({ error: r[1], detail: e.detail || e.constraint || e.message })
    : next(e);
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);
const jstr = (v) => { if (v == null) return ""; try { return typeof v === "string" ? v : JSON.stringify(v); } catch { return String(v); } };
const nowStamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const fmtDate = (d) => new Intl.DateTimeFormat("es-CR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(d));

/* ============ XLSX (bonito) ============ */
async function exportXLSX({ res, filename, title, headers, rows }) {
  const ExcelJS = (await import("exceljs")).default;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Proyecto2 Auditoría";
  wb.created = new Date();

  const ws = wb.addWorksheet("Bitácora", { views: [{ state: "frozen", ySplit: 2 }] });

  // Título (fila 1 combinada)
  const lastCol = String.fromCharCode("A".charCodeAt(0) + headers.length - 1);
  ws.mergeCells(`A1:${lastCol}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } }; // gray-200
  ws.getRow(1).height = 24;

  // Encabezados (fila 2)
  ws.columns = headers.map((h) => ({ header: h.label, key: h.key, width: h.width || 22 }));
  const headerRow = ws.getRow(2);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } }; // gray-800
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });

  // Filas (desde fila 3). Tipamos fecha como Date y hacemos zebra + bordes.
  const detailKeys = new Set(["detalle"]);
  rows.forEach((r) => ws.addRow(r));
  for (let i = 0; i < rows.length; i++) {
    const row = ws.getRow(3 + i);
    // zebra
    const isOdd = i % 2 === 0;
    row.eachCell((cell, colNumber) => {
      if (isOdd) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } }; // gray-100
      }
      // bordes
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

      // alineaciones
      const key = headers[colNumber - 1]?.key;
      if (detailKeys.has(key)) {
        cell.alignment = { vertical: "top", wrapText: true };
      } else if (key === "accion") {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.alignment = { vertical: "top" };
      }
    });
    row.height = 18;
  }

  // Formato de fecha para columna 'creado_en'
  const colIdx = headers.findIndex((h) => h.key === "creado_en");
  if (colIdx >= 0) {
    const excelCol = colIdx + 1;
    ws.getColumn(excelCol).numFmt = "yyyy-mm-dd hh:mm:ss";
  }

  // Auto-filtro
  ws.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: headers.length },
  };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

/* ============ PDF (bonito) ============ */
async function exportPDF({ res, filename, title, headers, rows }) {
  let PDFDocument;
  try { PDFDocument = (await import("pdfkit")).default; }
  catch { return res.status(501).json({ error: "PDF no disponible", detail: "Instala: npm i pdfkit (o usa ?format=xlsx)" }); }

  const margin = 36;
  const doc = new PDFDocument({ size: "A4", margin });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);

  // Título
  doc.fontSize(14).fillColor("#111827").text(title, { align: "center" }).moveDown(0.5);

  // Definir columnas (ancho proporcional a headers.width)
  const totalWidth = doc.page.width - margin * 2;
  const totalUnits = headers.reduce((s, h) => s + (h.width || 20), 0);
  const colWidths = headers.map((h) => Math.max(60, Math.round((totalWidth * (h.width || 20)) / totalUnits)));

  // Header table
  const headerY = doc.y;
  drawRow({ doc, headers, data: headers.map(h => h.label), y: headerY, colWidths, isHeader: true });

  let y = doc.y + 2;
  rows.forEach((row, idx) => {
    const rowData = headers.map(h => {
      if (h.key === "creado_en") return fmtDate(row[h.key]);
      if (h.key === "detalle")   return jstr(row[h.key]);
      return row[h.key] ?? "";
    });

    const neededHeight = measureRowHeight({ doc, texts: rowData, colWidths });
    // Salto de página si no cabe
    if (y + neededHeight > doc.page.height - margin) {
      addFooter(doc);
      doc.addPage();
      // Redibujar encabezado
      const headerY2 = margin;
      doc.y = headerY2;
      drawRow({ doc, headers, data: headers.map(h => h.label), y: headerY2, colWidths, isHeader: true });
      y = doc.y + 2;
    }
    // zebra
    const fill = idx % 2 === 0 ? "#F3F4F6" : "#FFFFFF";
    drawRow({ doc, headers, data: rowData, y, colWidths, fill });
    y = doc.y + 2;
  });

  addFooter(doc);
  doc.end();

  function drawRow({ doc, headers, data, y, colWidths, isHeader = false, fill = null }) {
    const x0 = margin;
    let x = x0;
    const padding = 4;

    const heights = data.map((text, i) => {
      const w = colWidths[i] - padding * 2;
      return measureTextHeight(doc, String(text), w);
    });
    const h = Math.max(...heights, 18);

    if (fill) {
      doc.save().rect(x0, y, colWidths.reduce((a, b) => a + b, 0), h).fill(fill).restore();
    }
    // Borde inferior
    doc.save().moveTo(x0, y + h).lineTo(x0 + colWidths.reduce((a, b) => a + b, 0), y + h).strokeColor("#E5E7EB").lineWidth(0.8).stroke().restore();

    // Texto columnas
    data.forEach((text, i) => {
      const w = colWidths[i];
      const tx = x + padding;
      const tw = w - padding * 2;
      doc.fillColor(isHeader ? "#FFFFFF" : "#111827")
         .font(isHeader ? "Helvetica-Bold" : "Helvetica")
         .fontSize(isHeader ? 10.5 : 9)
         .text(String(text), tx, y + 2, { width: tw, height: h - 4, ellipsis: false });
      x += w;
    });

    // Fondo header
    if (isHeader) {
      doc.save().rect(x0, y, colWidths.reduce((a, b) => a + b, 0), h).fill("#1F2937").restore();
      // Volver a dibujar texto del header por encima del fill
      x = x0;
      data.forEach((text, i) => {
        const w = colWidths[i];
        const tx = x + padding;
        const tw = w - padding * 2;
        doc.fillColor("#FFFFFF")
           .font("Helvetica-Bold")
           .fontSize(10.5)
           .text(String(text), tx, y + 2, { width: tw, height: h - 4 });
        x += w;
      });
    }

    doc.y = y + h;
  }

  function measureTextHeight(doc, text, width) {
    const b = doc.heightOfString(String(text), { width, ellipsis: false });
    return Math.ceil(b) + 6; // padding vertical
  }

  function measureRowHeight({ doc, texts, colWidths }) {
    let h = 0;
    texts.forEach((t, i) => {
      const w = colWidths[i] - 8; // padding*2
      h = Math.max(h, measureTextHeight(doc, String(t), w));
    });
    return Math.max(h, 18);
  }

  function addFooter(doc) {
    const p = `${doc.page.pageNumber}`;
    doc.fontSize(8).fillColor("#6B7280").text(`Generado: ${fmtDate(new Date())}`, margin, doc.page.height - 24, { align: "left" });
    doc.fontSize(8).fillColor("#6B7280").text(`Página ${p}`, margin, doc.page.height - 24, { align: "right" });
  }
}

/* 4.3.1 */

/** GET /api/admin/audit/labs */
export async function getLabAudit(req, res, next) {
  try {
    const {
      laboratorio_id,
      accion,
      desde,
      hasta,
      q,
      limit,
      offset,
    } = req.query || {};

    if (laboratorio_id && !isUuid(String(laboratorio_id))) {
      return res.status(400).json({ error: "laboratorio_id inválido" });
    }

    const out = await listLabHistory({
      laboratorio_id: laboratorio_id ? String(laboratorio_id) : undefined,
      accion,
      desde,
      hasta,
      q,
      limit,
      offset,
    });

    return res.json(out);
  } catch (e) {
    return mapPg(e, res, next);
  }
}

/** GET /api/admin/audit/maintenance */
export async function getMaintenanceAudit(req, res, next) {
  try {
    const {
      laboratorio_id,
      equipo_id,
      mantenimiento_id,
      accion,
      desde,
      hasta,
      q,
      limit,
      offset,
    } = req.query || {};

    if (laboratorio_id && !isUuid(String(laboratorio_id))) {
      return res.status(400).json({ error: "laboratorio_id inválido" });
    }
    if (equipo_id && !isUuid(String(equipo_id))) {
      return res.status(400).json({ error: "equipo_id inválido" });
    }
    if (mantenimiento_id && !isUuid(String(mantenimiento_id))) {
      return res.status(400).json({ error: "mantenimiento_id inválido" });
    }

    const out = await listMaintenanceHistory({
      laboratorio_id: laboratorio_id ? String(laboratorio_id) : undefined,
      equipo_id: equipo_id ? String(equipo_id) : undefined,
      mantenimiento_id: mantenimiento_id ? String(mantenimiento_id) : undefined,
      accion,
      desde,
      hasta,
      q,
      limit,
      offset,
    });

    return res.json(out);
  } catch (e) {
    return mapPg(e, res, next);
  }
}

/* 4.3.1 */


/** ------- LABS EXPORT ------- */
/* ============ Handlers públicos ============ */
export async function exportLabsAudit(req, res, next) {
  try {
    const { laboratorio_id, accion, desde, hasta, q, limit, offset, format = "xlsx" } = req.query || {};
    if (laboratorio_id && !isUuid(String(laboratorio_id))) return res.status(400).json({ error: "laboratorio_id inválido" });

    const data = await listLabHistory({
      laboratorio_id: laboratorio_id ? String(laboratorio_id) : undefined,
      accion, desde, hasta, q, limit, offset
    });

    const headers = [
    { key: "id",                 label: "ID",          width: 30 },
    { key: "laboratorio_nombre", label: "Laboratorio", width: 30 }, // ← cambio
    { key: "usuario_nombre",     label: "Usuario",     width: 22 },
    { key: "usuario_correo",     label: "Correo",      width: 28 },
    { key: "accion",             label: "Acción",      width: 18 },
    { key: "detalle",            label: "Detalle",     width: 60 },
    { key: "creado_en",          label: "Fecha/Hora",  width: 24 },
    ];

    // Para Excel: dejar creado_en como Date; para PDF formateamos adentro
    const rows = data.map(r => ({
    id: r.id,
    laboratorio_nombre: r.laboratorio_nombre || "",   // ← cambio
    usuario_nombre: r.usuario_nombre || "",
    usuario_correo: r.usuario_correo || "",
    accion: r.accion,
    detalle: r.detalle ?? "",
    creado_en: new Date(r.creado_en),
    }));

    const baseName = `audit_labs_${nowStamp()}`;
    const title = "Bitácora de Laboratorios";
    return String(format).toLowerCase() === "pdf"
      ? exportPDF({ res, filename: baseName, title, headers, rows })
      : exportXLSX({ res, filename: baseName, title, headers, rows });
  } catch (e) { return mapPg(e, res, next); }
}

export async function exportMaintenanceAudit(req, res, next) {
  try {
    const { laboratorio_id, equipo_id, mantenimiento_id, accion, desde, hasta, q, limit, offset, format = "xlsx" } = req.query || {};
    if (laboratorio_id && !isUuid(String(laboratorio_id)))     return res.status(400).json({ error: "laboratorio_id inválido" });
    if (equipo_id && !isUuid(String(equipo_id)))               return res.status(400).json({ error: "equipo_id inválido" });
    if (mantenimiento_id && !isUuid(String(mantenimiento_id))) return res.status(400).json({ error: "mantenimiento_id inválido" });

    const data = await listMaintenanceHistory({
      laboratorio_id: laboratorio_id ? String(laboratorio_id) : undefined,
      equipo_id: equipo_id ? String(equipo_id) : undefined,
      mantenimiento_id: mantenimiento_id ? String(mantenimiento_id) : undefined,
      accion, desde, hasta, q, limit, offset
    });

    const headers = [
    { key: "id",                 label: "ID",             width: 30 },
    { key: "laboratorio_nombre", label: "Laboratorio",    width: 26 }, // ← cambio
    { key: "equipo_id",          label: "Equipo",         width: 26 },
    { key: "mantenimiento_id",   label: "Mantenimiento",  width: 26 },
    { key: "usuario_nombre",     label: "Usuario",        width: 20 },
    { key: "usuario_correo",     label: "Correo",         width: 26 },
    { key: "accion",             label: "Acción",         width: 16 },
    { key: "detalle",            label: "Detalle",        width: 60 },
    { key: "creado_en",          label: "Fecha/Hora",     width: 24 },
    ];

    const rows = data.map(r => ({
    id: r.id,
    laboratorio_nombre: r.laboratorio_nombre || "",  // ← cambio
    equipo_id: r.equipo_id || "",
    mantenimiento_id: r.mantenimiento_id || "",
    usuario_nombre: r.usuario_nombre || "",
    usuario_correo: r.usuario_correo || "",
    accion: r.accion,
    detalle: r.detalle ?? "",
    creado_en: new Date(r.creado_en),
    }));
    
    const baseName = `audit_maintenance_${nowStamp()}`;
    const title = "Bitácora de Mantenimientos";
    return String(format).toLowerCase() === "pdf"
      ? exportPDF({ res, filename: baseName, title, headers, rows })
      : exportXLSX({ res, filename: baseName, title, headers, rows });
  } catch (e) { return mapPg(e, res, next); }
}
