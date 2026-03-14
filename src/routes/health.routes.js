// src/routes/health.routes.js
// RF-05 — Health check con detección inmediata de caída de BD
'use strict';

const { Router } = require('express');
const { pool }   = require('../config/db');

const router = Router();

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

  // ── RF-05: Forzar conexión nueva con timeout corto ────────────────────────
  let client;
  try {
    // Obtener cliente directamente del pool (no usa caché)
    client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de conexión a BD')), 3000)
      )
    ]);

    // Ejecutar query real para confirmar que la BD responde
    await client.query('SELECT 1');
    status.db = 'ok';

  } catch (err) {
    status.db     = 'error';
    status.status = 'degraded';
    status.db_error = err.message;   // solo en dev, quitar en producción
  } finally {
    // Siempre liberar el cliente aunque falle
    if (client) client.release(true);  // true = destruir la conexión del pool
  }

  const httpStatus = status.status === 'ok' ? 200 : 503;
  return res.status(httpStatus).json(status);
});

module.exports = router;