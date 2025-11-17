import { getGlobalUsage } from "./modulo4_4.model.js";
import { listInstitutionInventory } from "./modulo4_4.model.js";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createWriteStream } from "node:fs";
import { PassThrough } from "node:stream";

const EXPORT_DIR = process.env.EXPORT_DIR || "/usr/src/app/exports";
async function ensureDir(dir) { try { await fs.mkdir(dir, { recursive: true }); } catch {} }

function mapPg(e, res, next) {
  if (!e?.code) return next(e);
  const m = { "23505":[409,"Recurso duplicado"], "23503":[400,"Referencia inválida"], "23514":[400,"Violación de regla de datos"], "22P02":[400,"Dato inválido"] };
  const r = m[e.code];
  return r ? res.status(r[0]).json({ error: r[1], detail: e.detail || e.constraint || e.message }) : next(e);
}
const slug = (s="") => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-zA-Z0-9-_]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").toLowerCase();
const userLabelFromReq = (req, fb) =>
  slug(req.user?.name || req.user?.fullName || (req.user?.email ? req.user.email.split("@")[0] : "") || fb || "usuario");
const fmtDateYMD = (d) => { if(!d) return "na"; const x=new Date(d); if(Number.isNaN(x)) return "na";
  const p=n=>String(n).padStart(2,"0"); return `${x.getFullYear()}-${p(x.getMonth()+1)}-${p(x.getDate())}`; };
const pretty = (v) => (v && typeof v === "object" ? JSON.stringify(v, null, 2) : (v ?? ""));

/* ============== 4.4.1 — GET JSON ================== */
export async function globalUsageCtrl(req, res, next) {
  try {
    const { from = null, to = null } = req.query || {};
    const data = await getGlobalUsage({ from, to });

    // Sumatorias
    const totals = data.reduce((a, r) => ({
      reservas_total: a.reservas_total + Number(r.reservas_total || 0),
      reservas_creadas: a.reservas_creadas + Number(r.reservas_creadas || 0),
      reservas_aprobadas: a.reservas_aprobadas + Number(r.reservas_aprobadas || 0),
      reservas_rechazadas: a.reservas_rechazadas + Number(r.reservas_rechazadas || 0),
      prestamos: a.prestamos + Number(r.prestamos || 0),
      mant_eventos: a.mant_eventos + Number(r.mant_eventos || 0),
      mant_programados: a.mant_programados + Number(r.mant_programados || 0),
      mant_completados: a.mant_completados + Number(r.mant_completados || 0),
      mant_unicos: a.mant_unicos + Number(r.mant_unicos || 0),
      mant_completados_unicos: a.mant_completados_unicos + Number(r.mant_completados_unicos || 0),
    }), {
      reservas_total:0, reservas_creadas:0, reservas_aprobadas:0, reservas_rechazadas:0,
      prestamos:0, mant_eventos:0, mant_programados:0, mant_completados:0, mant_unicos:0, mant_completados_unicos:0,
    });

    return res.json({ rows: data, totals });
  } catch (e) { return mapPg(e, res, next); }
}

