// src/routes/admin.routes.js
// Endpoints exclusivos para administradores — CRUD de usuarios, KPIs y auditoría
'use strict';

const { Router }     = require('express');
const { verifyToken }  = require('../middleware/auth');
const { requireRole }  = require('../middleware/authorize');
const { query: dbQuery } = require('../config/db');
const { success, paginated, error } = require('../utils/apiResponse');
const bcrypt         = require('bcryptjs');
const { BCRYPT_SALT_ROUNDS } = require('../config/constants');
const logger         = require('../utils/logger');

const router = Router();

// Todos los endpoints requieren admin
router.use(verifyToken);
router.use(requireRole('admin'));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/stats — KPIs del dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const { rows: [stats] } = await dbQuery(`
      SELECT
        COUNT(*)                                                      AS total_users,
        COUNT(*) FILTER (WHERE role = 'guardian')                     AS total_guardians,
        COUNT(*) FILTER (WHERE role = 'child')                        AS total_children,
        COUNT(*) FILTER (WHERE role = 'admin')                        AS total_admins,
        COUNT(*) FILTER (WHERE is_active = TRUE)                      AS active_users,
        COUNT(*) FILTER (WHERE locked_until > NOW())                  AS locked_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_this_week
      FROM healthkids.accounts
    `);
    return success(res, stats, 'Estadísticas del sistema');
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/users — Listar usuarios con filtros y paginación
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const { role, search, active } = req.query;

    let where   = 'WHERE 1=1';
    const params = [];

    if (role) {
      params.push(role);
      where += ` AND a.role = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (a.username ILIKE $${params.length} OR a.email ILIKE $${params.length})`;
    }
    if (active !== undefined) {
      params.push(active === 'true');
      where += ` AND a.is_active = $${params.length}`;
    }

    const countParams = [...params];
    const { rows: [{ total }] } = await dbQuery(
      `SELECT COUNT(*) AS total FROM healthkids.accounts a ${where}`,
      countParams
    );

    params.push(limit, offset);
    const { rows } = await dbQuery(`
      SELECT
        a.account_id, a.role, a.username, a.email,
        a.is_active, a.email_verified,
        a.failed_login_attempts, a.locked_until,
        a.last_login_at, a.created_at,
        COALESCE(gp.display_name, cp.nickname) AS display_name,
        gp.guardian_id, cp.child_id,
        cp.current_xp, cp.streak_days
      FROM healthkids.accounts a
      LEFT JOIN healthkids.guardian_profiles gp ON gp.account_id = a.account_id
      LEFT JOIN healthkids.child_profiles    cp ON cp.account_id = a.account_id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    return res.json({
      success: true,
      data:    rows,
      meta: {
        total:      parseInt(total),
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/users/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users/:id', async (req, res, next) => {
  try {
    const { rows: [user] } = await dbQuery(`
      SELECT
        a.*, gp.display_name, gp.guardian_id,
        cp.child_id, cp.nickname, cp.current_xp, cp.streak_days
      FROM healthkids.accounts a
      LEFT JOIN healthkids.guardian_profiles gp ON gp.account_id = a.account_id
      LEFT JOIN healthkids.child_profiles    cp ON cp.account_id = a.account_id
      WHERE a.account_id = $1
    `, [req.params.id]);

    if (!user) { const e = new Error('Usuario no encontrado'); e.status = 404; throw e; }
    return success(res, user);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/admin/users/:id — Actualizar usuario
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/users/:id', async (req, res, next) => {
  try {
    const { is_active, email, display_name } = req.body;
    const allowed = [];
    const vals    = [];

    if (is_active !== undefined) { vals.push(is_active);    allowed.push(`is_active = $${vals.length}`); }
    if (email)                   { vals.push(email);        allowed.push(`email = $${vals.length}`);     }

    if (allowed.length === 0 && !display_name) {
      const e = new Error('No se enviaron campos válidos'); e.status = 400; throw e;
    }

    if (allowed.length > 0) {
      vals.push(req.params.id);
      await dbQuery(
        `UPDATE healthkids.accounts SET ${allowed.join(', ')} WHERE account_id = $${vals.length}`,
        vals
      );
    }

    if (display_name) {
      await dbQuery(
        `UPDATE healthkids.guardian_profiles SET display_name = $1
         WHERE account_id = $2`,
        [display_name, req.params.id]
      );
    }

    logger.info('[ADMIN] Usuario actualizado', { id: req.params.id, by: req.user.accountId });

    await dbQuery(
      `INSERT INTO healthkids.audit_log (event_type, actor_account_id, target_account_id, description)
       VALUES ('admin_action', $1, $2, 'Admin actualizó cuenta')`,
      [req.user.accountId, req.params.id]
    );

    return success(res, { account_id: req.params.id }, 'Usuario actualizado');
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/admin/users/:id/unlock — Desbloquear cuenta
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/users/:id/unlock', async (req, res, next) => {
  try {
    await dbQuery(
      `UPDATE healthkids.accounts
       SET failed_login_attempts = 0, locked_until = NULL
       WHERE account_id = $1`,
      [req.params.id]
    );

    await dbQuery(
      `INSERT INTO healthkids.audit_log (event_type, actor_account_id, target_account_id, description)
       VALUES ('admin_action', $1, $2, 'Admin desbloqueó cuenta')`,
      [req.user.accountId, req.params.id]
    );

    logger.info('[ADMIN] Cuenta desbloqueada', { id: req.params.id });
    return success(res, null, 'Cuenta desbloqueada correctamente');
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/admin/users/:id/reset-password
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/users/:id/reset-password', async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      const e = new Error('La nueva contraseña debe tener al menos 8 caracteres'); e.status = 400; throw e;
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await dbQuery(
      `UPDATE healthkids.accounts SET password_hash = $1 WHERE account_id = $2`,
      [hash, req.params.id]
    );

    await dbQuery(
      `INSERT INTO healthkids.audit_log (event_type, actor_account_id, target_account_id, description)
       VALUES ('password_changed', $1, $2, 'Admin restableció contraseña')`,
      [req.user.accountId, req.params.id]
    );

    logger.info('[ADMIN] Contraseña restablecida', { id: req.params.id, by: req.user.accountId });
    return success(res, null, 'Contraseña restablecida correctamente');
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/admin/users/:id — Eliminar usuario
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/users/:id', async (req, res, next) => {
  try {
    // No permitir eliminar su propia cuenta
    if (req.params.id === req.user.accountId) {
      const e = new Error('No puedes eliminar tu propia cuenta'); e.status = 403; throw e;
    }

    const { rowCount } = await dbQuery(
      `DELETE FROM healthkids.accounts WHERE account_id = $1`,
      [req.params.id]
    );

    if (!rowCount) { const e = new Error('Usuario no encontrado'); e.status = 404; throw e; }

    logger.info('[ADMIN] Usuario eliminado', { id: req.params.id, by: req.user.accountId });
    return success(res, null, 'Usuario eliminado correctamente');
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/audit — Bitácora de auditoría
// ─────────────────────────────────────────────────────────────────────────────
router.get('/audit', async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 15);
    const offset = (page - 1) * limit;

    const [{ rows }, { rows: [{ total }] }] = await Promise.all([
      dbQuery(`
        SELECT
          al.audit_id, al.event_type, al.description,
          al.occurred_at, al.ip_address,
          a.username AS actor_username
        FROM healthkids.audit_log al
        LEFT JOIN healthkids.accounts a ON a.account_id = al.actor_account_id
        ORDER BY al.occurred_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      dbQuery(`SELECT COUNT(*) AS total FROM healthkids.audit_log`),
    ]);

    return res.json({
      success: true,
      data:    rows,
      meta: { total: parseInt(total), page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

module.exports = router;
