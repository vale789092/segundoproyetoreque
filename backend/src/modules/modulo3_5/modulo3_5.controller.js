// backend/src/modules/modulo3_5/modulo3_5.controller.js
import {
  listNotificationsByUser,
  markNotificationRead,
  markAllNotificationsRead,
} from "./modulo3_5.model.js";

export async function listMyNotificationsCtrl(req, res, next) {
  try {
    const usuario_id = req.user.id;
    const onlyUnread = req.query.onlyUnread === "true";
    const limit = Number(req.query.limit) || 20;

    const rows = await listNotificationsByUser(usuario_id, {
      onlyUnread,
      limit,
    });
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
}

export async function markReadCtrl(req, res, next) {
  try {
    const usuario_id = req.user.id;
    const { id } = req.params;
    await markNotificationRead(id, usuario_id);
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
}

export async function markAllReadCtrl(req, res, next) {
  try {
    const usuario_id = req.user.id;
    await markAllNotificationsRead(usuario_id);
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
}
