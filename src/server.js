// src/server.js
'use strict';

require('dotenv').config();

const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');
const db = require('./config/db');

const PORT = parseInt(process.env.PORT, 10) || 3000;

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

function startServer() {
  const server = http.createServer(app);

  server.listen(PORT, () => {
    logger.info('[SERVER] API ObesiApp activa', {
      url: `http://localhost:${PORT}`,
      env: process.env.NODE_ENV,
    });

    logger.info('[SERVER] Endpoints disponibles:');
    logger.info('  GET  /health');
    logger.info('  GET  /api/v1');
    logger.info('  POST /api/v1/auth/login');
    logger.info('  POST /api/v1/auth/register');
  });

  return server;
}

function setupGracefulShutdown(server) {
  const shutdown = async (signal) => {
    logger.info(`[SERVER] Señal ${signal} recibida. Cerrando servidor...`);

    try {
      await new Promise((resolve) => server.close(resolve));
      await db.pool.end();
      logger.info('[SERVER] Servidor cerrado correctamente');
      process.exit(0);
    } catch (err) {
      logger.error('[SERVER] Error durante el cierre', { error: err.message });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

(async () => {
  await checkDatabase();
  const server = startServer();
  setupGracefulShutdown(server);
})();