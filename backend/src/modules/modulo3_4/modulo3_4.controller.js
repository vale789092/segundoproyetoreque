// backend/src/modules/modulo3_4/modulo3_4.controller.js
import { getMyUsage } from "./modulo3_4.model.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

/** ================= Helpers ================= */
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

const asExcelDate = (iso) => {
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "" : dt; // ExcelJS acepta Date
};

/** =============== Endpoints =============== */

/** GET /history/my-usage */
export async function myUsageCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const { from, to, tipo } = req.query;
    const data = await getMyUsage({ userId, from, to, tipo });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

/** GET /history/my-usage.xlsx */
export async function myUsageXlsxCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const { from, to, tipo = "all" } = req.query;

    const data = await getMyUsage({ userId, from, to, tipo });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Historial");

    // ===== Columnas
    ws.columns = [
      { header: "Solicitud",   key: "solicitud_id", width: 36 },
      { header: "Evento",      key: "tipo_evento",  width: 22 },
      { header: "Fecha/Hora",  key: "ts",           width: 22, style: { numFmt: "dd/mm/yyyy hh:mm" } },
      { header: "Estado",      key: "estado",       width: 16 },
      { header: "Laboratorio", key: "lab",          width: 28 },
      { header: "Recurso",     key: "recurso",      width: 32 },
    ];

    // ===== Filas
    for (const r of data) {
      ws.addRow({
        solicitud_id: r.solicitud_id ?? "",
        tipo_evento : r.tipo_evento  ?? "",
        ts          : asExcelDate(r.ts),
        estado      : r.estado ?? "",
        lab         : r.laboratorio ? `${r.laboratorio.nombre ?? ""} (${r.laboratorio.id ?? ""})` : "",
        recurso     : r.recurso ? `${r.recurso.nombre ?? ""} (${r.recurso.id ?? ""})` : "",
      });
    }

    // ===== Estilo encabezado
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.alignment = { horizontal: "center", vertical: "middle" };
    header.height = 22;
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F4F7" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCDD2D7" } },
        left: { style: "thin", color: { argb: "FFCDD2D7" } },
        bottom: { style: "thin", color: { argb: "FFCDD2D7" } },
        right: { style: "thin", color: { argb: "FFCDD2D7" } },
      };
    });

    // ===== Estilo filas (si hay data)
    if (data.length > 0) {
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.alignment = { vertical: "middle" };
        row.height = 20;

        row.eachCell((cell, colNumber) => {
          if ([1, 2, 3, 4].includes(colNumber)) {
            cell.alignment = { ...cell.alignment, horizontal: "center" };
          }
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          };
        });

        if (rowNumber % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFBFC" } };
          });
        }
      });
    }

    // ===== Auto filter + freeze (seguro)
    const lastCol = ws.columnCount || ws.columns.length || 1;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: lastCol } };
    ws.views = [{ state: "frozen", ySplit: 1 }];

    // ===== Autoajuste ancho
    ws.columns.forEach((col) => {
      let max = col.header ? String(col.header).length : 10;
      col.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value ?? "";
        const len =
          typeof v === "string"
            ? v.length
            : (v?.text?.length ?? (v instanceof Date ? 16 : 10));
        if (len > max) max = len;
      });
      col.width = Math.min(Math.max(max + 2, col.width ?? 10), 60);
    });

    // ===== Nombre legible y streaming directo
    const userLabel = userLabelFromReq(req, userId);
    const fromLbl   = fmtDateYMD(from);
    const toLbl     = fmtDateYMD(to);
    const tipoLbl   = slug(tipo || "all");
    const rowsLbl   = `${data.length}reg`;
    const name      = `LabTEC-HistorialUso_${userLabel}_${fromLbl}-a-${toLbl}_${tipoLbl}_${rowsLbl}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);

    const buffer = await wb.xlsx.writeBuffer();
    return res.status(200).end(buffer);
  } catch (e) {
    next(e);
  }
}

/** GET /history/my-usage.pdf */
export async function myUsagePdfCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const { from, to, tipo = "all" } = req.query;
    const rows = await getMyUsage({ userId, from, to, tipo });

    const userLabel = userLabelFromReq(req, userId);
    const fromLbl   = fmtDateYMD(from);
    const toLbl     = fmtDateYMD(to);
    const tipoLbl   = slug(tipo || "all");
    const name      = `LabTEC-HistorialUso_${userLabel}_${fromLbl}-a-${toLbl}_${tipoLbl}_${rows.length}reg.pdf`;

    // ===== Encabezados y stream al navegador
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${name}"`);

    // ===== PDF
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 32, right: 32, bottom: 36, left: 32 },
    });

    doc.pipe(res);

    // ===== fuentes
    const FONT_H = "Helvetica-Bold";
    const FONT_B = "Helvetica";
    const FS_H   = 10;
    const FS_C   = 9;

    // ===== helpers de texto
    const ZWSP = "\u200B";
    const allowBreaks = (s) =>
      String(s ?? "")
        .replace(/([\-\/_()\\])/g, `${ZWSP}$1`)
        .replace(/([A-Za-z0-9]{16,})/g, (m) => m.replace(/(.{6})/g, `$1${ZWSP}`));

    const fmtTs = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const p = (n) => String(n).padStart(2, "0");
      return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    // ===== preparar datos
    const data = rows.map((r) => ({
      solicitud   : String(r.solicitud_id ?? ""),
      evento      : r.tipo_evento ?? "",
      fecha       : fmtTs(r.ts),
      estado      : r.estado ?? "",
      laboratorio : r.laboratorio
        ? `${r.laboratorio.nombre ?? ""}\n${String(r.laboratorio.id ?? "")}`
        : "",
      recurso     : r.recurso
        ? `${r.recurso.nombre ?? ""}\n${String(r.recurso.id ?? "")}`
        : "",
    }));

    // ===== layout tabla
    const pageW  = doc.page.width;
    const left   = doc.page.margins.left;
    const right  = pageW - doc.page.margins.right;
    const tableX = left;
    const tableW = right - left;

    const cols = [
      { key: "solicitud",   label: "Solicitud",   weight: 1.1, min: 110, max: 150, align: "center" },
      { key: "evento",      label: "Evento",      weight: 0.9, min:  90, max: 120, align: "center" },
      { key: "fecha",       label: "Fecha/Hora",  weight: 1.0, min: 110, max: 140, align: "center" },
      { key: "estado",      label: "Estado",      weight: 0.8, min:  80, max: 110, align: "center" },
      { key: "laboratorio", label: "Laboratorio", weight: 1.6, min: 200, max: 280, align: "left"   },
      { key: "recurso",     label: "Recurso",     weight: 1.6, min: 200, max: 280, align: "left"   },
    ];
    const totalWeight = cols.reduce((s, c) => s + c.weight, 0);
    let widths = cols.map((c) => Math.round((c.weight / totalWeight) * tableW));
    widths = widths.map((w, i) => Math.max(cols[i].min, Math.min(w, cols[i].max)));
    const scale = tableW / widths.reduce((s, w) => s + w, 0);
    widths = widths.map((w) => Math.floor(w * scale));
    cols.forEach((c, i) => (c.width = widths[i]));

    const padX = 6, padY = 4;

    const measureRowHeight = (row) => {
      let hMax = 0;
      cols.forEach((c) => {
        const txt = allowBreaks(row[c.key]);
        const h = doc
          .font(FONT_B)
          .fontSize(FS_C)
          .heightOfString(txt, { width: c.width - padX * 2, align: c.align });
        hMax = Math.max(hMax, h);
      });
      return Math.max(hMax + padY * 2, 18);
    };

    // ===== título + meta
    doc.font(FONT_H).fontSize(13).text("Historial de Uso – LabTEC", tableX, doc.y, { align: "left" });
    doc.moveDown(0.25);
    doc
      .font(FONT_B)
      .fontSize(9)
      .text(`Usuario: ${userLabel}`, { continued: true })
      .text("   ", { continued: true })
      .text(`Rango: ${fromLbl} a ${toLbl}`, { continued: true })
      .text("   ", { continued: true })
      .text(`Tipo: ${tipoLbl}`, { continued: true })
      .text("   ", { continued: true })
      .text(`Registros: ${data.length}`);
    doc.moveDown(0.8);

    // ===== header tabla
    let tableTop = doc.y + 2;

    const drawHeader = () => {
      const h = 20;
      doc.save().rect(tableX, tableTop, tableW, h).fill("#F2F4F7").restore();
      doc
        .moveTo(tableX, tableTop + h)
        .lineTo(tableX + tableW, tableTop + h)
        .strokeColor("#CDD2D7")
        .lineWidth(0.7)
        .stroke();
      doc.font(FONT_H).fontSize(FS_H).fillColor("#000");
      let x = tableX;
      cols.forEach((c) => {
        doc.text(c.label, x + padX, tableTop + 4, { width: c.width - padX * 2, align: "center" });
        x += c.width;
      });
    };

    const drawFooter = () => {
      const oldX = doc.x, oldY = doc.y;
      const bottomY = doc.page.height - doc.page.margins.bottom + 14;
      doc.font(FONT_B).fontSize(8).fillColor("#6B7280");
      doc.text(`Generado: ${new Date().toLocaleString()}`, tableX, bottomY, { width: 300, align: "left" });
      doc.text(`Página ${doc.page.number}`, tableX, bottomY, { width: tableW, align: "right" });
      doc.x = oldX; doc.y = oldY; doc.fillColor("#000");
    };

    drawHeader();
    let currentY = tableTop + 20;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 6;

    // ===== filas + paginación
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rh  = measureRowHeight(row);

      if (currentY + rh > bottomLimit()) {
        drawFooter();
        doc.addPage();
        tableTop = doc.y + 6;
        drawHeader();
        currentY = tableTop + 20;
      }

      if (i % 2 === 1) {
        doc.save().rect(tableX, currentY, tableW, rh).fill("#FAFBFC").restore();
      }

      let x = tableX;
      cols.forEach((c) => {
        const txt = allowBreaks(row[c.key]);
        doc.font(FONT_B).fontSize(FS_C).text(txt, x + padX, currentY + padY, {
          width: c.width - padX * 2,
          align: c.align,
        });
        x += c.width;
      });

      doc
        .moveTo(tableX, currentY + rh)
        .lineTo(tableX + tableW, currentY + rh)
        .strokeColor("#E5E7EB")
        .lineWidth(0.5)
        .stroke();

      currentY += rh;
    }

    drawFooter();
    doc.end();
  } catch (e) {
    next(e);
  }
}