/* ============== XLSX Export ================== */
async function exportXLSX({ res, savePath, title, rows }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Uso Global", { views: [{ state: "frozen", ySplit: 2 }] });

  const headers = [
    { header: "Periodo", key: "periodo", width: 14 },
    { header: "Reservas (creadas)", key: "reservas_creadas", width: 20 },
    { header: "Reservas aprobadas (préstamos)", key: "prestamos", width: 28 },
    { header: "Reservas rechazadas", key: "reservas_rechazadas", width: 22 },
    { header: "Mantenimientos (eventos)", key: "mant_eventos", width: 26 },
    { header: "Manten. programados", key: "mant_programados", width: 22 },
    { header: "Manten. completados", key: "mant_completados", width: 22 },
    { header: "Manten. únicos", key: "mant_unicos", width: 18 },
    { header: "Manten. comp. únicos", key: "mant_completados_unicos", width: 24 },
  ];
  ws.columns = headers;

  // Título en fila 1
  ws.spliceRows(1, 0, []);
  const lastCol = String.fromCharCode("A".charCodeAt(0) + headers.length - 1);
  ws.mergeCells(`A1:${lastCol}1`);
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { bold: true, size: 14 };
  t.alignment = { horizontal: "center", vertical: "middle" };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  ws.getRow(1).height = 24;

  // Estilo header (fila 2)
  const hr = ws.getRow(2);
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  hr.height = 20;
  hr.eachCell(c => { c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FF1F2937" } }; });

  // Filas
  rows.forEach(r => ws.addRow(r));
  // Zebra + centrado numérico
  for (let i = 0; i < rows.length; i++) {
    const row = ws.getRow(3 + i);
    const zebra = i % 2 === 0;
    row.eachCell((cell, col) => {
      if (zebra) cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFF3F4F6" } };
      if (col > 1) cell.alignment = { vertical:"middle", horizontal:"center" };
    });
    row.height = 20;
  }

  // Totales
  const totalsRow = {
    periodo: "TOTAL",
    reservas_creadas: rows.reduce((s,r)=>s+(r.reservas_creadas||0),0),
    prestamos: rows.reduce((s,r)=>s+(r.prestamos||0),0),
    reservas_rechazadas: rows.reduce((s,r)=>s+(r.reservas_rechazadas||0),0),
    mant_eventos: rows.reduce((s,r)=>s+(r.mant_eventos||0),0),
    mant_programados: rows.reduce((s,r)=>s+(r.mant_programados||0),0),
    mant_completados: rows.reduce((s,r)=>s+(r.mant_completados||0),0),
    mant_unicos: rows.reduce((s,r)=>s+(r.mant_unicos||0),0),
    mant_completados_unicos: rows.reduce((s,r)=>s+(r.mant_completados_unicos||0),0),
  };
  const tr = ws.addRow(totalsRow);
  tr.font = { bold: true };
  tr.eachCell((c, col) => { if (col > 1) c.alignment = { vertical:"middle", horizontal:"center" }; });

  // Guardar + enviar
  const buffer = await wb.xlsx.writeBuffer();
  await ensureDir(path.dirname(savePath));
  await fs.writeFile(savePath, buffer);
  res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition",`attachment; filename="${path.basename(savePath)}"`);
  res.status(200).end(buffer);
}

/* ============== PDF Export ================== */
async function exportPDF({ res, savePath, title, rows }) {
  const PDFDocument = (await import("pdfkit")).default;

  await ensureDir(path.dirname(savePath));
  const tee = new PassThrough();
  const fileStream = createWriteStream(savePath);

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 32, right: 32, bottom: 36, left: 32 },
  });
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",`inline; filename="${path.basename(savePath)}"`);

  tee.pipe(res); tee.pipe(fileStream); doc.pipe(tee);

  const headers = [
    { key:"periodo", label:"Periodo", width:90 },
    { key:"reservas_creadas", label:"Reservas (creadas)", width:140 },
    { key:"prestamos", label:"Reservas aprobadas (préstamos)", width:200 },
    { key:"reservas_rechazadas", label:"Reservas rechazadas", width:140 },
    { key:"mant_eventos", label:"Mant. (eventos)", width:120 },
    { key:"mant_programados", label:"Prog.", width:70 },
    { key:"mant_completados", label:"Compl.", width:70 },
    { key:"mant_unicos", label:"Únicos", width:80 },
    { key:"mant_completados_unicos", label:"Compl. únicos", width:120 },
  ];

  const innerW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const totalW = headers.reduce((s,h)=>s+h.width,0);
  const scale = innerW / totalW;
  headers.forEach(h => h.width = Math.floor(h.width * scale));

  const FONT_H="Helvetica-Bold", FONT_B="Helvetica";
  const FS_H=10.5, FS_C=9, padX=6, padY=4;

  doc.font(FONT_H).fontSize(14).text(title,{align:"center"}).moveDown(0.6);

  const drawRow = ({cells,y,isHeader=false,zebra=false})=>{
    const h = Math.max(...cells.map((t,i)=>
      doc.font(isHeader?FONT_H:FONT_B).fontSize(isHeader?FS_H:FS_C)
        .heightOfString(String(t??""),{width:headers[i].width - padX*2})
    )) + padY*2;
    const x0 = doc.page.margins.left, w = innerW;
    if (isHeader) doc.save().rect(x0,y,w,h).fill("#1F2937").restore();
    else if (zebra) doc.save().rect(x0,y,w,h).fill("#F3F4F6").restore();

    let x = x0;
    cells.forEach((t,i)=>{
      doc.fillColor(isHeader?"#fff":"#111").font(isHeader?FONT_H:FONT_B).fontSize(isHeader?FS_H:FS_C)
         .text(String(t??""), x+padX, y+padY, { width: headers[i].width - padX*2, align: i===0?"left":"center" });
      x += headers[i].width;
    });

    doc.moveTo(x0, y+h).lineTo(x0+w, y+h).strokeColor(isHeader?"#0B1220":"#E5E7EB").lineWidth(isHeader?0.9:0.5).stroke();
    return y+h;
  };

  const labels = headers.map(h=>h.label);
  let y = drawRow({cells:labels,y:doc.y,isHeader:true}) + 2;

  rows.forEach((r, idx)=>{
    const cells = headers.map(h=>r[h.key]);
    if (y + 18 > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = drawRow({cells:labels,y:doc.y,isHeader:true}) + 2;
    }
    y = drawRow({cells, y, zebra: idx%2===1});
  });

  doc.end();
}

