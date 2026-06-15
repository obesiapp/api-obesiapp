'use strict';

const db = require('../config/db');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const getChildRisk = async (childId) => {
  const { rows } = await db.query(
    `
    SELECT
      cp.child_id,
      cp.age_range,
      cp.current_xp,
      cp.streak_days,
      cp.current_level_id,
      COALESCE(ds.screen_time_minutes, 0) AS screen_time_minutes,
      COALESCE(ds.habits_completed, 0) AS habits_completed,
      COALESCE(ds.habits_total, 1) AS habits_total,
      COALESCE(ds.challenges_completed, 0) AS challenges_completed
    FROM healthkids.child_profiles cp
    LEFT JOIN healthkids.daily_summary ds
      ON ds.child_id = cp.child_id
    WHERE cp.child_id = $1
    ORDER BY ds.summary_date DESC
    LIMIT 1
    `,
    [childId]
  );

  if (rows.length === 0) {
    const error = new Error('Niño no encontrado');
    error.status = 404;
    throw error;
  }

  const child = rows[0];

  const payload = {
    age_range: child.age_range,
    current_xp: Number(child.current_xp),
    streak_days: Number(child.streak_days),
    current_level_id: Number(child.current_level_id),
    screen_time_minutes: Number(child.screen_time_minutes),
    habits_completed: Number(child.habits_completed),
    habits_total: Number(child.habits_total),
    challenges_completed: Number(child.challenges_completed)
  };

  const response = await fetch(`${ML_SERVICE_URL}/predict-risk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = new Error('Error al consultar el modelo de Machine Learning');
    error.status = 500;
    throw error;
  }

  const prediction = await response.json();

  return {
    childId,
    inputData: payload,
    model: 'Random Forest',
    prediction
  };
};

module.exports = {
  getChildRisk
};