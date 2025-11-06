import { listLabHistory, listMaintenanceHistory } from "./modulo4_3.model.js";
// --- imports para guardar en disco ---
import path from "node:path";
import { promises as fs } from "node:fs";
import { createWriteStream } from "node:fs";
import { PassThrough } from "node:stream";

// --- carpeta de export y helper para crearla ---
const EXPORT_DIR = process.env.EXPORT_DIR || "/usr/src/app/exports";
async function ensureDir(dir) {
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}

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

const slug = (s = "") =>
  String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const fmtDateYMD = (d) => {
  if (!d) return "na";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "na";
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};
const userLabelFromReq = (req, fallback) => {
  const u =
    req.user?.name ||
    req.user?.fullName ||
    (req.user?.email ? req.user.email.split("@")[0] : "") ||
    req.user?.username ||
    "";
  return slug(u || fallback || "usuario");
};

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);
const jstr = (v) => { if (v == null) return ""; try { return typeof v === "string" ? v : JSON.stringify(v); } catch { return String(v); } };
const nowStamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const fmtDate = (d) => new Intl.DateTimeFormat("es-CR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(d));

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

/* 4.3.4 */

/* ==================== XLSX (con guardado) ==================== */
async function exportXLSX({ res, filename, title, headers, rows, savePath }) {
  const ExcelJS = (await import("exceljs")).default;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Proyecto2 Auditoría";
  wb.created = new Date();
  const ws = wb.addWorksheet("Bitácora");

  // 1) Definir columnas (esto crea el header en la fila 1)
  ws.columns = headers.map(h => ({ header: h.label, key: h.key, width: h.width || 22 }));

  // 2) Insertar fila de TÍTULO arriba (empuja header a la fila 2)
  ws.spliceRows(1, 0, []); // agrega una fila vacía al inicio
  const lastCol = String.fromCharCode("A".charCodeAt(0) + headers.length - 1);
  ws.mergeCells(`A1:${lastCol}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = title;                       // ← aquí va tu verdadero título
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  ws.getRow(1).height = 24;

  // 3) Estilo del header (ahora está en la fila 2)
  const headerRow = ws.getRow(2);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });

  // 4) Agregar filas de datos (mejorando 'detalle' y fechas)
  const pretty = (v) => (v && typeof v === "object" ? JSON.stringify(v, null, 2) : (v ?? ""));
  const dateColIdx = headers.findIndex(h => h.key === "creado_en"); // para formato
  for (const r of rows) {
    const rowObj = { ...r, detalle: pretty(r.detalle) };
    ws.addRow(rowObj);
  }

  // 5) Zebra + alineaciones (detalle con wrap, acción centrada, fecha derecha)
  for (let i = 0; i < rows.length; i++) {
    const row = ws.getRow(3 + i); // data empieza en fila 3
    const isOdd = i % 2 === 0;
    row.eachCell((cell, colNumber) => {
      if (isOdd) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      const key = headers[colNumber - 1]?.key;
      if (key === "detalle")      cell.alignment = { vertical: "top", wrapText: true };
      else if (key === "accion")  cell.alignment = { vertical: "middle", horizontal: "center" };
      else if (key === "creado_en") cell.alignment = { vertical: "middle", horizontal: "right" };
      else                         cell.alignment = { vertical: "middle" };
    });
    row.height = 20;
  }

  // 6) Formato de fecha (si existe columna)
  if (dateColIdx >= 0) ws.getColumn(dateColIdx + 1).numFmt = "dd/mm/yyyy hh:mm";

  // 7) Auto-ancho de columnas (límite máx. para que no explote)
  ws.columns.forEach((col, idx) => {
    let max = String(col.header ?? "").length;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      const len =
        typeof v === "string" ? v.length :
        (v instanceof Date ? 19 : String(v ?? "").length);
      if (len > max) max = len;
    });
    // Forzar ancho extra en 'detalle'
    const key = headers[idx]?.key;
    const base = key === "detalle" ? Math.max(max + 2, 60) : Math.max(max + 2, 12);
    col.width = Math.min(base, key === "detalle" ? 90 : 50);
  });

  // 8) Filtro + freeze panes (encabezado bloqueado)
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } };
  ws.views = [{ state: "frozen", ySplit: 2 }];

  // 9) Guardar y enviar
  const buffer = await wb.xlsx.writeBuffer();
  await ensureDir(path.dirname(savePath));
  await fs.writeFile(savePath, buffer);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${path.basename(savePath)}"`);
  res.status(200).end(buffer);
}

/* ==================== PDF (con guardado) ==================== */
// PDF robusto con landscape opcional, header correcto y wraps
async function exportPDF({ res, filename, title, headers, rows, savePath, landscape = false }) {
  let PDFDocument;
  try { PDFDocument = (await import("pdfkit")).default; }
  catch { return res.status(501).json({ error: "PDF no disponible", detail: "Instala: npm i pdfkit (o usa ?format=xlsx)" }); }

  await ensureDir(path.dirname(savePath));

  // ---- preparar stream a archivo + respuesta
  const { PassThrough } = await import("node:stream");
  const { createWriteStream } = await import("node:fs");
  const tee = new PassThrough();
  const fileStream = createWriteStream(savePath);

  const doc = new PDFDocument({
    size: "A4",
    layout: landscape ? "landscape" : "portrait",
    margins: { top: 36, right: 36, bottom: 40, left: 36 },
  });

  // headers HTTP
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}.pdf"`);

  // pipe (descarga + guardado)
  tee.pipe(res);
  tee.pipe(fileStream);
  doc.pipe(tee);

  // ---- helpers
  const FONT_H = "Helvetica-Bold";
  const FONT_B = "Helvetica";
  const FS_H   = 10.5;
  const FS_C   = 9;
  const padX   = 6;
  const padY   = 4;

  const pretty = (v) => {
    if (v == null) return "";
    if (typeof v === "object") { try { return JSON.stringify(v, null, 2); } catch { return String(v); } }
    return String(v);
  };
  const fmtTs = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  // normaliza filas (make wrap-friendly)
  const data = rows.map(r => {
    const obj = { ...r };
    obj.detalle   = pretty(obj.detalle);
    obj.creado_en = fmtTs(obj.creado_en);
    return obj;
  });

  // ---- título
  doc.font(FONT_H).fontSize(14).fillColor("#111827").text(title, { align: "center" });
  doc.moveDown(0.6);

  // ---- layout tabla
  const pageW = doc.page.width;
  const innerW = pageW - doc.page.margins.left - doc.page.margins.right;
  const tableX = doc.page.margins.left;

  // tratamos "width" del header como peso y además imponemos mínimos por columna clave
  const totalWeight = headers.reduce((s, h) => s + (h.width || 20), 0);
  const minByKey = {
    id: 120, laboratorio_nombre: 120, equipo_id: 110, mantenimiento_id: 110,
    usuario_nombre: 90, usuario_correo: 140, accion: 80, detalle: 260, creado_en: 120
  };

  let widths = headers.map(h => {
    const weight = (h.width || 20) / totalWeight;
    const w = Math.max(minByKey[h.key] || 70, Math.round(innerW * weight));
    return w;
  });

  // Si sobra/ falta por redondeo, ajusta a la derecha
  const totalW = widths.reduce((a, b) => a + b, 0);
  const delta = innerW - totalW;
  if (Math.abs(delta) >= 1) widths[widths.length - 1] += delta; // corrige el último

  // calcula alto de una fila
  const rowHeight = (cells, isHeader = false) => {
    let h = 0;
    for (let i = 0; i < headers.length; i++) {
      const txt = String(cells[i] ?? "");
      const font = isHeader ? FONT_H : FONT_B;
      const fs   = isHeader ? FS_H : FS_C;
      const hh = doc.font(font).fontSize(fs).heightOfString(txt, { width: widths[i] - padX * 2 });
      h = Math.max(h, hh);
    }
    return Math.max(h + padY * 2, isHeader ? 20 : 18);
  };

  // dibuja una fila
  const drawRow = ({ cells, y, isHeader = false, zebra = false }) => {
    const rowH = rowHeight(cells, isHeader);
    const x0 = tableX;

    // fondo
    if (isHeader) {
      doc.save().rect(x0, y, innerW, rowH).fill("#1F2937").restore();
    } else if (zebra) {
      doc.save().rect(x0, y, innerW, rowH).fill("#F3F4F6").restore();
    }

    // texto
    let x = x0;
    for (let i = 0; i < headers.length; i++) {
      const color = isHeader ? "#FFFFFF" : "#111827";
      const font  = isHeader ? FONT_H : FONT_B;
      const fs    = isHeader ? FS_H : FS_C;
      doc.fillColor(color).font(font).fontSize(fs)
        .text(String(cells[i] ?? ""), x + padX, y + padY, { width: widths[i] - padX * 2 });
      x += widths[i];
    }

    // línea inferior
    doc.save()
       .moveTo(x0, y + rowH)
       .lineTo(x0 + innerW, y + rowH)
       .lineWidth(isHeader ? 0.9 : 0.5)
       .strokeColor(isHeader ? "#0B1220" : "#E5E7EB")
       .stroke()
       .restore();

    return y + rowH;
  };

  // header
  const headerLabels = headers.map(h => h.label);
  let y = drawRow({ cells: headerLabels, y: doc.y, isHeader: true }) + 2;

  // filas + paginación
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
  for (let r = 0; r < data.length; r++) {
    const rowObj = data[r];
    const cells = headers.map(h => rowObj[h.key]);
    const h = rowHeight(cells, false);

    if (y + h > bottomLimit()) {
      // footer simple con número de página
      doc.font(FONT_B).fontSize(8).fillColor("#6B7280")
        .text(`Página ${doc.page.number}`, tableX, bottomLimit() - 10, { width: innerW, align: "right" });
      doc.addPage();
      // re-dibuja header
      y = drawRow({ cells: headerLabels, y: doc.y, isHeader: true }) + 2;
    }

    y = drawRow({ cells, y, zebra: r % 2 === 1 });
  }

  // footer última página
  doc.font(FONT_B).fontSize(8).fillColor("#6B7280")
    .text(`Generado: ${new Date().toLocaleString()}`, tableX, bottomLimit() - 10, { width: innerW/2, align: "left" })
    .text(`Página ${doc.page.number}`, tableX + innerW/2, bottomLimit() - 10, { width: innerW/2, align: "right" });

  doc.end();
}

