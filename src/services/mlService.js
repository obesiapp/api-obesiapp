'use strict';

const db = require('../config/db');

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL ||
  'http://localhost:8000';

const createValidationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const calculateBMI = (weightKg, heightCm) => {
  const weight = Number(weightKg);
  const height = Number(heightCm);
  const heightM = height / 100;

  if (!weight || !height || heightM <= 0) {
    throw createValidationError(
      'Peso y estatura son obligatorios y deben ser válidos.'
    );
  }

  return Number((weight / (heightM * heightM)).toFixed(2));
};

const getAgeRangeLimits = (age) => {
  if (age >= 6 && age <= 8) {
    return {
      minHeight: 100,
      maxHeight: 150,
      minWeight: 15,
      maxWeight: 65
    };
  }

  if (age >= 9 && age <= 10) {
    return {
      minHeight: 115,
      maxHeight: 170,
      minWeight: 20,
      maxWeight: 85
    };
  }

  if (age >= 11 && age <= 12) {
    return {
      minHeight: 125,
      maxHeight: 185,
      minWeight: 25,
      maxWeight: 110
    };
  }

  return {
    minHeight: 90,
    maxHeight: 190,
    minWeight: 12,
    maxWeight: 120
  };
};

const validateHealthMetricInput = (data) => {
  const age = Number(data.age);
  const weight = Number(data.weight_kg);
  const height = Number(data.height_cm);
  const gender = String(data.gender || '').toLowerCase();

  if (!age || age < 6 || age > 12) {
    throw createValidationError(
      'La edad debe estar entre 6 y 12 años.'
    );
  }

  if (!['male', 'female'].includes(gender)) {
    throw createValidationError(
      'El género debe ser masculino o femenino.'
    );
  }

  if (!weight || weight <= 0) {
    throw createValidationError(
      'El peso es obligatorio y debe ser mayor a 0.'
    );
  }

  if (!height || height <= 0) {
    throw createValidationError(
      'La estatura es obligatoria y debe ser mayor a 0.'
    );
  }

  const limits = getAgeRangeLimits(age);

  if (height < limits.minHeight || height > limits.maxHeight) {
    throw createValidationError(
      `La estatura para ${age} años debe estar entre ${limits.minHeight} y ${limits.maxHeight} cm.`
    );
  }

  if (weight < limits.minWeight || weight > limits.maxWeight) {
    throw createValidationError(
      `El peso para ${age} años debe estar entre ${limits.minWeight} y ${limits.maxWeight} kg.`
    );
  }

  const bmi = calculateBMI(weight, height);

  if (bmi < 10 || bmi > 45) {
    throw createValidationError(
      'Los datos ingresados parecen incorrectos. Revisa peso y estatura.'
    );
  }

  return {
    age,
    gender,
    weight_kg: weight,
    height_cm: height,
    bmi
  };
};

const getRiskRecommendation = (riskLevel) => {
  switch (riskLevel) {
    case 'bajo':
      return {
        title: 'Riesgo bajo',
        message: 'Mantén hábitos saludables y actividad física diaria.',
        suggestions: [
          'Continuar con retos de movimiento.',
          'Mantener consumo de agua natural.',
          'Dormir adecuadamente.'
        ]
      };

    case 'medio':
      return {
        title: 'Riesgo medio',
        message: 'Se recomienda reforzar hábitos saludables.',
        suggestions: [
          'Reducir bebidas azucaradas.',
          'Aumentar actividad física diaria.',
          'Supervisar tiempo de pantalla.'
        ]
      };

    case 'alto':
      return {
        title: 'Riesgo alto',
        message: 'Se recomienda seguimiento cercano del tutor y orientación profesional.',
        suggestions: [
          'Consultar a un profesional de salud.',
          'Promover actividad física ligera y constante.',
          'Revisar hábitos de alimentación y descanso.'
        ]
      };

    default:
      return {
        title: 'Sin clasificación',
        message: 'No fue posible generar recomendaciones.',
        suggestions: []
      };
  }
};

// =====================================
// MODELO DE OBESIDAD
// =====================================

