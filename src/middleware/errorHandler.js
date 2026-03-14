// src/middleware/errorHandler.js
// RF-05 — Manejo centralizado de errores
'use strict';

const logger = require('../utils/logger');

/**
 * Middleware de manejo centralizado de errores.
 * Debe registrarse ÚLTIMO en el servidor Express.
 */
const errorHandler = (err, req, res, next) => {
  const status    = err.status || err.statusCode || 500;
  const isDev     = process.env.NODE_ENV !== 'production';
  const timestamp = new Date().toISOString();

  logger.error('[ERROR]', {
    timestamp,
    status,
    message:  err.message,
    path:     req.originalUrl,
    method:   req.method,
    ip:       req.ip,
    userId:   req.user?.accountId,
    stack:    isDev ? err.stack : undefined,
  });

  // Errores de validación de express-validator
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      error: { message: 'Error de validación', details: err.errors },
    });
  }

  // Error de violación de FK en PostgreSQL
  if (err.code === '23503') {
    return res.status(422).json({
      success: false,
      error: { message: 'Referencia inválida: el recurso relacionado no existe.' },
    });
  }

  // Error de duplicado (unique constraint)
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: { message: 'Ya existe un registro con esos datos.' },
    });
  }

  // No exponer detalles internos en producción
  res.status(status).json({
    success: false,
    error: {
      message: status >= 500
        ? 'Error interno del servidor. Por favor intenta de nuevo.'
        : err.message,
      ...(isDev && { stack: err.stack }),
    },
  });
};

// ─── Captura de errores no controlados (RF-05) ───────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('[CRÍTICO] Promise rechazada sin manejar', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('[CRÍTICO] Excepción no capturada — el proceso se reiniciará', {
    message: err.message,
  });
  process.exit(1); // PM2 reiniciará el proceso
});

module.exports = { errorHandler };
