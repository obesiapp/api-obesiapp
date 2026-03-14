// src/routes/notification.routes.js
'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/auth');
const { authorize }   = require('../middleware/authorize');

const router = Router();

router.use(verifyToken);

/**
 * @route  GET /api/v1/notifications/unread
 * @access guardian
 */
router.get('/unread', authorize('read:own_profile'), ctrl.unread);

/**
 * @route  GET /api/v1/notifications
 * @access guardian
 */
router.get('/', authorize('read:own_profile'), ctrl.list);

/**
 * @route  PATCH /api/v1/notifications/read-all
 * @access guardian
 */
router.patch('/read-all', authorize('read:own_profile'), ctrl.markAllRead);

/**
 * @route  PATCH /api/v1/notifications/:notificationId/read
 * @access guardian
 */
router.patch('/:notificationId/read', authorize('read:own_profile'), ctrl.markRead);

module.exports = router;
