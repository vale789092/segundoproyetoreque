// backend/src/modules/modulo3_5/modulo3_5.model.js
import { pool } from "../../db/index.js";

/**
 * Crea una notificación genérica.
 */
export async function createNotification({ usuario_id, titulo, mensaje, link }) {
  const { rows } = await pool.query(
    `INSERT INTO notificaciones (usuario_id, titulo, mensaje, link)
     VALUES ($1,$2,$3,$4)
     RETURNING id, usuario_id, titulo, mensaje, link, leida, creada_en`,
    [usuario_id, titulo, mensaje, link ?? null]
  );
  return rows[0];
}

/**
 * Lista notificaciones de un usuario (opcional solo no leídas).
 */
export async function listNotificationsByUser(
  usuario_id,
  { onlyUnread = false, limit = 20 } = {}
) {
  const lim = Math.max(1, Number(limit) || 20);
  const { rows } = await pool.query(
    `
    SELECT id, usuario_id, titulo, mensaje, link, leida, creada_en
      FROM notificaciones
     WHERE usuario_id = $1
       AND ($2::bool = FALSE OR leida = FALSE)
     ORDER BY creada_en DESC
     LIMIT $3
    `,
    [usuario_id, onlyUnread, lim]
  );
  return rows;
}

export async function markNotificationRead(id, usuario_id) {
  await pool.query(
    `UPDATE notificaciones
        SET leida = TRUE
      WHERE id = $1 AND usuario_id = $2`,
    [id, usuario_id]
  );
}

export async function markAllNotificationsRead(usuario_id) {
  await pool.query(
    `UPDATE notificaciones
        SET leida = TRUE
      WHERE usuario_id = $1 AND leida = FALSE`,
    [usuario_id]
  );
}

/**
 * Helper específico para solicitudes: se llama desde modulo3_3.
 */
export async function notifySolicitudEstadoCambio({
  usuario_id,
  recurso_nombre,
  nuevoEstado,
}) {
  const estadoLegible =
    nuevoEstado === "aprobada"
      ? "aprobada"
      : nuevoEstado === "rechazada"
      ? "rechazada"
      : "marcada en revisión";

  const titulo = "Actualización de solicitud";
  const mensaje = `Tu solicitud para "${recurso_nombre}" fue ${estadoLegible}.`;
  const link = "/app/mis-solicitudes";

  try {
    await createNotification({ usuario_id, titulo, mensaje, link });
  } catch (e) {
    console.error("Error creando notificación:", e);
  }
}
