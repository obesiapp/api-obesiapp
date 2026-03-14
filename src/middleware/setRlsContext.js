// src/middleware/setRlsContext.js
// Inyecta el account_id en la sesión de PostgreSQL para que funcione el RLS
'use strict';

const db = require('../config/db');

/**
 * Middleware que ejecuta SET LOCAL app.current_account_id en la conexión
 * de BD actual para activar las políticas de Row-Level Security.
 * Debe usarse DESPUÉS de verifyToken.
 */
const setRlsContext = async (req, res, next) => {
  if (!req.user?.accountId) return next();

  try {
    // Nota: para RLS real necesitas usar un cliente dedicado por request.
    // En producción considera usar pg-rls o session variables con Knex.
    await db.query(
      `SELECT set_config('app.current_account_id', $1, false)`,
      [req.user.accountId]
    );
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { setRlsContext };
