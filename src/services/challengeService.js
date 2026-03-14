// src/services/challengeService.js
// Gestión de retos: catálogo, asignación y progreso
'use strict';

const db     = require('../config/db');
const logger = require('../utils/logger');
const { CHALLENGE_STATUS } = require('../config/constants');

// ─── Catálogo de retos activos (filtrado por rango de edad) ──────────────────
const getActiveChallenges = async ({ ageRange, category, difficulty } = {}) => {
  // Mapear rango de edad a número para filtrar
  const ageMap = { '6-8': 7, '9-10': 9, '11-12': 11 };
  const age    = ageMap[ageRange] || null;

  let query  = `
    SELECT challenge_id, title, description, category,
           difficulty, duration_minutes, xp_reward, min_age, max_age
    FROM challenge_catalog
    WHERE is_active = TRUE`;
  const params = [];

  if (age) {
    params.push(age);
    query += ` AND min_age <= $${params.length} AND max_age >= $${params.length}`;
  }
  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }
  if (difficulty) {
    params.push(difficulty);
    query += ` AND difficulty = $${params.length}`;
  }

  query += ` ORDER BY category, difficulty, xp_reward`;

  const { rows } = await db.query(query, params);
  return rows;
};

// ─── Retos del niño (con filtro de estado) ───────────────────────────────────
const getChildChallenges = async (childId, status = null) => {
  let query = `
    SELECT
      cc.child_challenge_id, cc.status,
      cc.assigned_at, cc.started_at, cc.completed_at, cc.xp_earned,
      ch.title, ch.description, ch.category, ch.difficulty,
      ch.duration_minutes, ch.xp_reward, ch.challenge_id
    FROM child_challenges cc
    JOIN challenge_catalog ch ON ch.challenge_id = cc.challenge_id
    WHERE cc.child_id = $1`;
  const params = [childId];

  if (status) {
    params.push(status);
    query += ` AND cc.status = $${params.length}`;
  }

  query += ` ORDER BY cc.assigned_at DESC`;

  const { rows } = await db.query(query, params);
  return rows;
};

// ─── Asignar un reto a un niño ───────────────────────────────────────────────
const assignChallenge = async (childId, challengeId) => {
  // Verificar que el reto existe y está activo
  const { rows: [challenge] } = await db.query(
    `SELECT challenge_id, title FROM challenge_catalog
     WHERE challenge_id = $1 AND is_active = TRUE`,
    [challengeId]
  );
  if (!challenge) {
    const err = new Error('Reto no encontrado o inactivo');
    err.status = 404;
    throw err;
  }

  // Evitar duplicados activos
  const { rowCount } = await db.query(
    `SELECT 1 FROM child_challenges
     WHERE child_id = $1 AND challenge_id = $2
       AND status IN ('pending','in_progress')`,
    [childId, challengeId]
  );
  if (rowCount > 0) {
    const err = new Error('Este reto ya está activo para el niño');
    err.status = 409;
    throw err;
  }

  const { rows: [assigned] } = await db.query(
    `INSERT INTO child_challenges (child_id, challenge_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING child_challenge_id, status, assigned_at`,
    [childId, challengeId]
  );

  logger.info('[CHALLENGE] Reto asignado', { childId, challengeId });
  return { ...assigned, title: challenge.title };
};

// ─── Actualizar estado de un reto ─────────────────────────────────────────────
const updateChallengeStatus = async (childId, childChallengeId, newStatus) => {
  const validTransitions = {
    [CHALLENGE_STATUS.PENDING]:     [CHALLENGE_STATUS.IN_PROGRESS, CHALLENGE_STATUS.ABANDONED],
    [CHALLENGE_STATUS.IN_PROGRESS]: [CHALLENGE_STATUS.COMPLETED,   CHALLENGE_STATUS.ABANDONED],
  };

  // Obtener el estado actual
  const { rows: [current] } = await db.query(
    `SELECT status FROM child_challenges
     WHERE child_challenge_id = $1 AND child_id = $2`,
    [childChallengeId, childId]
  );

  if (!current) {
    const err = new Error('Reto no encontrado');
    err.status = 404;
    throw err;
  }

  const allowed = validTransitions[current.status] || [];
  if (!allowed.includes(newStatus)) {
    const err = new Error(
      `Transición inválida: ${current.status} → ${newStatus}. Permitidas: ${allowed.join(', ')}`
    );
    err.status = 422;
    throw err;
  }

  const setFields = [`status = $1`];
  const params    = [newStatus];

  if (newStatus === CHALLENGE_STATUS.IN_PROGRESS) setFields.push(`started_at = NOW()`);
  if (newStatus === CHALLENGE_STATUS.COMPLETED)   setFields.push(`completed_at = NOW()`);

  params.push(childChallengeId, childId);

  const { rows: [updated] } = await db.query(
    `UPDATE child_challenges
     SET ${setFields.join(', ')}
     WHERE child_challenge_id = $${params.length - 1}
       AND child_id           = $${params.length}
     RETURNING child_challenge_id, status, started_at, completed_at, xp_earned`,
    params
  );

  logger.info('[CHALLENGE] Estado actualizado', { childChallengeId, newStatus, childId });
  return updated;
};

// ─── Estadísticas de retos del niño ──────────────────────────────────────────
const getChallengeStats = async (childId) => {
  const { rows: [stats] } = await db.query(
    `SELECT
       COUNT(*)                                           AS total_assigned,
       SUM((status='completed')::INT)                    AS completed,
       SUM((status='in_progress')::INT)                  AS in_progress,
       SUM((status='abandoned')::INT)                    AS abandoned,
       COALESCE(SUM(xp_earned), 0)                       AS total_xp_earned,
       ROUND(SUM((status='completed')::INT)::NUMERIC
             / NULLIF(COUNT(*), 0) * 100, 1)             AS completion_rate_pct
     FROM child_challenges
     WHERE child_id = $1`,
    [childId]
  );
  return stats;
};

module.exports = {
  getActiveChallenges,
  getChildChallenges,
  assignChallenge,
  updateChallengeStatus,
  getChallengeStats,
};
