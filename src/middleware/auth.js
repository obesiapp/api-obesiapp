// src/middleware/auth.js
// RF-02 — Verificación de tokens JWT firmados con HS512
'use strict';

const jwt    = require('jsonwebtoken');
const { error } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Middleware que verifica el token JWT en el header Authorization.
 * Agrega req.user con el payload decodificado si el token es válido.
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Token de acceso requerido', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [process.env.JWT_ALGORITHM || 'HS512'],
      issuer:     process.env.JWT_ISSUER     || 'healthkids.app',
    });

    // Adjuntar el payload al request para usar en controladores
    req.user = decoded;

    // Pasar el account_id a PostgreSQL para RLS (Row-Level Security)
    req.accountId = decoded.accountId;

    next();
  } catch (err) {
    logger.warn('[AUTH] Token inválido o expirado', { error: err.message, ip: req.ip });

    if (err.name === 'TokenExpiredError') {
      return error(res, 'La sesión ha expirado. Por favor inicia sesión nuevamente.', 401);
    }
    return error(res, 'Token inválido', 403);
  }
};

/**
 * Genera un token JWT firmado.
 * @param {object} payload  - Datos a incluir en el token
 * @param {string} role     - Rol del usuario (determina la expiración)
 * @returns {string}
 */
const generateToken = (payload, role) => {
  const expiresMap = {
    child:    process.env.JWT_EXPIRES_CHILD    || '1h',
    guardian: process.env.JWT_EXPIRES_GUARDIAN || '8h',
    admin:    process.env.JWT_EXPIRES_ADMIN    || '4h',
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: process.env.JWT_ALGORITHM || 'HS512',
    expiresIn: expiresMap[role] || '4h',
    issuer:    process.env.JWT_ISSUER || 'healthkids.app',
  });
};

module.exports = { verifyToken, generateToken };
