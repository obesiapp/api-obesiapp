// src/services/childService.js
// CRUD de perfiles de niños y consultas del dashboard
'use strict';

const db     = require('../config/db');
const logger = require('../utils/logger');
const { MAX_CHILDREN_PER_GUARDIAN } = require('../config/constants');

// ─── Obtener todos los hijos de un tutor ─────────────────────────────────────
const getChildrenByGuardian = async (guardianId) => {
  const { rows } = await db.query(
    `SELECT
       cp.child_id, cp.nickname, cp.age_range, cp.avatar_code,
       cp.current_xp, cp.streak_days, cp.is_active,
       lc.level_number, lc.name AS level_name, lc.badge_code AS level_badge,
       gc.permission_level, gc.status AS link_status
     FROM guardian_child gc
     JOIN child_profiles cp ON cp.child_id = gc.child_id
     JOIN level_catalog  lc ON lc.level_id = cp.current_level_id
     WHERE gc.guardian_id = $1
       AND gc.status      = 'active'
     ORDER BY cp.nickname`,
    [guardianId]
  );
  return rows;
};

// ─── Obtener perfil completo de un niño ──────────────────────────────────────
const getChildById = async (childId, guardianId = null) => {
  let query = `
    SELECT
      cp.child_id, cp.nickname, cp.age_range, cp.avatar_code,
      cp.current_xp, cp.streak_days, cp.is_active, cp.created_at,
      lc.level_number, lc.name AS level_name, lc.badge_code,
      lc.max_xp - cp.current_xp AS xp_to_next_level
    FROM child_profiles cp
    JOIN level_catalog lc ON lc.level_id = cp.current_level_id
    WHERE cp.child_id = $1`;
  const params = [childId];

  // Si se pasa guardianId, verificar que sea su tutor
  if (guardianId) {
    query += ` AND EXISTS (
      SELECT 1 FROM guardian_child gc
      WHERE gc.child_id    = cp.child_id
        AND gc.guardian_id = $2
        AND gc.status      = 'active'
    )`;
    params.push(guardianId);
  }

  const { rows } = await db.query(query, params);
  if (!rows[0]) {
    const err = new Error('Perfil de niño no encontrado');
    err.status = 404;
    throw err;
  }
  return rows[0];
};

// ─── Crear perfil de niño ─────────────────────────────────────────────────────
const createChild = async (guardianId, { username, password, nickname, ageRange, avatarCode }) => {
  // Verificar límite de hijos por tutor (Suposición v1-01: máx 5)
  const { rows: [count] } = await db.query(
    `SELECT COUNT(*) AS total
     FROM guardian_child
     WHERE guardian_id = $1 AND status = 'active'`,
    [guardianId]
  );
  if (parseInt(count.total) >= MAX_CHILDREN_PER_GUARDIAN) {
    const err = new Error(`No puedes tener más de ${MAX_CHILDREN_PER_GUARDIAN} perfiles de niño`);
    err.status = 409;
    throw err;
  }

  const bcrypt = require('bcryptjs');
  const { BCRYPT_SALT_ROUNDS } = require('../config/constants');
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const result = await db.withTransaction(async (client) => {
    // Cuenta del niño (sin email — RF-01)
    const { rows: [account] } = await client.query(
      `INSERT INTO accounts (role, username, password_hash)
       VALUES ('child', $1, $2)
       RETURNING account_id`,
      [username, passwordHash]
    );

    // Perfil del niño
    const { rows: [child] } = await client.query(
      `INSERT INTO child_profiles (account_id, nickname, age_range, avatar_code)
       VALUES ($1, $2, $3, $4)
       RETURNING child_id, nickname, age_range, avatar_code, current_xp, streak_days`,
      [account.account_id, nickname, ageRange, avatarCode || null]
    );

    // Obtener guardian_id del tutor
    const { rows: [gp] } = await client.query(
      `SELECT guardian_id FROM guardian_profiles WHERE account_id = $1`,
      [guardianId]  // guardianId aquí es account_id del tutor
    );

    // Vínculo tutor-niño
    await client.query(
      `INSERT INTO guardian_child
         (guardian_id, child_id, relationship_type, permission_level, status, linked_by)
       VALUES ($1, $2, 'parent', 'manage', 'active', $3)`,
      [gp.guardian_id, child.child_id, account.account_id]
    );

    // Auditoría
    await client.query(
      `INSERT INTO audit_log
         (event_type, actor_account_id, target_account_id, description, metadata)
       VALUES ('account_created', $1, $2, 'Creación de perfil de niño', $3::jsonb)`,
      [account.account_id, account.account_id,
       JSON.stringify({ role: 'child', nickname, ageRange })]
    );

    return child;
  });

  logger.info('[CHILD] Perfil de niño creado', { childId: result.child_id, guardianId });
  return result;
};

