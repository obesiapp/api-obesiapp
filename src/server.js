// src/server.js
// RF-01 — Servidor HTTPS con TLS 1.2+ y redirección de HTTP → HTTPS
// RF-05 — Inicio/cierre graceful para PM2
'use strict';

require('dotenv').config();

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const app    = require('./app');
const logger = require('./utils/logger');
const db     = require('./config/db');

const PORT       = parseInt(process.env.PORT)       || 3000;
const PORT_HTTP  = parseInt(process.env.PORT_HTTP)  || 80;
const PORT_HTTPS = parseInt(process.env.PORT_HTTPS) || 443;
const isDev      = process.env.NODE_ENV !== 'production';

// ─── Verificar conexión a PostgreSQL antes de arrancar ────────────────────────
async function checkDatabase() {
  try {
    await db.testConnection();
    logger.info('[DB] Conexión a PostgreSQL establecida correctamente');
  } catch (err) {
    logger.error('[DB] No se pudo conectar a PostgreSQL. Abortando inicio.', {
      error: err.message,
    });
    process.exit(1);
  }
}

// ─── Servidor de desarrollo (HTTP simple) ────────────────────────────────────
function startDev() {
  const server = http.createServer(app);

  server.listen(PORT, () => {
    logger.info(`[SERVER] Servidor HTTP de desarrollo activo`, {
      url:  `http://localhost:${PORT}`,
      env:  process.env.NODE_ENV,
    });
    logger.info('[SERVER] Endpoints disponibles:');
    logger.info(`  GET  http://localhost:${PORT}/health`);
    logger.info(`  GET  http://localhost:${PORT}/api/v1`);
    logger.info(`  POST http://localhost:${PORT}/api/v1/auth/login`);
    logger.info(`  POST http://localhost:${PORT}/api/v1/auth/register`);
  });

  return server;
}

// ─── Servidor de producción (HTTPS + redirect HTTP) (RF-01) ──────────────────
function startProd() {
  // Validar certificados
  if (!process.env.TLS_KEY_PATH || !process.env.TLS_CERT_PATH) {
    logger.error('[TLS] Faltan variables TLS_KEY_PATH o TLS_CERT_PATH');
    process.exit(1);
  }

  const tlsOptions = {
    key:        fs.readFileSync(process.env.TLS_KEY_PATH),
    cert:       fs.readFileSync(process.env.TLS_CERT_PATH),
    minVersion: 'TLSv1.2',
    ciphers:    'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256',
  };

  // Servidor HTTPS principal
  const httpsServer = https.createServer(tlsOptions, app);
  httpsServer.listen(PORT_HTTPS, () => {
    logger.info(`[SERVER] HTTPS activo en puerto ${PORT_HTTPS} — TLS 1.2+`);
  });

  // Servidor HTTP de redirección (RF-01: todo el tráfico va a HTTPS)
  const httpServer = http.createServer((req, res) => {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
    res.end();
  });
  httpServer.listen(PORT_HTTP, () => {
    logger.info(`[SERVER] Redirección HTTP→HTTPS activa en puerto ${PORT_HTTP}`);
  });

  return { httpsServer, httpServer };
}

// ─── Cierre graceful (RF-05) ─────────────────────────────────────────────────
function setupGracefulShutdown(servers) {
  const shutdown = async (signal) => {
    logger.info(`[SERVER] Señal ${signal} recibida. Cerrando servidor...`);

    const closeServer = (server) =>
      new Promise((resolve) => server.close(resolve));

    try {
      if (Array.isArray(servers)) {
        await Promise.all(servers.map(closeServer));
      } else {
        await closeServer(servers);
      }
      await db.pool.end();
      logger.info('[SERVER] Servidor cerrado correctamente');
      process.exit(0);
    } catch (err) {
      logger.error('[SERVER] Error durante el cierre', { error: err.message });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
(async () => {
  await checkDatabase();

  if (isDev) {
    const server = startDev();
    setupGracefulShutdown(server);
  } else {
    const { httpsServer, httpServer } = startProd();
    setupGracefulShutdown([httpsServer, httpServer]);
  }
})();
