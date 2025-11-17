// backend/src/modules/modulo2_4/modulo2_4.controller.js
import { getInventoryReport } from "./modulo2_4.model.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

/** ===== Helpers comunes ===== */
const asBool = (v) => v === true || v === "true";
const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => {
  if (!d) return "na";
  const dt = new Date(d); if (Number.isNaN(dt.getTime())) return "na";
  return `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}`;
};
const num = (v, d = 2) => Number(v ?? 0).toFixed(d);

/** ========= JSON ========= */
export async function inventoryReportCtrl(req, res, next) {
  try {
    const data = await getInventoryReport({
      laboratorio_id: req.query.lab_id,
      tipo: req.query.tipo,
      estado_disp: req.query.estado_disp,
      reservable: req.query.reservable !== undefined ? asBool(req.query.reservable) : undefined,
      from: req.query.from,
      to: req.query.to,
      critical_qty: req.query.critical_qty ?? 1,
      critical_pct: req.query.critical_pct ?? 0.2,
    });
    res.json(data);
  } catch (e) { next(e); }
}

/** ========= CSV ========= */
export async function inventoryReportCsvCtrl(req, res, next) {
  try {
    const q = {
      laboratorio_id: req.query.lab_id,
      tipo: req.query.tipo,
      estado_disp: req.query.estado_disp,
      reservable: req.query.reservable !== undefined ? asBool(req.query.reservable) : undefined,
      from: req.query.from,
      to: req.query.to,
      critical_qty: req.query.critical_qty ?? 1,
      critical_pct: req.query.critical_pct ?? 0.2,
    };
    const data = await getInventoryReport(q);

    const esc = (s) => {
      const v = String(s ?? "");
      if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };

    const headers = [
      "Lab", "Lab_ID",
      "Equipo_ID", "Código", "Nombre", "Tipo",
      "Estado_Operativo", "Estado_Disponible",
      "Cant_Total", "Cant_Disponible", "Porc_Disponible",
      "Reservable", "Fecha_Ult_Mant", "Usos_Periodo", "Critico",
      "Periodo_Desde", "Periodo_Hasta"
    ];

    const rows = data.map(r => [
      r.lab_nombre, r.laboratorio_id,
      r.id, r.codigo_inventario, r.nombre, r.tipo,
      r.estado_operativo, r.estado_disp,
      r.cantidad_total, r.cantidad_disponible, num(r.porcentaje_disp, 4),
      r.reservable ? "true" : "false",
      r.fecha_ultimo_mant ? new Date(r.fecha_ultimo_mant).toISOString() : "",
      r.usos_periodo, r.critico ? "true" : "false",
      r.period_from, r.period_to
    ]);

    const csv = [headers.map(esc).join(","), ...rows.map(row => row.map(esc).join(","))].join("\n");

    const name = `Inventario_${q.laboratorio_id || "todos"}_${ymd(q.from)}-a-${ymd(q.to)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.status(200).end(csv, "utf-8");
  } catch (e) { next(e); }
}

/** ========= XLSX ========= */
export async function inventoryReportXlsxCtrl(req, res, next) {
  try {
    const q = {
      laboratorio_id: req.query.lab_id,
      tipo: req.query.tipo,
      estado_disp: req.query.estado_disp,
      reservable: req.query.reservable !== undefined ? asBool(req.query.reservable) : undefined,
      from: req.query.from,
      to: req.query.to,
      critical_qty: req.query.critical_qty ?? 1,
      critical_pct: req.query.critical_pct ?? 0.2,
    };
    const data = await getInventoryReport(q);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Inventario");

    ws.columns = [
      { header: "Lab",              key: "lab",            width: 26 },
      { header: "Lab ID",           key: "lab_id",         width: 38 },
      { header: "Equipo ID",        key: "id",             width: 38 },
      { header: "Código",           key: "codigo",         width: 18 },
      { header: "Nombre",           key: "nombre",         width: 36 },
      { header: "Tipo",             key: "tipo",           width: 14 },
      { header: "Estado Op.",       key: "eop",            width: 16 },
      { header: "Estado Disp.",     key: "edisp",          width: 16 },
      { header: "Total",            key: "total",          width: 10 },
      { header: "Disponible",       key: "disp",           width: 12 },
      { header: "% Disp.",          key: "pct",            width: 10, style: { numFmt: "0.00%" } },
      { header: "Reservable",       key: "reservable",     width: 12 },
      { header: "Últ. Mant.",       key: "ultimo",         width: 20 },
      { header: "Usos (periodo)",   key: "usos",           width: 16 },
      { header: "Crítico",          key: "critico",        width: 10 },
      { header: "Periodo desde",    key: "from",           width: 20 },
      { header: "Periodo hasta",    key: "to",             width: 20 },
    ];

    for (const r of data) {
      ws.addRow({
        lab: r.lab_nombre,
        lab_id: r.laboratorio_id,
        id: r.id,
        codigo: r.codigo_inventario,
        nombre: r.nombre,
        tipo: r.tipo,
        eop: r.estado_operativo,
        edisp: r.estado_disp,
        total: r.cantidad_total,
        disp: r.cantidad_disponible,
        pct: Number(r.porcentaje_disp || 0),
        reservable: r.reservable ? "Sí" : "No",
        ultimo: r.fecha_ultimo_mant ? new Date(r.fecha_ultimo_mant) : "",
        usos: r.usos_periodo,
        critico: r.critico ? "Sí" : "No",
        from: new Date(r.period_from),
        to: new Date(r.period_to),
      });
    }

    // Header style
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.alignment = { horizontal: "center", vertical: "middle" };
    header.height = 22;

    // Alternado y bordes suaves
    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      row.alignment = { vertical: "middle" };
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" }, left: { style: "thin" },
          bottom: { style: "thin" }, right: { style: "thin" },
        };
      });
      if (idx % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFBFC" } };
        });
      }
    });

    // Freeze header + autofilter
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };

    const name = `Inventario_${q.laboratorio_id || "todos"}_${ymd(q.from)}-a-${ymd(q.to)}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.status(200).end(buf);
  } catch (e) { next(e); }
}

