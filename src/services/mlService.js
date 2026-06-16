'use strict';

const db = require('../config/db');

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL ||
  'http://localhost:8000';

const calculateBMI = (weightKg, heightCm) => {

  const heightM = Number(heightCm) / 100;

  if (!weightKg || !heightCm || heightM <= 0) {

    const error = new Error(
      'Peso y estatura son obligatorios y deben ser válidos'
    );

    error.status = 400;

    throw error;
  }

  return Number(
    (
      Number(weightKg) /
      (heightM * heightM)
    ).toFixed(2)
  );
};


// =====================================
// MODELO DE OBESIDAD (YA EXISTENTE)
// =====================================

const createHealthMetric = async (
  childId,
  data
) => {

  const {
    age,
    gender,
    weight_kg,
    height_cm
  } = data;

  const bmi = calculateBMI(
    weight_kg,
    height_cm
  );

  const payload = {
    age: Number(age),
    gender: String(gender).toLowerCase(),
    bmi
  };

  const response =
    await fetch(
      `${ML_SERVICE_URL}/predict-risk`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

  if (!response.ok) {

    const error = new Error(
      'Error al consultar el modelo de Machine Learning'
    );

    error.status = 500;

    throw error;
  }

  const prediction =
    await response.json();

  const { rows } =
    await db.query(
      `
      INSERT INTO healthkids.health_metrics (
        child_id,
        age,
        gender,
        weight_kg,
        height_cm,
        bmi,
        risk_level,
        prediction_confidence
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      RETURNING *
      `,
      [
        childId,
        Number(age),
        String(gender).toLowerCase(),
        Number(weight_kg),
        Number(height_cm),
        bmi,
        prediction.risk,
        prediction.confidence
      ]
    );

  return {
    metric: rows[0],
    model:
      'Random Forest - NHANES Child Obesity',
    prediction
  };
};


// =====================================
// OBTENER ÚLTIMA MÉTRICA
// =====================================

const getLatestHealthMetric =
async (childId) => {

  const { rows } =
    await db.query(
      `
      SELECT *
      FROM healthkids.health_metrics
      WHERE child_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [childId]
    );

  if (rows.length === 0) {

    const error = new Error(
      'No hay evaluación de salud registrada para este niño'
    );

    error.status = 404;

    throw error;
  }

  return rows[0];
};


// =====================================
// NUEVO QUIZ IA
// =====================================

const generateQuiz = async (
  childId,
  topic
) => {

  const child =
    await db.query(
      `
      SELECT
        child_id,
        age_range,
        current_level_id
      FROM healthkids.child_profiles
      WHERE child_id = $1
      `,
      [childId]
    );

  if (child.rows.length === 0) {

    const error = new Error(
      'Niño no encontrado'
    );

    error.status = 404;

    throw error;
  }

  const profile =
    child.rows[0];

  const payload = {
    age_range:
      profile.age_range,

    level:
      profile.current_level_id,

    topic
  };

  const response =
    await fetch(
      `${ML_SERVICE_URL}/generate-quiz`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body:
          JSON.stringify(payload)
      }
    );

  if (!response.ok) {

    const error = new Error(
      'Error generando quiz con IA'
    );

    error.status = 500;

    throw error;
  }

  return await response.json();
};


// =====================================
// GUARDAR RESULTADO QUIZ
// =====================================

const saveQuizResult = async (
  childId,
  result
) => {

  const {
    topic,
    score,
    totalQuestions,
    percentage,
    xpEarned
  } = result;

  const { rows } =
    await db.query(
      `
      INSERT INTO healthkids.quiz_attempts (
        child_id,
        topic,
        difficulty,
        score,
        total_questions,
        percentage,
        xp_earned
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7
      )
      RETURNING *
      `,
      [
        childId,
        topic,
        'dynamic',
        score,
        totalQuestions,
        percentage,
        xpEarned
      ]
    );

  await db.query(
    `
    UPDATE healthkids.child_profiles
    SET current_xp =
      current_xp + $1
    WHERE child_id = $2
    `,
    [
      xpEarned,
      childId
    ]
  );

  return rows[0];
};


// =====================================
// EXPORTS
// =====================================

module.exports = {

  // obesidad
  createHealthMetric,
  getLatestHealthMetric,

  // quiz IA
  generateQuiz,
  saveQuizResult
};