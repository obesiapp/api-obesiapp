'use strict';

const { Router } = require('express');
const mlController = require('../controllers/mlController');
const { verifyToken } = require('../middleware/auth');

const router = Router();

router.use(verifyToken);

// =====================================
// MODELO DE OBESIDAD
// =====================================

router.post(
  '/children/:childId/health-metrics',
  mlController.createHealthMetric
);

router.get(
  '/children/:childId/health-metrics/latest',
  mlController.getLatestHealthMetric
);

// =====================================
// QUIZ IA
// =====================================

router.post(
  '/children/:childId/generate-quiz',
  mlController.generateQuiz
);

router.post(
  '/children/:childId/quiz-result',
  mlController.saveQuizResult
);

// =====================================
// ANÁLISIS DE PATRONES
// =====================================

router.post(
  '/daily-summary/:summaryId/analyze-pattern',
  mlController.analyzeDailyPattern
);

module.exports = router;