'use strict';

const { Router } = require('express');
const mlController = require('../controllers/mlController');
const { verifyToken } = require('../middleware/auth');

const router = Router();

router.use(verifyToken);

/**
 * =====================================
 * MODELO DE OBESIDAD
 * =====================================
 */

// Crear evaluación de salud
router.post(
  '/children/:childId/health-metrics',
  mlController.createHealthMetric
);

// Obtener última evaluación
router.get(
  '/children/:childId/health-metrics/latest',
  mlController.getLatestHealthMetric
);


/**
 * =====================================
 * QUIZ IA
 * =====================================
 */

// Generar quiz dinámico con IA
router.post(
  '/children/:childId/generate-quiz',
  mlController.generateQuiz
);

// Guardar resultado del quiz
router.post(
  '/children/:childId/quiz-result',
  mlController.saveQuizResult
);

module.exports = router;