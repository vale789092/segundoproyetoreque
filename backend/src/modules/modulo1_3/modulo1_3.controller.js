// modules/modulo1_3/modulo1_3.controller.js
import {
  listPrestamosDB,
  registrarDevolucionDB,
} from "./modulo1_3.model.js";

const bad = (res, msg, status = 400) =>
  res.status(status).json({ error: msg });

/**
 * GET /api/prestamos?estado=activos|devueltos|todos&q=...
 */
export async function getPrestamos(req, res, next) {
  try {
    const estadoRaw = String(req.query.estado || "activos");
    const estado = ["activos", "devueltos", "todos"].includes(estadoRaw)
      ? estadoRaw
      : "activos";

    const items = await listPrestamosDB({ estado });
    return res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/prestamos/:prestamoId/devolucion
 * (prestamoId = id de la SOLICITUD aprobada)
 */
export async function patchRegistrarDevolucion(req, res, next) {
  try {
    const solicitudId = req.params.prestamoId;
    if (!solicitudId) return bad(res, "prestamoId requerido");

    const updated = await registrarDevolucionDB({ solicitudId });
    return res.json({ solicitud: updated });
  } catch (err) {
    if (err.code === "REQ_NOT_FOUND") {
      return bad(res, "Solicitud no encontrada o no aprobada.", 404);
    }
    next(err);
  }
}
