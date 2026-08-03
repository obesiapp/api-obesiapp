// src/services/childService.js
// CRUD de perfiles de niños y consultas del dashboard
'use strict';

const db = require('../config/db');
const logger = require('../utils/logger');

const {
  MAX_CHILDREN_PER_GUARDIAN,
  BCRYPT_SALT_ROUNDS
} = require('../config/constants');

// ─── Obtener todos los hijos de un tutor ─────────────────────────────────────

const getChildrenByGuardian = async (guardianId) => {
  const { rows } = await db.query(
    `
    SELECT
      cp.child_id,
      cp.nickname,
      cp.age_range,
      cp.avatar_code,
      cp.current_xp,
      cp.streak_days,
      cp.is_active,
      lc.level_number,
      lc.name AS level_name,
      lc.badge_code AS level_badge,
      gc.permission_level,
      gc.status AS link_status
    FROM guardian_child gc
    JOIN child_profiles cp
      ON cp.child_id = gc.child_id
    JOIN level_catalog lc
      ON lc.level_id = cp.current_level_id
    WHERE gc.guardian_id = $1
      AND gc.status = 'active'
    ORDER BY cp.nickname
    `,
    [guardianId]
  );

  return rows;
};

// ─── Obtener perfil completo de un niño ──────────────────────────────────────

const getChildById = async (
  childId,
  guardianId = null
) => {
  let query = `
    SELECT
      cp.child_id,
      cp.nickname,
      cp.age_range,
      cp.avatar_code,
      cp.current_xp,
      cp.streak_days,
      cp.is_active,
      cp.created_at,
      lc.level_number,
      lc.name AS level_name,
      lc.badge_code,
      lc.max_xp - cp.current_xp AS xp_to_next_level
    FROM child_profiles cp
    JOIN level_catalog lc
      ON lc.level_id = cp.current_level_id
    WHERE cp.child_id = $1
  `;

  const params = [childId];

  if (guardianId) {
    query += `
      AND EXISTS (
        SELECT 1
        FROM guardian_child gc
        WHERE gc.child_id = cp.child_id
          AND gc.guardian_id = $2
          AND gc.status = 'active'
      )
    `;

    params.push(guardianId);
  }

  const { rows } = await db.query(
    query,
    params
  );

  if (!rows[0]) {
    const error = new Error(
      'Perfil de niño no encontrado'
    );

    error.status = 404;
    throw error;
  }

  return rows[0];
};

// ─── Crear perfil de niño ────────────────────────────────────────────────────

