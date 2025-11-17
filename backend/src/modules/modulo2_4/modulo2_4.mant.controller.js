// backend/src/modules/modulo2_4/modulo2_4.mant.controller.js
import { getMaintenanceReport } from "./modulo2_4.mant.model.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const pad2 = n => String(n).padStart(2, "0");
const ymd = d => {
  if (!d) return "na";
  const dt = new Date(d); if (Number.isNaN(dt.getTime())) return "na";
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};

// -------- JSON --------
export async function maintenanceReportCtrl(req, res, next) {
  try {
    const data = await getMaintenanceReport({
      lab_id : req.query.lab_id,
      lab_ids: req.query.lab_ids,
      from   : req.query.from,
      to     : req.query.to,
      tipo   : req.query.tipo,
      group  : req.query.group || "equipo", // 'equipo' | 'lab'
    });
    res.json(data);
  } catch (e) { next(e); }
}

// -------- XLSX --------
export async function maintenanceReportXlsxCtrl(req, res, next) {
  try {
    const q = {
      lab_id : req.query.lab_id,
      lab_ids: req.query.lab_ids,
      from   : req.query.from,
      to     : req.query.to,
      tipo   : req.query.tipo,
      group  : req.query.group || "equipo",
    };
    const data = await getMaintenanceReport(q);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(q.group === "lab" ? "Mant x Lab" : "Mant x Equipo");

    if (q.group === "lab") {
      ws.columns = [
        { header: "Laboratorio",          key: "lab",        width: 32 },
        { header: "Lab ID",               key: "lab_id",     width: 38 },
        { header: "Equipos",              key: "equipos",    width: 10 },
        { header: "Mantenimientos",       key: "mants",      width: 16 },
        { header: "Downtime (h)",         key: "down",       width: 16 },
        { header: "Prom. por mant (h)",   key: "avg",        width: 18 },
        { header: "Desde",                key: "from",       width: 16 },
        { header: "Hasta",                key: "to",         width: 16 },
        { header: "Tipo (filtro)",        key: "tipo",       width: 16 },
      ];
      for (const r of data) {
        ws.addRow({
          lab   : r.lab.nombre,
          lab_id: r.lab.id,
          equipos: r.equipos,
          mants : r.mantenimientos,
          down  : r.downtime_hours,
          avg   : r.avg_downtime_hours,
          from  : new Date(r.period_from),
          to    : new Date(r.period_to),
          tipo  : r.tipo || "",
        });
      }
    } else {
      ws.columns = [
        { header: "Laboratorio",          key: "lab",        width: 28 },
        { header: "Lab ID",               key: "lab_id",     width: 38 },
        { header: "Equipo",               key: "equipo",     width: 36 },
        { header: "Equipo ID",            key: "equipo_id",  width: 38 },
        { header: "Código",               key: "codigo",     width: 16 },
        { header: "Mantenimientos",       key: "mants",      width: 16 },
        { header: "Downtime (h)",         key: "down",       width: 16 },
        { header: "Prom. por mant (h)",   key: "avg",        width: 18 },
        { header: "Primero en rango",     key: "first",      width: 22 },
        { header: "Último en rango",      key: "last",       width: 22 },
        { header: "Desde",                key: "from",       width: 16 },
        { header: "Hasta",                key: "to",         width: 16 },
        { header: "Tipo (filtro)",        key: "tipo",       width: 16 },
      ];
      for (const r of data) {
        ws.addRow({
          lab   : r.lab.nombre,
          lab_id: r.lab.id,
          equipo: r.equipo.nombre,
          equipo_id: r.equipo.id,
          codigo: r.equipo.codigo,
          mants : r.mantenimientos,
          down  : r.downtime_hours,
          avg   : r.avg_downtime_hours,
          first : r.primero_en_rango ? new Date(r.primero_en_rango) : "",
          last  : r.ultimo_en_rango  ? new Date(r.ultimo_en_rango)  : "",
          from  : new Date(r.period_from),
          to    : new Date(r.period_to),
          tipo  : r.tipo || "",
        });
      }
    }

    // Estilos básicos
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.alignment = { horizontal: "center", vertical: "middle" };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };

    const name = `Mant_${(q.lab_id || q.lab_ids || "labs")}_${ymd(q.from)}-a-${ymd(q.to)}_${q.group}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.status(200).end(buf);
  } catch (e) { next(e); }
}

// -------- PDF --------
export async function maintenanceReportPdfCtrl(req, res, next) {
  try {
    const q = {
      lab_id : req.query.lab_id,
      lab_ids: req.query.lab_ids,
      from   : req.query.from,
      to     : req.query.to,
      tipo   : req.query.tipo,
      group  : req.query.group || "equipo",
    };
    const rows = await getMaintenanceReport(q);

    const name = `Mant_${(q.lab_id || q.lab_ids || "labs")}_${ymd(q.from)}-a-${ymd(q.to)}_${q.group}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${name}"`);

    const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: 28, left: 28, right: 28, bottom: 32 } });
    doc.pipe(res);

    const FONT_H = "Helvetica-Bold";
    const FONT_B = "Helvetica";
    const FS_H = 10, FS_C = 9;
    const padX = 6, padY = 4;

    const columnsEquipo = [
      { key: "lab",      label: "Lab",        width: 160, align: "left"   },
      { key: "equipo",   label: "Equipo",     width: 220, align: "left"   },
      { key: "codigo",   label: "Código",     width: 90,  align: "center" },
      { key: "mants",    label: "Mants",      width: 60,  align: "right"  },
      { key: "down",     label: "Down (h)",   width: 80,  align: "right"  },
      { key: "avg",      label: "Prom (h)",   width: 80,  align: "right"  },
      { key: "first",    label: "Primero",    width: 120, align: "center" },
      { key: "last",     label: "Último",     width: 120, align: "center" },
    ];
    const columnsLab = [
      { key: "lab",   label: "Lab",           width: 200, align: "left"   },
      { key: "eqs",   label: "Equipos",       width: 70,  align: "right"  },
      { key: "mants", label: "Mants",         width: 80,  align: "right"  },
      { key: "down",  label: "Down (h)",      width: 100, align: "right"  },
      { key: "avg",   label: "Prom (h)",      width: 100, align: "right"  },
    ];
    const cols = q.group === "lab" ? columnsLab : columnsEquipo;
    const tableX = doc.page.margins.left;
    const tableW = cols.reduce((s, c) => s + c.width, 0);

    const fmtDt = iso => {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const p = n => String(n).padStart(2, "0");
      return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    doc.font(FONT_H).fontSize(13).text("Reporte de Mantenimiento", { align: "left" });
    doc.moveDown(0.2);
    doc.font(FONT_B).fontSize(9)
      .text(`Rango: ${ymd(q.from)} a ${ymd(q.to)}`, { continued: true }).text("   ", { continued: true })
      .text(`Labs: ${q.lab_id || q.lab_ids || "Todos"}`, { continued: true }).text("   ", { continued: true })
      .text(`Agrupar: ${q.group}`, { continued: true }).text("   ", { continued: true })
      .text(`Tipo: ${q.tipo || "Todos"}`);

    // Header
    let y = doc.y + 10;
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
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 8;

    drawHeader();

    const drawRow = (r, i) => {
      let obj;
      if (q.group === "lab") {
        obj = {
          lab : r.lab.nombre,
          eqs : r.equipos,
          mants: r.mantenimientos,
          down: r.downtime_hours.toFixed(2),
          avg : r.avg_downtime_hours.toFixed(2),
        };
      } else {
        obj = {
          lab   : r.lab.nombre,
          equipo: r.equipo.nombre,
          codigo: r.equipo.codigo,
          mants : r.mantenimientos,
          down  : r.downtime_hours.toFixed(2),
          avg   : r.avg_downtime_hours.toFixed(2),
          first : fmtDt(r.primero_en_rango),
          last  : fmtDt(r.ultimo_en_rango),
        };
      }

      const h = Math.max(18, doc.font(FONT_B).fontSize(FS_C)
        .heightOfString(String(obj.lab), { width: cols[0].width - padX * 2 })) + padY * 2;

      if (y + h > bottomLimit()) {
        doc.font(FONT_B).fontSize(8).fillColor("#6B7280")
          .text(`Página ${doc.page.number}`, tableX, bottomLimit() + 8, { width: tableW, align: "right" });
        doc.addPage(); y = doc.y + 8; drawHeader();
      }

      if (i % 2 === 1) doc.save().rect(tableX, y, tableW, h).fill("#FAFBFC").restore();

      let x = tableX;
      cols.forEach(c => {
        doc.font(FONT_B).fontSize(FS_C).fillColor("#000")
          .text(String(obj[c.key] ?? ""), x + padX, y + padY, { width: c.width - padX * 2, align: c.align });
        x += c.width;
      });

      doc.moveTo(tableX, y + h).lineTo(tableX + tableW, y + h).strokeColor("#E5E7EB").lineWidth(0.5).stroke();
      y += h;
    };

    rows.forEach((r, i) => drawRow(r, i));

    doc.font(FONT_B).fontSize(8).fillColor("#6B7280")
      .text(`Generado: ${new Date().toLocaleString()}`, tableX, bottomLimit() + 8, { width: 300, align: "left" })
      .text(`Página ${doc.page.number}`, tableX, bottomLimit() + 8, { width: tableW, align: "right" });

    doc.end();
  } catch (e) { next(e); }
}