/** ========= PDF ========= */
export async function inventoryReportPdfCtrl(req, res, next) {
  try {
    const q = {
      laboratorio_id: req.query.lab_id,
      tipo: req.query.tipo,
      estado_disp: req.query.estado_disp,
      reservable: req.query.reservable !== undefined ? asBool(req.query.reservable) : undefined,
      from: req.query.from,
      to: req.query.to,
      critical_qty: req.query.critical_qty ?? 1,
      critical_pct: req.query.critical_pct ?? 0.2,
    };
    const rows = await getInventoryReport(q);

    const name = `Inventario_${q.laboratorio_id || "todos"}_${ymd(q.from)}-a-${ymd(q.to)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${name}"`);

    const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: 28, left: 28, right: 28, bottom: 32 } });
    doc.on("error", (err) => console.error("PDF error:", err));
    doc.pipe(res);

    const FONT_H = "Helvetica-Bold";
    const FONT_B = "Helvetica";
    const FS_H = 10, FS_C = 9;
    const padX = 6, padY = 4;

    const cols = [
      { key: "lab",    label: "Lab",           width: 160, align: "left"   },
      { key: "codigo", label: "Código",        width: 90,  align: "center" },
      { key: "nombre", label: "Recurso",       width: 220, align: "left"   },
      { key: "tipo",   label: "Tipo",          width: 80,  align: "center" },
      { key: "eop",    label: "E. Op.",        width: 80,  align: "center" },
      { key: "edp",    label: "E. Disp.",      width: 90,  align: "center" },
      { key: "tot",    label: "Tot",           width: 40,  align: "right"  },
      { key: "disp",   label: "Disp",          width: 45,  align: "right"  },
      { key: "pct",    label: "%Disp",         width: 60,  align: "right"  },
      { key: "usos",   label: "Usos",          width: 50,  align: "right"  },
      { key: "crit",   label: "Crítico",       width: 60,  align: "center" },
    ];

    const tableX = doc.page.margins.left;
    const tableW = cols.reduce((s, c) => s + c.width, 0);

    // Título
    doc.font(FONT_H).fontSize(13).text("Reporte de Inventario", { align: "left" });
    doc.moveDown(0.2);
    doc.font(FONT_B).fontSize(9)
      .text(`Rango: ${ymd(q.from)} a ${ymd(q.to)}`, { continued: true }).text("   ", { continued: true })
      .text(`Lab: ${q.laboratorio_id || "Todos"}`, { continued: true }).text("   ", { continued: true })
      .text(`Crítico: ≤${q.critical_qty}u o ≤${Number(q.critical_pct) * 100}%`);
    doc.moveDown(0.6);

    // Header
    let y = doc.y + 2;
    const drawHeader = () => {
      const h = 20;
      doc.save().rect(tableX, y, tableW, h).fill("#F2F4F7").restore();
      doc.moveTo(tableX, y + h).lineTo(tableX + tableW, y + h).strokeColor("#CDD2D7").lineWidth(0.7).stroke();
      doc.font(FONT_H).fontSize(FS_H).fillColor("#000");
      let x = tableX;
      cols.forEach(c => {
        doc.text(c.label, x + padX, y + 4, { width: c.width - padX * 2, align: "center" });
        x += c.width;
      });
      y += h;
    };
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 6;

    drawHeader();

    const drawRow = (r, i) => {
      const c = {
        lab: r.lab_nombre,
        codigo: r.codigo_inventario,
        nombre: r.nombre,
        tipo: r.tipo,
        eop: r.estado_operativo,
        edp: r.estado_disp,
        tot: r.cantidad_total,
        disp: r.cantidad_disponible,
        pct: `${num(Number(r.porcentaje_disp) * 100, 2)}%`,
        usos: r.usos_periodo,
        crit: r.critico ? "Sí" : "No",
      };

      // altura estimada
      const h = Math.max(
        doc.font(FONT_B).fontSize(FS_C).heightOfString(String(c.lab), { width: cols[0].width - padX * 2 }),
        doc.font(FONT_B).fontSize(FS_C).heightOfString(String(c.nombre), { width: cols[2].width - padX * 2 }),
        18
      ) + padY * 2;

      if (y + h > bottomLimit()) {
        // footer simple
        doc.font(FONT_B).fontSize(8).fillColor("#6B7280")
          .text(`Página ${doc.page.number}`, tableX, bottomLimit() + 8, { width: tableW, align: "right" });
        doc.addPage(); y = doc.y + 2; drawHeader();
      }

      if (i % 2 === 1) {
        doc.save().rect(tableX, y, tableW, h).fill("#FAFBFC").restore();
      }

      let x = tableX;
      cols.forEach(col => {
        const val = c[col.key];
        doc.font(FONT_B).fontSize(FS_C).fillColor("#000")
          .text(String(val ?? ""), x + padX, y + padY, { width: col.width - padX * 2, align: col.align });
        x += col.width;
      });

      doc.moveTo(tableX, y + h).lineTo(tableX + tableW, y + h).strokeColor("#E5E7EB").lineWidth(0.5).stroke();
      y += h;
    };

    rows.forEach((r, i) => drawRow(r, i));

    // Footer final
    doc.font(FONT_B).fontSize(8).fillColor("#6B7280")
      .text(`Generado: ${new Date().toLocaleString()}`, tableX, bottomLimit() + 8, { width: 300, align: "left" })
      .text(`Página ${doc.page.number}`, tableX, bottomLimit() + 8, { width: tableW, align: "right" });

    doc.end();
  } catch (e) { next(e); }
}
