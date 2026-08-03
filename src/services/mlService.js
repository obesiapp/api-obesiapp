'use strict';

const db = require('../config/db');

const ML_SERVICE_URL = (
  process.env.ML_SERVICE_URL ||
  'http://localhost:8000'
).trim().replace(/\/+$/, '');

console.log('[ML] Servicio configurado:', ML_SERVICE_URL);

// =====================================
// UTILIDADES
// =====================================

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

const validateHealthMetricInput = (data = {}) => {
  const age = Number(data.age);
  const weight = Number(data.weight_kg);
  const height = Number(data.height_cm);
  const gender = String(data.gender || '')
    .trim()
    .toLowerCase();

  if (!Number.isFinite(age) || age < 6 || age > 12) {
    throw createValidationError(
      'La edad debe estar entre 6 y 12 años.'
    );
  }

  if (!['male', 'female'].includes(gender)) {
    throw createValidationError(
      'El género debe ser masculino o femenino.'
    );
  }

  if (!Number.isFinite(weight) || weight <= 0) {
    throw createValidationError(
      'El peso es obligatorio y debe ser mayor a 0.'
    );
  }

  if (!Number.isFinite(height) || height <= 0) {
    throw createValidationError(
      'La estatura es obligatoria y debe ser mayor a 0.'
    );
  }

  const limits = getAgeRangeLimits(age);

  if (
    height < limits.minHeight ||
    height > limits.maxHeight
  ) {
    throw createValidationError(
      `La estatura para ${age} años debe estar entre ${limits.minHeight} y ${limits.maxHeight} cm.`
    );
  }

  if (
    weight < limits.minWeight ||
    weight > limits.maxWeight
  ) {
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
        message:
          'Mantén hábitos saludables y actividad física diaria.',
        suggestions: [
          'Continuar con retos de movimiento.',
          'Mantener consumo de agua natural.',
          'Dormir adecuadamente.'
        ]
      };

    case 'medio':
      return {
        title: 'Riesgo medio',
        message:
          'Se recomienda reforzar hábitos saludables.',
        suggestions: [
          'Reducir bebidas azucaradas.',
          'Aumentar actividad física diaria.',
          'Supervisar tiempo de pantalla.'
        ]
      };

    case 'alto':
      return {
        title: 'Riesgo alto',
        message:
          'Se recomienda seguimiento cercano del tutor y orientación profesional.',
        suggestions: [
          'Consultar a un profesional de salud.',
          'Promover actividad física ligera y constante.',
          'Revisar hábitos de alimentación y descanso.'
        ]
      };

    default:
      return {
        title: 'Sin clasificación',
        message:
          'No fue posible generar recomendaciones.',
        suggestions: []
      };
  }
};

const requestMLService = async (
  endpointPath,
  payload,
  timeoutMs = 60000
) => {
  const endpoint = `${ML_SERVICE_URL}${endpointPath}`;

  console.log('[ML] Consultando servicio:', {
    endpoint,
    payload
  });

  let response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (fetchError) {
    console.error('[ML] Error de conexión con FastAPI:', {
      endpoint,
      message: fetchError.message,
      cause: fetchError.cause
    });

    const error = new Error(
      'No fue posible conectar con el servicio de Machine Learning'
    );

    error.status = 503;
    throw error;
  }

  const responseText = await response.text();

  console.log('[ML] Respuesta de FastAPI:', {
    endpoint,
    status: response.status,
    statusText: response.statusText,
    body: responseText
  });

  if (!response.ok) {
    console.error('[ML] FastAPI respondió con error:', {
      endpoint,
      status: response.status,
      body: responseText
    });

    const error = new Error(
      `El servicio de Machine Learning respondió con código ${response.status}`
    );

    error.status = 502;
    error.details = responseText;
    throw error;
  }

  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    console.error('[ML] FastAPI devolvió JSON inválido:', {
      endpoint,
      body: responseText,
      message: parseError.message
    });

    const error = new Error(
      'El servicio de Machine Learning devolvió una respuesta inválida'
    );

    error.status = 502;
    throw error;
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

  const prediction = await requestMLService(
    '/predict-risk',
    payload
  );

  if (
    !prediction.risk ||
    prediction.confidence === undefined ||
    prediction.confidence === null
  ) {
    console.error('[ML] Predicción incompleta:', prediction);

    const error = new Error(
      'La respuesta del modelo no contiene la clasificación esperada'
    );

    error.status = 502;
    throw error;
  }

  console.log('[ML] Predicción obtenida:', prediction);

  let rows;

  try {
    const result = await db.query(
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

    rows = result.rows;
  } catch (databaseError) {
    console.error('[ML] Error al guardar health_metrics:', {
      childId,
      code: databaseError.code,
      message: databaseError.message,
      detail: databaseError.detail,
      table: databaseError.table,
      column: databaseError.column,
      constraint: databaseError.constraint
    });

    const error = new Error(
      'La predicción se generó, pero no pudo guardarse en la base de datos'
    );

    error.status = 500;
    throw error;
  }

  return {
    metric: rows[0],
    model: 'Random Forest - NHANES Child Obesity',
    prediction,
    recommendation:
      getRiskRecommendation(prediction.risk)
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

  return requestMLService(
    '/generate-quiz',
    payload,
    60000
  );
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

const analyzeDailyPattern = async (
  summaryId,
  data = {}
) => {
  console.log('[ML] Analyze daily pattern:', {
    summaryId,
    data
  });

  const {
    screen_time_minutes,
    challenges_completed,
    habits_completed,
    streak_days
  } = data;

  const payload = {
    screen_time_minutes: Number(
      screen_time_minutes || 0
    ),
    challenges_completed: Number(
      challenges_completed || 0
    ),
    habits_completed: Number(
      habits_completed || 0
    ),
    streak_days: Number(
      streak_days || 0
    )
  };

  const result = await requestMLService(
    '/analizar-patron',
    payload
  );

  const clusterId = result.ml_cluster_id;

  if (
    clusterId === undefined ||
    clusterId === null
  ) {
    console.error(
      '[ML] Respuesta de clustering incompleta:',
      result
    );

    const error = new Error(
      'El modelo de clustering no devolvió un identificador válido'
    );

    error.status = 502;
    throw error;
  }

  const { rows } = await db.query(
    `
    UPDATE healthkids.daily_summary
    SET ml_cluster_id = $1
    WHERE summary_id = $2
    RETURNING *
    `,
    [clusterId, summaryId]
  );

  if (rows.length === 0) {
    const error = new Error(
      'No se encontró el resumen diario solicitado'
    );

    error.status = 404;
    throw error;
  }

  return {
    success: true,
    cluster_id: clusterId,
    message:
      result.mensaje ||
      'Patrón diario analizado correctamente',
    updated_summary: rows[0]
  };
};

// =====================================
// RESUMEN DIARIO
// =====================================

const getDailySummary = async (childId) => {
  try {
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

    if (rows.length === 0) {
      await db.query(
        `
        INSERT INTO healthkids.daily_summary (
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
        VALUES (
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

      const result = await db.query(
        `
        SELECT *
        FROM healthkids.daily_summary
        WHERE child_id = $1
          AND summary_date = CURRENT_DATE
        LIMIT 1
        `,
        [childId]
      );

      rows = result.rows;
    }

    return rows[0];
  } catch (error) {
    console.error(
      '[ML] Error en getDailySummary:',
      error
    );

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