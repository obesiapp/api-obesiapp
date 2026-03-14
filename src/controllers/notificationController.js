// src/controllers/notificationController.js
'use strict';

const notifService          = require('../services/notificationService');
const { success, paginated } = require('../utils/apiResponse');

// GET /api/v1/notifications/unread
const unread = async (req, res, next) => {
  try {
    const data = await notifService.getUnread(req.user.guardianId);
    return success(res, data, `${data.length} notificación(es) sin leer`);
  } catch (err) { next(err); }
};

// GET /api/v1/notifications?page=&limit=
const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await notifService.getAll(req.user.guardianId, {
      page: parseInt(page), limit: parseInt(limit),
    });
    return paginated(res, result.data, { total: result.total, page, limit });
  } catch (err) { next(err); }
};

// PATCH /api/v1/notifications/:notificationId/read
const markRead = async (req, res, next) => {
  try {
    const result = await notifService.markAsRead(
      req.user.guardianId, req.params.notificationId
    );
    return success(res, result, 'Notificación marcada como leída');
  } catch (err) { next(err); }
};

// PATCH /api/v1/notifications/read-all
const markAllRead = async (req, res, next) => {
  try {
    const result = await notifService.markAllAsRead(req.user.guardianId);
    return success(res, result, 'Todas las notificaciones marcadas como leídas');
  } catch (err) { next(err); }
};

module.exports = { unread, list, markRead, markAllRead };
