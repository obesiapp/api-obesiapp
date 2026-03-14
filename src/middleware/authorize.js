// src/middleware/authorize.js
// RF-01 — Control de acceso por roles (RBAC)
'use strict';

const { PERMISSIONS } = require('../config/constants');
const { error }       = require('../utils/apiResponse');
const logger          = require('../utils/logger');

/**
 * Middleware de autorización por permiso específico.
 * Debe usarse DESPUÉS de verifyToken.
 *
 * @example
 *   router.get('/children', verifyToken, authorize('read:children'), controller.list)
 *
 * @param {string} permission - Permiso requerido (ej. 'read:children')
 */
const authorize = (permission) => (req, res, next) => {
  const { role, accountId } = req.user;
  const perms = PERMISSIONS[role] || [];

  // Los admins tienen acceso total
  if (perms.includes('*') || perms.includes(permission)) {
    return next();
  }

  logger.warn('[RBAC] Acceso denegado', {
    accountId,
    role,
    attempted: permission,
    ip:        req.ip,
  });

  return error(res, 'Acceso denegado: permisos insuficientes', 403);
};

/**
 * Middleware que restringe el acceso a uno o más roles específicos.
 * @param {...string} roles - Roles permitidos
 *
 * @example
 *   router.delete('/:id', verifyToken, requireRole('admin'), controller.delete)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (roles.includes(req.user?.role)) return next();

  logger.warn('[RBAC] Rol no autorizado', {
    required:  roles,
    actual:    req.user?.role,
    accountId: req.user?.accountId,
    ip:        req.ip,
  });

  return error(res, 'No tienes permisos para esta acción', 403);
};

module.exports = { authorize, requireRole };