/* ==================== handlers públicos ==================== */
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
      { key: "laboratorio_nombre", label: "Laboratorio", width: 30 },
      { key: "usuario_nombre",     label: "Usuario",     width: 22 },
      { key: "usuario_correo",     label: "Correo",      width: 28 },
      { key: "accion",             label: "Acción",      width: 18 },
      { key: "detalle",            label: "Detalle",     width: 60 },
      { key: "creado_en",          label: "Fecha/Hora",  width: 24 },
    ];

    const rows = data.map(r => ({
      id: r.id,
      laboratorio_nombre: r.laboratorio_nombre || "",
      usuario_nombre: r.usuario_nombre || "",
      usuario_correo: r.usuario_correo || "",
      accion: r.accion,
      detalle: r.detalle ?? "",
      creado_en: new Date(r.creado_en),
    }));

    // ===== nombre y path de guardado
    const userLabel = userLabelFromReq(req, "admin");
    const fromLbl   = fmtDateYMD(desde);
    const toLbl     = fmtDateYMD(hasta);
    const rowsLbl   = `${rows.length}reg`;
    const baseName  = `LabTEC-AuditLabs_${userLabel}_${fromLbl}-a-${toLbl}_${rowsLbl}`;
    const title     = "Bitácora de Laboratorios";

    await ensureDir(EXPORT_DIR);
    const savePath = path.join(EXPORT_DIR, `${baseName}.${String(format).toLowerCase() === "pdf" ? "pdf" : "xlsx"}`);

    if (String(format).toLowerCase() === "pdf") {
      return exportPDF({ res, filename: baseName, title, headers, rows, savePath });
    }
    return exportXLSX({ res, filename: baseName, title, headers, rows, savePath });
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
      { key: "laboratorio_nombre", label: "Laboratorio",    width: 26 },
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
      laboratorio_nombre: r.laboratorio_nombre || "",
      equipo_id: r.equipo_id || "",
      mantenimiento_id: r.mantenimiento_id || "",
      usuario_nombre: r.usuario_nombre || "",
      usuario_correo: r.usuario_correo || "",
      accion: r.accion,
      detalle: r.detalle ?? "",
      creado_en: new Date(r.creado_en),
    }));

    const userLabel = userLabelFromReq(req, "admin");
    const fromLbl   = fmtDateYMD(desde);
    const toLbl     = fmtDateYMD(hasta);
    const rowsLbl   = `${rows.length}reg`;
    const baseName  = `LabTEC-AuditMaint_${userLabel}_${fromLbl}-a-${toLbl}_${rowsLbl}`;
    const title     = "Bitácora de Mantenimientos";
    await ensureDir(EXPORT_DIR);
    const savePath = path.join(EXPORT_DIR, `${baseName}.${String(format).toLowerCase()==="pdf" ? "pdf" : "xlsx"}`);

    if (String(format).toLowerCase() === "pdf") {
      return exportPDF({ res, filename: baseName, title, headers, rows, savePath, landscape: true }); // ← APaisado
    }
    return exportXLSX({ res, filename: baseName, title, headers, rows, savePath });
  } catch (e) { return mapPg(e, res, next); }
}