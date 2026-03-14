// src/services/notificationService.js
// Gestión de notificaciones al tutor
'use strict';

const db     = require('../config/db');
const logger = require('../utils/logger');

// ─── Notificaciones no leídas del tutor ──────────────────────────────────────
const getUnread = async (guardianId) => {
  const { rows } = await db.query(
    `SELECT
       n.notification_id, n.type, n.title, n.body, n.sent_at,
       cp.nickname AS child_nickname, cp.child_id
     FROM notifications n
     LEFT JOIN child_profiles cp ON cp.child_id = n.child_id
     WHERE n.guardian_id = $1
       AND n.is_read     = FALSE
     ORDER BY n.sent_at DESC`,
    [guardianId]
  );
  return rows;
};

// ─── Todas las notificaciones con paginación ─────────────────────────────────
const getAll = async (guardianId, { page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;

  const [{ rows }, { rows: [cnt] }] = await Promise.all([
    db.query(
      `SELECT
         n.notification_id, n.type, n.title, n.body,
         n.is_read, n.sent_at, n.read_at,
         cp.nickname AS child_nickname
       FROM notifications n
       LEFT JOIN child_profiles cp ON cp.child_id = n.child_id
       WHERE n.guardian_id = $1
       ORDER BY n.sent_at DESC
       LIMIT $2 OFFSET $3`,
      [guardianId, limit, offset]
    ),
    db.query(
      `SELECT COUNT(*) AS total FROM notifications WHERE guardian_id = $1`,
      [guardianId]
    ),
  ]);

  return { data: rows, total: parseInt(cnt.total), page, limit };
};

// ─── Marcar como leída ────────────────────────────────────────────────────────
const markAsRead = async (guardianId, notificationId) => {
  const { rowCount } = await db.query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE notification_id = $1 AND guardian_id = $2 AND is_read = FALSE`,
    [notificationId, guardianId]
  );
  if (!rowCount) {
    const err = new Error('Notificación no encontrada o ya leída');
    err.status = 404;
    throw err;
  }
  return { notification_id: notificationId, is_read: true };
};

// ─── Marcar todas como leídas ─────────────────────────────────────────────────
const markAllAsRead = async (guardianId) => {
  const { rowCount } = await db.query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE guardian_id = $1 AND is_read = FALSE`,
    [guardianId]
  );
  logger.info('[NOTIF] Todas marcadas como leídas', { guardianId, count: rowCount });
  return { updated: rowCount };
};

// ─── Crear notificación (uso interno del sistema) ────────────────────────────
const create = async ({ guardianId, childId, type, title, body }) => {
  const { rows: [notif] } = await db.query(
    `INSERT INTO notifications (guardian_id, child_id, type, title, body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING notification_id, type, title, sent_at`,
    [guardianId, childId || null, type, title, body || null]
  );
  return notif;
};

module.exports = { getUnread, getAll, markAsRead, markAllAsRead, create };
