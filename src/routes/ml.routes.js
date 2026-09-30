'use strict';

const { Router } = require('express');
const mlController = require('../controllers/mlController');
const { verifyToken } = require('../middleware/auth');
const gameProgressService = require('../services/gameProgressService');
const childService = require('../services/childService');

const router = Router();

router.use(verifyToken);

// Verificar acceso al perfil en las rutas /children/:childId.
router.use('/children/:childId', async (req, res, next) => {
  try {
    const { childId } = req.params;
    const user = req.user;

    if (user.role === 'child' && user.childId !== childId) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes acceso a este perfil'
      });
    }

    if (
      !['admin', 'child'].includes(user.role) &&
      !user.guardianId
    ) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes acceso a este perfil'
      });
    }

    await childService.getChildById(
      childId,
      user.role === 'guardian' ? user.guardianId : null
    );

    next();
  } catch (error) {
    next(error);
  }
});

// Consultar niveles y trofeos del niño.
router.get('/children/:childId/game-progress', async (req, res, next) => {
  try {
    const progress = await gameProgressService.getProgress(
      req.params.childId
    );

    res.status(200).json({
      success: true,
      data: progress
    });
  } catch (error) {
    next(error);
  }
});

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

router.get(
  '/daily-summary/:childId',
  mlController.getDailySummary
);


module.exports = router;