// ─── Actualizar perfil de niño ────────────────────────────────────────────────
const updateChild = async (childId, guardianId, updates) => {
  // Solo se permite cambiar nickname, avatar_code
  const allowed = ['nickname', 'avatar_code'];
  const fields  = Object.keys(updates).filter(k => allowed.includes(k));

  if (fields.length === 0) {
    const err = new Error('No se proporcionaron campos válidos para actualizar');
    err.status = 400;
    throw err;
  }

  // Verificar que el tutor tenga permiso
  const { rowCount } = await db.query(
    `SELECT 1 FROM guardian_child gc
     JOIN guardian_profiles gp ON gp.guardian_id = gc.guardian_id
     WHERE gc.child_id    = $1
       AND gp.account_id  = $2
       AND gc.status      = 'active'
       AND gc.permission_level IN ('manage','admin')`,
    [childId, guardianId]
  );
  if (!rowCount) {
    const err = new Error('No tienes permiso para modificar este perfil');
    err.status = 403;
    throw err;
  }

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values     = [...fields.map(f => updates[f]), childId];

  const { rows: [updated] } = await db.query(
    `UPDATE child_profiles SET ${setClauses}
     WHERE child_id = $${fields.length + 1}
     RETURNING child_id, nickname, age_range, avatar_code, updated_at`,
    values
  );

  logger.info('[CHILD] Perfil actualizado', { childId });
  return updated;
};

// ─── Dashboard diario del niño ────────────────────────────────────────────────
const getDailyDashboard = async (childId, date = null) => {
  const targetDate = date || 'CURRENT_DATE';
  const params     = [childId];
  const dateSql    = date ? '$2' : 'CURRENT_DATE';
  if (date) params.push(date);

  const { rows: [summary] } = await db.query(
    `SELECT
       ds.summary_date, ds.xp_gained, ds.challenges_completed,
       ds.habits_completed, ds.habits_total,
       ROUND(ds.habits_completed::NUMERIC / NULLIF(ds.habits_total, 0) * 100, 1) AS habits_pct,
       ds.screen_time_minutes, ds.screen_limit_exceeded, ds.streak_days_at_date
     FROM daily_summary ds
     WHERE ds.child_id    = $1
       AND ds.summary_date = ${dateSql}`,
    params
  );
  return summary || null;
};

// ─── Tendencia semanal (últimas N semanas) ────────────────────────────────────
const getWeeklyTrend = async (childId, weeks = 8) => {
  const { rows } = await db.query(
    `SELECT
       DATE_TRUNC('week', ds.summary_date)                                      AS week_start,
       SUM(ds.xp_gained)                                                         AS xp_total,
       SUM(ds.challenges_completed)                                              AS challenges,
       ROUND(AVG(ds.habits_completed::NUMERIC / NULLIF(ds.habits_total,0))*100,1) AS habits_pct
     FROM daily_summary ds
     WHERE ds.child_id    = $1
       AND ds.summary_date >= CURRENT_DATE - ($2 * 7)
     GROUP BY 1
     ORDER BY 1 ASC`,
    [childId, weeks]
  );
  return rows;
};

module.exports = {
  getChildrenByGuardian,
  getChildById,
  createChild,
  updateChild,
  getDailyDashboard,
  getWeeklyTrend,
};
