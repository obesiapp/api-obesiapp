// src/routes/health.routes.js
// RF-05 — Endpoint de salud del sistema para monitoreo con PM2 / cron
'use strict';

const { Router }         = require('express');
const { testConnection } = require('../config/db');

const router = Router();

/**
 * @route  GET /health
 * @desc   Health check del sistema y conexión a BD
 * @access Público (sin autenticación — para monitoreo externo)
 */
router.get('/', async (req, res) => {
  const status = {
    service:   'healthkids-api',
    status:    'ok',
    timestamp: new Date().toISOString(),
    version:   process.env.npm_package_version || '1.0.0',
    uptime:    `${Math.floor(process.uptime())} segundos`,
    memory:    `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
    db:        'unknown',
    env:       process.env.NODE_ENV,
  };

  try {
    await testConnection();
    status.db = 'ok';
  } catch (err) {
    status.db     = 'error';
    status.status = 'degraded';
  }

  const httpStatus = status.status === 'ok' ? 200 : 503;
  return res.status(httpStatus).json(status);
});

module.exports = router;
