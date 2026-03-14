// src/services/habitService.js
// Registro diario de hábitos + catálogo
// RF-03: los logs incluyen integrity_hash (SHA-256) para detectar alteraciones
'use strict';

const db                     = require('../config/db');
const { computeHash, verifyIntegrity } = require('../utils/integrity');
const logger                 = require('../utils/logger');

// ─── Catálogo de hábitos disponibles ─────────────────────────────────────────
const getCatalog = async () => {
  const { rows } = await db.query(
    `SELECT habit_id, name, description, icon_code, category,
            frequency, target_value, target_unit, xp_per_completion
     FROM habit_catalog
     WHERE is_active = TRUE
     ORDER BY category, name`
  );
  return rows;
};

// ─── Hábitos registrados por el niño en una fecha ────────────────────────────
const getHabitLogs = async (childId, date) => {
  const { rows } = await db.query(
    `SELECT
       hl.log_id, hl.habit_id, hc.name AS habit_name, hc.icon_code,
       hc.category, hc.target_value, hc.target_unit,
       hl.value_achieved, hl.is_completed, hl.xp_earned,
       hl.log_date, hl.source, hl.logged_at
     FROM habit_logs hl
     JOIN habit_catalog hc ON hc.habit_id = hl.habit_id
     WHERE hl.child_id = $1
       AND hl.log_date = $2
     ORDER BY hc.category, hc.name`,
    [childId, date]
  );
  return rows;
};

// ─── Historial mensual de un hábito ──────────────────────────────────────────
const getHabitHistory = async (childId, habitId, year, month) => {
  const { rows } = await db.query(
    `SELECT log_date, value_achieved, is_completed, xp_earned, source
     FROM habit_logs
     WHERE child_id  = $1
       AND habit_id  = $2
       AND DATE_TRUNC('month', log_date) = make_date($3, $4, 1)
     ORDER BY log_date`,
    [childId, habitId, year, month]
  );
  return rows;
};

// ─── Registrar o actualizar un hábito del día (UPSERT) ───────────────────────
const logHabit = async (childId, { habitId, logDate, valueAchieved, isCompleted, source }) => {
  // Verificar que el hábito existe y está activo
  const { rows: [habit] } = await db.query(
    `SELECT habit_id, name, xp_per_completion, target_value
     FROM habit_catalog
     WHERE habit_id = $1 AND is_active = TRUE`,
    [habitId]
  );
  if (!habit) {
    const err = new Error('Hábito no encontrado o inactivo');
    err.status = 404;
    throw err;
  }

  // Determinar si se completó según el valor alcanzado
  const completed = isCompleted ?? (
    habit.target_value != null
      ? parseFloat(valueAchieved || 0) >= parseFloat(habit.target_value)
      : false
  );

  const xpEarned = completed ? habit.xp_per_completion : null;

  // Calcular hash de integridad (RF-03)
  const integrityPayload = { childId, habitId, logDate, valueAchieved, isCompleted: completed };
  const integrityHash    = computeHash(integrityPayload);

  // UPSERT — una sola entrada por (child, habit, fecha)
  const { rows: [log] } = await db.query(
    `INSERT INTO habit_logs
       (child_id, habit_id, log_date, value_achieved, is_completed, xp_earned, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (child_id, habit_id, log_date)
     DO UPDATE SET
       value_achieved = EXCLUDED.value_achieved,
       is_completed   = EXCLUDED.is_completed,
       xp_earned      = EXCLUDED.xp_earned,
       source         = EXCLUDED.source,
       logged_at      = NOW()
     RETURNING log_id, habit_id, log_date, value_achieved, is_completed, xp_earned, logged_at`,
    [childId, habitId, logDate, valueAchieved ?? null, completed, xpEarned, source || 'manual']
  );

  logger.info('[HABIT] Hábito registrado', {
    childId, habitId, logDate, isCompleted: completed, xpEarned, integrityHash,
  });

  return { ...log, habit_name: habit.name, integrity_hash: integrityHash };
};

// ─── Resumen del mes: porcentaje de cumplimiento por hábito ──────────────────
const getMonthlyCompliance = async (childId, year, month) => {
  const { rows } = await db.query(
    `SELECT
       hc.habit_id, hc.name AS habit_name, hc.category, hc.icon_code,
       COUNT(*)                                                       AS days_logged,
       SUM(hl.is_completed::INT)                                      AS days_completed,
       ROUND(SUM(hl.is_completed::INT)::NUMERIC / COUNT(*) * 100, 1) AS compliance_pct,
       SUM(COALESCE(hl.xp_earned, 0))                                 AS xp_earned_total
     FROM habit_logs hl
     JOIN habit_catalog hc ON hc.habit_id = hl.habit_id
     WHERE hl.child_id = $1
       AND DATE_TRUNC('month', hl.log_date) = make_date($2, $3, 1)
     GROUP BY hc.habit_id, hc.name, hc.category, hc.icon_code
     ORDER BY compliance_pct DESC`,
    [childId, year, month]
  );
  return rows;
};

module.exports = { getCatalog, getHabitLogs, getHabitHistory, logHabit, getMonthlyCompliance };