const createHealthMetric = async (childId, data) => {
  const validatedData = validateHealthMetricInput(data);

  const {
    age,
    gender,
    weight_kg,
    height_cm,
    bmi
  } = validatedData;

  const payload = {
    age,
    gender,
    bmi
  };

  const response = await fetch(
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
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8
    )
    RETURNING *
    `,
    [
      childId,
      age,
      gender,
      weight_kg,
      height_cm,
      bmi,
      prediction.risk,
      prediction.confidence
    ]
  );

  return {
    metric: rows[0],
    model: 'Random Forest - NHANES Child Obesity',
    prediction,
    recommendation: getRiskRecommendation(prediction.risk)
  };
};

// =====================================
// OBTENER ÚLTIMA MÉTRICA
// =====================================

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

const generateQuiz = async (childId, topic) => {
  const child = await db.query(
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
    const error = new Error('Niño no encontrado');
    error.status = 404;
    throw error;
  }

  const profile = child.rows[0];

  const payload = {
    age_range: profile.age_range,
    level: profile.current_level_id,
    topic
  };

  const response = await fetch(
    `${ML_SERVICE_URL}/generate-quiz`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const error = new Error('Error generando quiz con IA');
    error.status = 500;
    throw error;
  }

  return await response.json();
};

// =====================================
// GUARDAR RESULTADO QUIZ
// =====================================

const saveQuizResult = async (childId, result) => {
  const {
    topic,
    score,
    totalQuestions,
    percentage,
    xpEarned
  } = result;

  const { rows } = await db.query(
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
    SET current_xp = current_xp + $1
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
// ANÁLISIS DE PATRONES
// =====================================

const analyzeDailyPattern = async (summaryId, data) => {

  console.log("===== ANALYZE DAILY PATTERN =====");
  console.log("summaryId:", summaryId);
  console.log("data:", data);

  const {
    screen_time_minutes,
    challenges_completed,
    habits_completed,
    streak_days
  } = data;

  const payload = {
    screen_time_minutes: Number(screen_time_minutes || 0),
    challenges_completed: Number(challenges_completed || 0),
    habits_completed: Number(habits_completed || 0),
    streak_days: Number(streak_days || 0)
  };

  console.log("Payload enviado a Python:", payload);

  const response = await fetch(
    `${ML_SERVICE_URL}/analizar-patron`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  console.log("Status Python:", response.status);

  if (!response.ok) {

  const detalle = await response.text();

  console.error("STATUS:", response.status);
  console.error("RESPUESTA PYTHON:", detalle);

  const error = new Error(
    "Error al consultar el modelo de clustering de IA"
  );

  error.status = 500;
  throw error;
}

  const result = await response.json();

  console.log("Resultado IA:", result);

  const clusterId = result.ml_cluster_id;

  const { rows } = await db.query(
    `
    UPDATE healthkids.daily_summary
    SET ml_cluster_id = $1
    WHERE summary_id = $2
    RETURNING *
    `,
    [clusterId, summaryId]
  );

  return {
    success: true,
    cluster_id: clusterId,
    message: result.mensaje,
    updated_summary: rows[0]
  };
};

const getDailySummary = async (childId) => {

  try{

    let { rows } = await db.query(
      `
      SELECT *
      FROM healthkids.daily_summary
      WHERE child_id = $1
      AND summary_date = CURRENT_DATE
      LIMIT 1
      `,
      [childId]
    );

    // Si no existe el resumen del día, se crea automáticamente
    if(rows.length === 0){

      await db.query(
        `
        INSERT INTO healthkids.daily_summary
        (
          child_id,
          summary_date,
          xp_gained,
          challenges_completed,
          habits_completed,
          habits_total,
          screen_time_minutes,
          screen_limit_exceeded,
          streak_days_at_date,
          computed_at,
          water_intake,
          physical_activity_minutes,
          junk_food_portions,
          ml_cluster_id
        )
        VALUES
        (
          $1,
          CURRENT_DATE,
          0,
          0,
          0,
          0,
          0,
          false,
          0,
          NOW(),
          0,
          0,
          0,
          NULL
        )
        `,
        [childId]
      );

      ({rows} = await db.query(
        `
        SELECT *
        FROM healthkids.daily_summary
        WHERE child_id = $1
        AND summary_date = CURRENT_DATE
        LIMIT 1
        `,
        [childId]
      ));

    }

    return rows[0];

  }catch(error){

    console.error("Error en getDailySummary:", error);
    throw error;

  }

};

// =====================================
// EXPORTS
// =====================================

module.exports = {
  createHealthMetric,
  getLatestHealthMetric,
  generateQuiz,
  saveQuizResult,
  getDailySummary,
  analyzeDailyPattern
};