/* ============== Handlers de export ================== */
export async function globalUsageXlsxCtrl(req, res, next) {
  try {
    const { from = null, to = null } = req.query || {};
    const rows = await getGlobalUsage({ from, to });
    const userLabel = userLabelFromReq(req,"admin");
    const name = `LabTEC-UsoGlobal_${userLabel}_${fmtDateYMD(from)}-a-${fmtDateYMD(to)}_${rows.length}rows.xlsx`;
    const savePath = path.join(EXPORT_DIR, name);
    return exportXLSX({ res, savePath, title: "Reporte de Uso Global (por periodo académico)", rows });
  } catch (e) { return mapPg(e, res, next); }
}

export async function globalUsagePdfCtrl(req, res, next) {
  try {
    const { from = null, to = null } = req.query || {};
    const rows = await getGlobalUsage({ from, to });
    const userLabel = userLabelFromReq(req,"admin");
    const name = `LabTEC-UsoGlobal_${userLabel}_${fmtDateYMD(from)}-a-${fmtDateYMD(to)}_${rows.length}rows.pdf`;
    const savePath = path.join(EXPORT_DIR, name);
    return exportPDF({ res, savePath, title: "Reporte de Uso Global (por periodo académico)", rows });
  } catch (e) { return mapPg(e, res, next); }
}

/* ============== 4.4.2 — JSON ================== */
export async function inventoryInstitutionalCtrl(req, res, next) {
  try {
    const { tipo, estado_operativo, estado_disp, reservable, q } = req.query || {};
    const rows = await listInstitutionInventory({
      tipo, estado_operativo, estado_disp,
      reservable: reservable === undefined ? undefined : reservable === "true",
      q,
    });
    return res.json({ rows, count: rows.length });
  } catch (e) { return mapPg(e, res, next); }
}

