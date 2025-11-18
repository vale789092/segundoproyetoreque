import * as M from "./modulo1_2.model.js";

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);
const send = (res, code, message) => res.status(code).json({ error: { code, message } });
function sendError(res, e) { if (e?.status) return send(res, e.status, e.message); switch (e?.code) {
  case "OVERLAP_SLOT": return send(res, 400, "Franja horaria traslapa con otra existente");
  case "23505": return send(res, 409, "Registro duplicado");
  case "23503": return send(res, 400, "Referencia inválida");
  case "23514":
  case "22P02": return send(res, 400, e.message || "Datos inválidos");
  default: return send(res, 500, e?.message || "Error interno del servidor");
}}

function getActorId(req) {
  return (
    req.user?.id ??
    req.user?.user?.id ??
    req.auth?.id ??
    req.auth?.user?.id ??
    null
  );
}

function parseIsoLocal(dateStr) {
  const parts = String(dateStr).split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function buildDateTimeLocal(fechaStr, timeStr) {
  if (!fechaStr || !timeStr) return new Date(NaN);
  const [y, m, d] = fechaStr.split("-").map(Number);
  const [hh, mm, ss] = String(timeStr).split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, ss || 0);
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

    // Caso con ?fecha=YYYY-MM-DD => slots del día
    if (fechaStr) {
      // usar parseIsoLocal y no new Date("YYYY-MM-DD")
      const d = parseIsoLocal(fechaStr);
      if (Number.isNaN(d.getTime())) {
        return send(res, 400, "fecha inválida (YYYY-MM-DD)");
      }
      const dow = d.getDay(); // 0..6 (0=domingo)

      // 1) horario base por DOW
      // 2) bloqueos del día
      // 3) reservas aprobadas del día
      const [base, bloqueosDia, reservasDia] = await Promise.all([
        M.listHorariosByDow(labId, dow),
        M.listBloqueosDia(labId, fechaStr),
        M.listReservasDia(labId, fechaStr),
      ]);

      // helper: devuelve TODAS las reservas aprobadas que traslapan la franja
      function getReservasEnFranja(slotInicio, slotFin) {
        const items = [];
        for (const r of reservasDia) {
          const rIni = new Date(r.fecha_uso_inicio);
          const rFin = new Date(r.fecha_uso_fin);
          if (Number.isNaN(rIni.getTime()) || Number.isNaN(rFin.getTime())) {
            continue;
          }
          // traslape de [slotInicio,slotFin) con [rIni,rFin)
          if (!(rFin <= slotInicio || rIni >= slotFin)) {
            items.push({
              id: r.id,
              desde: rIni.toTimeString().slice(0, 5), // "HH:MM"
              hasta: rFin.toTimeString().slice(0, 5),
            });
          }
        }
        return items;
      }

      // separo bloqueos "normales" de las franjas de un solo día
      const singles = [];
      const bloqueos = [];

      for (const b of bloqueosDia) {
        let descJson = null;
        if (b.descripcion) {
          try {
            descJson = JSON.parse(b.descripcion);
          } catch {
            descJson = null;
          }
        }

        const esFranjaDisponibleSoloDia =
          b.tipo === "evento" &&
          descJson &&
          descJson.etiqueta === "Franja disponible" &&
          typeof descJson.capacidad_maxima === "number";

        if (esFranjaDisponibleSoloDia) {
          const ini = new Date(b.ts_inicio);
          const fin = new Date(b.ts_fin);

          const reservas = getReservasEnFranja(ini, fin);
          const reservasCount = reservas.length;
          const capMax = descJson.capacidad_maxima;

          let bloqueado = false;
          let motivo = descJson.etiqueta || b.titulo || null;

          // si está lleno por reservas, lo marcamos bloqueado
          if (typeof capMax === "number" && reservasCount >= capMax) {
            bloqueado = true;
            motivo = `${reservasCount}/${capMax} reservas — cupo lleno`;
          }

          singles.push({
            fecha: fechaStr,
            desde: ini.toTimeString().slice(0, 5),  // "HH:MM"
            hasta: fin.toTimeString().slice(0, 5),
            bloqueado,
            motivo,
            tipo_bloqueo: "evento",
            capacidad_maxima: capMax,
            reservas_aprobadas: reservasCount,
            capacidad_disponible:
              typeof capMax === "number"
                ? Math.max(capMax - reservasCount, 0)
                : null,
            reservas, // <-- detalle de cada reserva aprobada en esa franja
          });
        } else {
          // bloqueo real (evento/mantto/uso_exclusivo/bloqueo)
          bloqueos.push(b);
        }
      }

      // slots de horario base (semanal)
      const baseSlots = base.map((r) => {
        const slotInicio = buildDateTimeLocal(fechaStr, r.hora_inicio);
        const slotFin = buildDateTimeLocal(fechaStr, r.hora_fin);

        let bloqueado = false;
        let motivo = null;
        let tipo_bloqueo = null;

        // ver si esta franja cae dentro de algún bloqueo
        for (const b of bloqueos) {
          const bIni = new Date(b.ts_inicio);
          const bFin = new Date(b.ts_fin);
          if (!(bFin <= slotInicio || bIni >= slotFin)) {
            bloqueado = true;
            motivo = b.descripcion || b.titulo || null;
            tipo_bloqueo = b.tipo || null;
            break;
          }
        }

        const capacidad_maxima =
          typeof r.capacidad_maxima === "number" ? r.capacidad_maxima : null;

        const reservas = getReservasEnFranja(slotInicio, slotFin);
        const reservas_aprobadas = reservas.length;

        const capacidad_disponible =
          typeof capacidad_maxima === "number"
            ? Math.max(capacidad_maxima - reservas_aprobadas, 0)
            : null;

        if (
          typeof capacidad_maxima === "number" &&
          reservas_aprobadas >= capacidad_maxima &&
          !bloqueado
        ) {
          bloqueado = true;
          motivo = `${reservas_aprobadas}/${capacidad_maxima} reservas — cupo lleno`;
        }

        return {
          fecha: fechaStr,
          desde: r.hora_inicio,
          hasta: r.hora_fin,
          bloqueado,
          motivo,
          tipo_bloqueo,
          capacidad_maxima,
          reservas_aprobadas,
          capacidad_disponible,
          reservas, // <-- detalle de cada reserva aprobada en esa franja
        };
      });

      // mezclamos slots base + "solo este día" y ordenamos por hora
      const slots = [...baseSlots, ...singles].sort((a, b) =>
        a.desde.localeCompare(b.desde)
      );

      return res.status(200).json(slots);
    }

    // Sin fecha => devolver el horario base completo (por DOW)
    const rows = await M.listHorarios(labId);
    return res.status(200).json(rows);
  } catch (e) {
    return sendError(res, e);
  }
}

