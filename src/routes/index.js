// src/routes/index.js
// Monta todos los routers bajo el prefijo /api/v1
'use strict';

const { Router } = require('express');

const authRoutes         = require('./auth.routes');
const childRoutes        = require('./child.routes');
const catalogRoutes      = require('./catalog.routes');
const notificationRoutes = require('./notification.routes');

const router = Router();

router.use('/auth',          authRoutes);
router.use('/children',      childRoutes);
router.use('/catalog',       catalogRoutes);
router.use('/notifications', notificationRoutes);

// Ruta raíz del API — info básica
router.get('/', (req, res) => {
  res.json({
    api:     'HealthKids REST API',
    version: 'v1',
    docs:    '/api/v1/docs',
    health:  '/health',
  });
});

module.exports = router;