/* ============== XLSX ================== */
async function exportXLSX2({ res, title, rows, savePath }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventario", { views: [{ state: "frozen", ySplit: 2 }] });

  const headers = [
    { header: "Laboratorio",       key: "laboratorio_nombre",    width: 26 },
    { header: "Ubicación",         key: "laboratorio_ubicacion", width: 26 },
    { header: "Código Inventario", key: "codigo_inventario",     width: 20 },
    { header: "Recurso",           key: "recurso_nombre",        width: 28 },
    { header: "Tipo",              key: "tipo",                  width: 14 },
    { header: "Estado Operativo",  key: "estado_operativo",      width: 18 },
    { header: "Estado Disp.",      key: "estado_disp",           width: 16 },
    { header: "Cant. (disp/total)",key: "cant_combo",            width: 18 },
    { header: "Reservable",        key: "reservable",            width: 12 },
    { header: "Últ. Mant.",        key: "fecha_ultimo_mant",     width: 18 },
    { header: "Ficha técnica",     key: "ficha_tecnica",         width: 50 },
    { header: "Creado",            key: "created_at",            width: 18 },
    { header: "Actualizado",       key: "updated_at",            width: 18 },
  ];
  ws.columns = headers;

  // insert title row (header shifts to row 2)
  ws.spliceRows(1, 0, []);
  const lastCol = String.fromCharCode("A".charCodeAt(0) + headers.length - 1);
  ws.mergeCells(`A1:${lastCol}1`);
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { bold: true, size: 14 };
  t.alignment = { horizontal: "center", vertical: "middle" };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  ws.getRow(1).height = 24;

  // header style row 2
  const hr = ws.getRow(2);
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  hr.height = 20;
  hr.eachCell(c => c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FF1F2937" } });

  // rows
  for (const r of rows) {
    ws.addRow({
      ...r,
      cant_combo: `${r.cantidad_disponible ?? 0}/${r.cantidad_total ?? 0}`,
      ficha_tecnica: pretty(r.ficha_tecnica),
    });
  }

  // zebra + cell alignments
  for (let i = 0; i < rows.length; i++) {
    const row = ws.getRow(3 + i);
    const zebra = i % 2 === 0;
    row.eachCell((cell, col) => {
      if (zebra) cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFF3F4F6" } };
      const key = headers[col - 1]?.key;
      if (["cant_combo","reservable","tipo","estado_disp","estado_operativo"].includes(key)) {
        cell.alignment = { vertical:"middle", horizontal:"center" };
      } else if (key === "ficha_tecnica") {
        cell.alignment = { vertical:"top", wrapText: true };
      } else {
        cell.alignment = { vertical:"middle" };
      }
    });
    row.height = 20;
  }

  // format dates
  ["Últ. Mant.", "Creado", "Actualizado"].forEach((label) => {
    const idx = headers.findIndex(h => h.header === label);
    if (idx >= 0) ws.getColumn(idx + 1).numFmt = "dd/mm/yyyy hh:mm";
  });

  const buffer = await wb.xlsx.writeBuffer();
  await ensureDir(path.dirname(savePath));
  await fs.writeFile(savePath, buffer);

  res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition",`attachment; filename="${path.basename(savePath)}"`);
  res.status(200).end(buffer);
}

/* ============== PDF ================== */
async function exportPDF2({ res, title, rows, savePath }) {
  const PDFDocument = (await import("pdfkit")).default;

  await ensureDir(path.dirname(savePath));
  const tee = new PassThrough();
  const fileStream = createWriteStream(savePath);

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 32, right: 32, bottom: 36, left: 32 },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${path.basename(savePath)}"`);

  tee.pipe(res); tee.pipe(fileStream); doc.pipe(tee);

  const headers = [
    { key:"laboratorio_nombre",    label:"Laboratorio",        width: 130 },
    { key:"laboratorio_ubicacion", label:"Ubicación",          width: 130 },
    { key:"codigo_inventario",     label:"Código",             width: 80  },
    { key:"recurso_nombre",        label:"Recurso",            width: 160 },
    { key:"tipo",                  label:"Tipo",               width: 80  },
    { key:"estado_operativo",      label:"Estado Operativo",   width: 110 },
    { key:"estado_disp",           label:"Estado Disp.",       width: 100 },
    { key:"cant_combo",            label:"Disp/Total",         width: 80  },
    { key:"reservable",            label:"Reservable",         width: 80  },
    { key:"fecha_ultimo_mant",     label:"Últ. Mant.",         width: 110 },
    { key:"ficha_tecnica",         label:"Ficha técnica",      width: 240 },
  ];

  // scale to page
  const innerW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const totalW = headers.reduce((s,h)=>s+h.width,0);
  const scale  = innerW / totalW;
  headers.forEach(h => h.width = Math.floor(h.width * scale));

  const FONT_H="Helvetica-Bold", FONT_B="Helvetica";
  const FS_H=10.5, FS_C=9, padX=6, padY=4;

  doc.font(FONT_H).fontSize(14).text(title, { align: "center" }).moveDown(0.6);

  const drawRow = ({cells,y,isHeader=false,zebra=false})=>{
    const h = Math.max(...cells.map((t,i)=>
      doc.font(isHeader?FONT_H:FONT_B).fontSize(isHeader?FS_H:FS_C)
         .heightOfString(String(t??""), { width: headers[i].width - padX*2 })
    )) + padY*2;

    const x0 = doc.page.margins.left;
    if (isHeader) doc.save().rect(x0,y,innerW,h).fill("#1F2937").restore();
    else if (zebra) doc.save().rect(x0,y,innerW,h).fill("#F3F4F6").restore();

    let x = x0;
    cells.forEach((t,i)=>{
      const align = ["cant_combo","reservable","tipo","estado_disp","estado_operativo"].includes(headers[i].key)
        ? "center" : "left";
      doc.fillColor(isHeader?"#fff":"#111").font(isHeader?FONT_H:FONT_B).fontSize(isHeader?FS_H:FS_C)
        .text(String(t??""), x+padX, y+padY, { width: headers[i].width - padX*2, align });
      x += headers[i].width;
    });

    doc.moveTo(x0, y+h).lineTo(x0+innerW, y+h).strokeColor(isHeader?"#0B1220":"#E5E7EB").lineWidth(isHeader?0.9:0.5).stroke();
    return y+h;
  };

  const labels = headers.map(h=>h.label);
  let y = drawRow({ cells: labels, y: doc.y, isHeader: true }) + 2;

  const fmt = (d) => {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return "";
    const p=n=>String(n).padStart(2,"0");
    return `${p(x.getDate())}/${p(x.getMonth()+1)}/${x.getFullYear()} ${p(x.getHours())}:${p(x.getMinutes())}`;
  };

  rows.forEach((r, idx) => {
    const cells = headers.map(h => {
      if (h.key === "cant_combo") return `${r.cantidad_disponible ?? 0}/${r.cantidad_total ?? 0}`;
      if (h.key === "ficha_tecnica") return pretty(r.ficha_tecnica);
      if (h.key === "fecha_ultimo_mant") return fmt(r.fecha_ultimo_mant);
      return r[h.key];
    });

    // salto de página
    if (y + 20 > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = drawRow({ cells: labels, y: doc.y, isHeader: true }) + 2;
    }
    y = drawRow({ cells, y, zebra: idx % 2 === 1 });
  });

  doc.end();
}