const createChild = async (
  guardianAccountId,
  {
    username,
    password,
    nickname,
    ageRange,
    avatarCode
  }
) => {
  const guardianResult = await db.query(
    `
    SELECT guardian_id
    FROM guardian_profiles
    WHERE account_id = $1
    `,
    [guardianAccountId]
  );

  if (guardianResult.rows.length === 0) {
    const error = new Error(
      'Perfil de tutor no encontrado'
    );

    error.status = 404;
    throw error;
  }

  const guardianId =
    guardianResult.rows[0].guardian_id;

  const countResult = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM guardian_child
    WHERE guardian_id = $1
      AND status = 'active'
    `,
    [guardianId]
  );

  const totalChildren = Number(
    countResult.rows[0].total
  );

  if (
    totalChildren >=
    MAX_CHILDREN_PER_GUARDIAN
  ) {
    const error = new Error(
      `No puedes tener más de ${MAX_CHILDREN_PER_GUARDIAN} perfiles de niño`
    );

    error.status = 409;
    throw error;
  }

  const bcrypt = require('bcryptjs');

  const passwordHash = await bcrypt.hash(
    password,
    BCRYPT_SALT_ROUNDS
  );

  const result = await db.withTransaction(
    async (client) => {
      const accountResult = await client.query(
        `
        INSERT INTO accounts (
          role,
          username,
          password_hash
        )
        VALUES (
          'child',
          $1,
          $2
        )
        RETURNING account_id
        `,
        [username, passwordHash]
      );

      const account =
        accountResult.rows[0];

      const childResult = await client.query(
        `
        INSERT INTO child_profiles (
          account_id,
          nickname,
          age_range,
          avatar_code
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
        RETURNING
          child_id,
          nickname,
          age_range,
          avatar_code,
          current_xp,
          streak_days
        `,
        [
          account.account_id,
          nickname,
          ageRange,
          avatarCode || null
        ]
      );

      const child = childResult.rows[0];

      await client.query(
        `
        INSERT INTO guardian_child (
          guardian_id,
          child_id,
          relationship_type,
          permission_level,
          status,
          linked_by
        )
        VALUES (
          $1,
          $2,
          'parent',
          'manage',
          'active',
          $3
        )
        `,
        [
          guardianId,
          child.child_id,
          guardianAccountId
        ]
      );

      await client.query(
        `
        INSERT INTO audit_log (
          event_type,
          actor_account_id,
          target_account_id,
          description,
          metadata
        )
        VALUES (
          'account_created',
          $1,
          $2,
          'Creación de perfil de niño',
          $3::jsonb
        )
        `,
        [
          guardianAccountId,
          account.account_id,
          JSON.stringify({
            role: 'child',
            nickname,
            ageRange
          })
        ]
      );

      return child;
    }
  );

  logger.info(
    '[CHILD] Perfil de niño creado',
    {
      childId: result.child_id,
      guardianAccountId
    }
  );

  return result;
};

// ─── Actualizar perfil de niño ───────────────────────────────────────────────

const updateChild = async (
  childId,
  guardianAccountId,
  updates
) => {
  const allowedFields = [
    'nickname',
    'avatar_code'
  ];

  const fields = Object.keys(updates)
    .filter((field) =>
      allowedFields.includes(field)
    );

  if (fields.length === 0) {
    const error = new Error(
      'No se proporcionaron campos válidos para actualizar'
    );

    error.status = 400;
    throw error;
  }

  const permissionResult = await db.query(
    `
    SELECT 1
    FROM guardian_child gc
    JOIN guardian_profiles gp
      ON gp.guardian_id = gc.guardian_id
    WHERE gc.child_id = $1
      AND gp.account_id = $2
      AND gc.status = 'active'
      AND gc.permission_level IN (
        'manage',
        'admin'
      )
    `,
    [
      childId,
      guardianAccountId
    ]
  );

  if (
    permissionResult.rowCount === 0
  ) {
    const error = new Error(
      'No tienes permiso para modificar este perfil'
    );

    error.status = 403;
    throw error;
  }

  const setClauses = fields
    .map(
      (field, index) =>
        `${field} = $${index + 1}`
    )
    .join(', ');

  const values = [
    ...fields.map(
      (field) => updates[field]
    ),
    childId
  ];

  const updateResult = await db.query(
    `
    UPDATE child_profiles
    SET ${setClauses}
    WHERE child_id = $${fields.length + 1}
    RETURNING
      child_id,
      nickname,
      age_range,
      avatar_code,
      updated_at
    `,
    values
  );

  logger.info(
    '[CHILD] Perfil actualizado',
    { childId }
  );

  return updateResult.rows[0];
};

// ─── Eliminar completamente el perfil del niño ──────────────────────────────

const deleteChild = async (
  childId,
  guardianAccountId
) => {
  const result = await db.withTransaction(
    async (client) => {
      const childResult = await client.query(
        `
        SELECT
          cp.child_id,
          cp.account_id,
          cp.nickname
        FROM child_profiles cp
        INNER JOIN guardian_child gc
          ON gc.child_id = cp.child_id
        INNER JOIN guardian_profiles gp
          ON gp.guardian_id = gc.guardian_id
        WHERE cp.child_id = $1
          AND gp.account_id = $2
          AND gc.status = 'active'
          AND gc.permission_level IN (
            'manage',
            'admin'
          )
        LIMIT 1
        `,
        [
          childId,
          guardianAccountId
        ]
      );

      if (
        childResult.rows.length === 0
      ) {
        const error = new Error(
          'Perfil de niño no encontrado o no tienes permiso para eliminarlo'
        );

        error.status = 404;
        throw error;
      }

      const child =
        childResult.rows[0];

      /*
       * Se intenta eliminar la cuenta.
       * Esto requiere que las relaciones tengan
       * ON DELETE CASCADE.
       */
      const deleteAccountResult =
        await client.query(
          `
          DELETE FROM accounts
          WHERE account_id = $1
            AND role = 'child'
          RETURNING account_id
          `,
          [child.account_id]
        );

      if (
        deleteAccountResult.rowCount === 0
      ) {
        const error = new Error(
          'No fue posible eliminar la cuenta del niño'
        );

        error.status = 404;
        throw error;
      }

      return {
        childId: child.child_id,
        nickname: child.nickname
      };
    }
  );

  logger.info(
    '[CHILD] Perfil de niño eliminado',
    {
      childId: result.childId,
      guardianAccountId
    }
  );

  return result;
};

// ─── Dashboard diario del niño ───────────────────────────────────────────────

const getDailyDashboard = async (
  childId,
  date = null
) => {
  const params = [childId];
  const dateSql = date
    ? '$2'
    : 'CURRENT_DATE';

  if (date) {
    params.push(date);
  }

  const { rows } = await db.query(
    `
    SELECT
      ds.summary_date,
      ds.xp_gained,
      ds.challenges_completed,
      ds.habits_completed,
      ds.habits_total,
      ROUND(
        ds.habits_completed::NUMERIC /
        NULLIF(ds.habits_total, 0) * 100,
        1
      ) AS habits_pct,
      ds.screen_time_minutes,
      ds.screen_limit_exceeded,
      ds.streak_days_at_date
    FROM daily_summary ds
    WHERE ds.child_id = $1
      AND ds.summary_date = ${dateSql}
    `,
    params
  );

  return rows[0] || null;
};

// ─── Tendencia semanal ───────────────────────────────────────────────────────

const getWeeklyTrend = async (
  childId,
  weeks = 8
) => {
  const { rows } = await db.query(
    `
    SELECT
      DATE_TRUNC(
        'week',
        ds.summary_date
      ) AS week_start,
      SUM(ds.xp_gained) AS xp_total,
      SUM(
        ds.challenges_completed
      ) AS challenges,
      ROUND(
        AVG(
          ds.habits_completed::NUMERIC /
          NULLIF(ds.habits_total, 0)
        ) * 100,
        1
      ) AS habits_pct
    FROM daily_summary ds
    WHERE ds.child_id = $1
      AND ds.summary_date >=
        CURRENT_DATE - ($2 * 7)
    GROUP BY 1
    ORDER BY 1 ASC
    `,
    [
      childId,
      weeks
    ]
  );

  return rows;
};

module.exports = {
  getChildrenByGuardian,
  getChildById,
  createChild,
  updateChild,
  deleteChild,
  getDailyDashboard,
  getWeeklyTrend
};