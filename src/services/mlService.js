'use strict';

const db = require('../config/db');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const calculateBMI = (weightKg, heightCm) => {
  const heightM = Number(heightCm) / 100;

  if (!weightKg || !heightCm || heightM <= 0) {
    const error = new Error('Peso y estatura son obligatorios y deben ser válidos');
    error.status = 400;
    throw error;
  }

  return Number((Number(weightKg) / (heightM * heightM)).toFixed(2));
};

const createHealthMetric = async (childId, data) => {
  const { age, gender, weight_kg, height_cm } = data;

  const bmi = calculateBMI(weight_kg, height_cm);

  const payload = {
    age: Number(age),
    gender: String(gender).toLowerCase(),
    bmi
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

  const { rows } = await db.query(
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
    model: 'Random Forest - NHANES Child Obesity',
    prediction
  };
};

const getLatestHealthMetric = async (childId) => {
  const { rows } = await db.query(
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
    const error = new Error('No hay evaluación de salud registrada para este niño');
    error.status = 404;
    throw error;
  }

  return rows[0];
};

module.exports = {
  createHealthMetric,
  getLatestHealthMetric
};