// src/middleware/rateLimiter.js
// RF-02 — Rate limiting para login
// RF-05 — Protección global contra DoS
'use strict';

const rateLimit = require('express-rate-limit');
const logger    = require('../utils/logger');

// ─── Rate limiter global (RF-05) ────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max:      parseInt(process.env.RATE_LIMIT_MAX)       || 200,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    logger.warn('[DoS] Tráfico excesivo detectado', { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error: { message: 'Demasiadas solicitudes. Por favor espera unos minutos.' },
    });
  },
});

// ─── Rate limiter específico para login (RF-02) ──────────────────────────────
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.LOGIN_LIMIT_MAX)        || 5,
  standardHeaders: true,
  legacyHeaders:   false,
  skipSuccessfulRequests: true,  // solo cuenta los intentos fallidos
  handler: (req, res) => {
    logger.warn('[SECURITY] Límite de intentos de login alcanzado', { ip: req.ip });
    res.status(429).json({
      success: false,
      error: { message: 'Cuenta bloqueada temporalmente. Intenta de nuevo en 15 minutos.' },
    });
  },
});

// ─── Rate limiter para endpoints sensibles ───────────────────────────────────
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minuto
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: { message: 'Límite de solicitudes alcanzado. Espera un momento.' },
    });
  },
});

module.exports = { globalLimiter, loginLimiter, strictLimiter };
