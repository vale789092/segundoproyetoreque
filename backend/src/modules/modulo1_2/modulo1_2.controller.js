import * as M from "./modulo1_2.model.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);
const send = (res, code, message) => res.status(code).json({ error: { code, message } });

function sendError(res, e) { 
  if (e?.status) return send(res, e.status, e.message); 
  switch (e?.code) {
    case "OVERLAP_SLOT": return send(res, 400, "Franja horaria traslapa con otra existente");
    case "23505": return send(res, 409, "Registro duplicado");
    case "23503": return send(res, 400, "Referencia inválida");
    case "23514":
    case "22P02": return send(res, 400, e.message || "Datos inválidos");
    default: return send(res, 500, e?.message || "Error interno del servidor");
  }
}

function getActorId(req) {
  return (
    req.user?.id ??
    req.user?.user?.id ??
    req.auth?.id ??
    req.auth?.user?.id ??
    null
  );
}

/* ==================== 1.2.1 — HORARIO BASE SEMANAL ==================== */
export async function createHorario(req, res) {
  try {
    const labId = String(req.params.labId || "");
    if (!isUuid(labId)) return send(res, 400, "labId inválido");
    const actorId = getActorId(req);
    const out = await M.createHorario(labId, req.body || {}, actorId);
    return res.status(201).json(out);
  } catch (e) { return sendError(res, e); }
}

export async function listHorarios(req, res) {
  try {
    const labId = String(req.params.labId || "");
    if (!isUuid(labId)) return send(res, 400, "labId inválido");

    const fechaStr = req.query?.fecha ? String(req.query.fecha) : null;

    // Si viene fecha => filtrar por DOW y devolver slots del día
    if (fechaStr) {
      const d = new Date(fechaStr);
      if (Number.isNaN(d.getTime())) return send(res, 400, "fecha inválida (YYYY-MM-DD)");
      const dow = d.getDay(); // 0..6
      const rows = await M.listHorariosByDow(labId, dow);

      // Hook para bloqueos por fecha exacta (si en el futuro agregás tabla de bloqueos):
      // const bloqueos = await M.listBloqueosPorFecha(labId, fechaStr); // -> [{desde,hasta,motivo}]
      // En este MVP no hay bloqueos; devolvemos sólo base semanal.

      const slots = rows.map(r => ({
        fecha: fechaStr,
        desde: r.hora_inicio,
        hasta: r.hora_fin,
        bloqueado: false,
        motivo: null,
      }));
      return res.status(200).json(slots);
    }

    // Sin fecha => devolver definición semanal completa (como ahora)
    const rows = await M.listHorarios(labId);
    return res.status(200).json(rows);
  } catch (e) { return sendError(res, e); }
}

export async function updateHorario(req, res) {
  try {
    const labId = String(req.params.labId || "");
    const slotId = String(req.params.slotId || "");
    if (!isUuid(labId) || !isUuid(slotId)) return send(res, 400, "ids inválidos");
    const actorId = getActorId(req);
    const out = await M.updateHorario(labId, slotId, req.body || {}, actorId);
    if (!out) return send(res, 404, "Franja no encontrada");
    return res.status(200).json(out);
  } catch (e) { return sendError(res, e); }
}

export async function deleteHorario(req, res) {
  try {
    const labId = String(req.params.labId || "");
    const slotId = String(req.params.slotId || "");
    if (!isUuid(labId) || !isUuid(slotId)) return send(res, 400, "ids inválidos");
    const actorId = getActorId(req);
    const ok = await M.deleteHorario(labId, slotId, actorId);
    if (!ok) return send(res, 404, "Franja no encontrada");
    return res.status(200).json({ ok: true });
  } catch (e) { return sendError(res, e); }
}

/** ===== Bitácora (JSON) ===== */
export async function listHistory(req, res) {
  try {
    const labId = String(req.params.labId || "");
    if (!UUID_RE.test(labId)) return send(res, 400, "labId inválido (uuid)");
    const rows = await M.listLabHistoryAll(labId);
    return res.json(rows);
  } catch (e) {
    const code = e.status || 500;
    return send(res, code, e.message || "Error");
  }
}

/** ===== Bitácora (PDF) ===== */
export async function historyPdf(req, res) {
  try {
    const labId = String(req.params.labId || "");
    if (!UUID_RE.test(labId)) return send(res, 400, "labId inválido (uuid)");

    const rows = await M.listLabHistoryAll(labId);
    const labName = rows[0]?.lab_nombre || labId;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Bitacora_${labName}.pdf"`);

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 28, left: 28, right: 28, bottom: 32 }
    });
    doc.pipe(res);

    // Título
    doc.font("Helvetica-Bold").fontSize(14).text("Bitácora de laboratorio");
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(10)
       .text(`Laboratorio: ${labName}   •   Registros: ${rows.length}`);

    // Tabla simple
    const cols = [
      { k: "ts",          h: "Fecha/Hora", w: 160, a: "left"  },
      { k: "lab_nombre",  h: "Laboratorio",w: 200, a: "left"  },
      { k: "accion",      h: "Acción",     w: 160, a: "left"  },
      { k: "detalle_s",   h: "Detalle",    w: 520, a: "left"  },
      { k: "user_nombre", h: "Usuario",    w: 160, a: "left"  },
    ];
    const x0 = doc.page.margins.left, pad = 6;
    let y = doc.y + 12;

    const totalW = cols.reduce((s, c) => s + c.w, 0);
    const drawHeader = () => {
      const h = 20;
      doc.save().rect(x0, y, totalW, h).fill("#F2F4F7").restore();
      doc.font("Helvetica-Bold").fontSize(10);
      let x = x0;
      for (const c of cols) {
        doc.text(c.h, x + pad, y + 4, { width: c.w - pad * 2, align: "center" });
        x += c.w;
      }
      y += h;
    };
    const bottom = () => doc.page.height - doc.page.margins.bottom - 8;

    drawHeader();
    doc.font("Helvetica").fontSize(9).fillColor("#000");

    rows.forEach((r, i) => {
      const row = {
        ts: new Date(r.ts).toLocaleString(),
        lab_nombre: r.lab_nombre || "",
        accion: r.accion,
        detalle_s: r.detalle ? JSON.stringify(r.detalle) : "",
        user_nombre: r.user_nombre || "",
      };
      const rh = Math.max(
        18,
        ...cols.map(c => doc.heightOfString(String(row[c.k] ?? ""), { width: c.w - pad * 2 }))
      ) + pad * 2;

      if (y + rh > bottom()) {
        doc.font("Helvetica").fontSize(8).fillColor("#6B7280")
           .text(`Página ${doc.page.number}`, x0, bottom() + 8, { width: 200, align: "left" });
        doc.addPage(); y = doc.y + 10;
        drawHeader();
        doc.font("Helvetica").fontSize(9).fillColor("#000");
      }

      if (i % 2 === 1) doc.save().rect(x0, y, totalW, rh).fill("#FAFBFC").restore();

      let x = x0;
      for (const c of cols) {
        doc.text(String(row[c.k] ?? ""), x + pad, y + pad, { width: c.w - pad * 2, align: c.a });
        x += c.w;
      }
      y += rh;
    });

    doc.end();
  } catch (e) {
    const code = e.status || 500;
    return send(res, code, e.message || "Error");
  }
}