/* ============== Handlers export ================== */
export async function inventoryInstitutionalXlsxCtrl(req, res, next) {
  try {
    const { tipo, estado_operativo, estado_disp, reservable, q } = req.query || {};
    const rows = await listInstitutionInventory({
      tipo, estado_operativo, estado_disp,
      reservable: reservable === undefined ? undefined : reservable === "true",
      q,
    });

    const userLabel = userLabelFromReq(req, "admin");
    const name = `LabTEC-Inventario_${userLabel}_${rows.length}items.xlsx`;
    const savePath = path.join(EXPORT_DIR, name);
    return exportXLSX2({ res, title: "Inventario Institucional — Estado y Ubicación", rows, savePath });
  } catch (e) { return mapPg(e, res, next); }
}

export async function inventoryInstitutionalPdfCtrl(req, res, next) {
  try {
    const { tipo, estado_operativo, estado_disp, reservable, q } = req.query || {};
    const rows = await listInstitutionInventory({
      tipo, estado_operativo, estado_disp,
      reservable: reservable === undefined ? undefined : reservable === "true",
      q,
    });

    const userLabel = userLabelFromReq(req, "admin");
    const name = `LabTEC-Inventario_${userLabel}_${rows.length}items.pdf`;
    const savePath = path.join(EXPORT_DIR, name);
    return exportPDF2({ res, title: "Inventario Institucional — Estado y Ubicación", rows, savePath });
  } catch (e) { return mapPg(e, res, next); }
}