export async function createBloqueo(req, res) {
  try {
    const labId = String(req.params.labId || "");
    if (!isUuid(labId)) return send(res, 400, "labId inválido");
    const actorId = getActorId(req);

    const out = await M.createBloqueo(labId, req.body || {}, actorId);
    return res.status(201).json(out);
  } catch (e) {
    return sendError(res, e);
  }
}

export async function listBloqueos(req, res) {
  try {
    const labId = String(req.params.labId || "");
    if (!isUuid(labId)) return send(res, 400, "labId inválido");

    const { desde, hasta } = req.query || {};
    const rows = await M.listBloqueos(labId, {
      desde: desde ? String(desde) : undefined,
      hasta: hasta ? String(hasta) : undefined,
    });
    return res.status(200).json(rows);
  } catch (e) {
    return sendError(res, e);
  }
}

export async function deleteBloqueo(req, res) {
  try {
    const labId = String(req.params.labId || "");
    const bloqueoId = String(req.params.bloqueoId || "");
    if (!isUuid(labId) || !isUuid(bloqueoId)) {
      return send(res, 400, "ids inválidos");
    }
    const actorId = getActorId(req);
    const ok = await M.deleteBloqueo(labId, bloqueoId, actorId);
    if (!ok) return send(res, 404, "Bloqueo no encontrado");
    return res.status(200).json({ ok: true });
  } catch (e) {
    return sendError(res, e);
  }
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
