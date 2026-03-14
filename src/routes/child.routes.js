// src/routes/child.routes.js
// Rutas de gestión de perfiles infantiles, hábitos y retos
'use strict';

const { Router }     = require('express');
const childCtrl      = require('../controllers/childController');
const habitCtrl      = require('../controllers/habitController');
const challengeCtrl  = require('../controllers/challengeController');
const { verifyToken }                = require('../middleware/auth');
const { authorize }                  = require('../middleware/authorize');
const { validate }                   = require('../middleware/validate');
const {
  createChildRules, updateChildRules,
  logHabitRules, assignChallengeRules, updateChallengeStatusRules,
} = require('../validators/childValidators');

const router = Router();

// Todos los endpoints de este router requieren autenticación
router.use(verifyToken);

// ─── Perfiles de niños ───────────────────────────────────────────────────────

/**
 * @route  GET /api/v1/children
 * @desc   Listar perfiles de niños del tutor autenticado
 * @access guardian
 */
router.get('/',
  authorize('read:children'),
  childCtrl.list
);

/**
 * @route  POST /api/v1/children
 * @desc   Crear nuevo perfil de niño (RF-01: sin email)
 * @access guardian
 */
router.post('/',
  authorize('read:children'),
  createChildRules,
  validate,
  childCtrl.create
);

/**
 * @route  GET /api/v1/children/:childId
 * @desc   Obtener perfil completo de un niño
 * @access guardian | child (propio)
 */
router.get('/:childId',
  childCtrl.getOne
);

/**
 * @route  PATCH /api/v1/children/:childId
 * @desc   Actualizar apodo o avatar del niño
 * @access guardian
 */
router.patch('/:childId',
  authorize('read:children'),
  updateChildRules,
  validate,
  childCtrl.update
);

/**
 * @route  GET /api/v1/children/:childId/dashboard
 * @desc   Resumen diario del niño para el dashboard del tutor
 * @access guardian
 */
router.get('/:childId/dashboard',
  authorize('read:dashboard'),
  childCtrl.dashboard
);

/**
 * @route  GET /api/v1/children/:childId/trend
 * @desc   Tendencia semanal de XP y hábitos
 * @access guardian
 */
router.get('/:childId/trend',
  authorize('read:dashboard'),
  childCtrl.trend
);

// ─── Hábitos ──────────────────────────────────────────────────────────────────

/**
 * @route  GET /api/v1/children/:childId/habits
 * @desc   Hábitos registrados en una fecha  ?date=YYYY-MM-DD
 * @access guardian | child
 */
router.get('/:childId/habits',
  habitCtrl.getLogs
);

/**
 * @route  POST /api/v1/children/:childId/habits
 * @desc   Registrar o actualizar un hábito del día (RF-03: genera hash SHA-256)
 * @access child | guardian
 */
router.post('/:childId/habits',
  authorize('write:habit_log'),
  logHabitRules,
  validate,
  habitCtrl.log
);

/**
 * @route  GET /api/v1/children/:childId/habits/compliance
 * @desc   Cumplimiento mensual de hábitos  ?year=&month=
 */
router.get('/:childId/habits/compliance',
  habitCtrl.compliance
);

/**
 * @route  GET /api/v1/children/:childId/habits/:habitId/history
 * @desc   Historial mensual de un hábito específico
 */
router.get('/:childId/habits/:habitId/history',
  habitCtrl.getHistory
);

// ─── Retos ───────────────────────────────────────────────────────────────────

/**
 * @route  GET /api/v1/children/:childId/challenges
 * @desc   Retos del niño  ?status=pending|in_progress|completed|abandoned
 */
router.get('/:childId/challenges',
  challengeCtrl.list
);

/**
 * @route  POST /api/v1/children/:childId/challenges
 * @desc   Asignar un reto al niño
 * @access guardian
 */
router.post('/:childId/challenges',
  authorize('read:children'),
  assignChallengeRules,
  validate,
  challengeCtrl.assign
);

/**
 * @route  PATCH /api/v1/children/:childId/challenges/:childChallengeId
 * @desc   Actualizar estado del reto
 */
router.patch('/:childId/challenges/:childChallengeId',
  updateChallengeStatusRules,
  validate,
  challengeCtrl.updateStatus
);

/**
 * @route  GET /api/v1/children/:childId/challenges/stats
 * @desc   Estadísticas de retos del niño
 */
router.get('/:childId/challenges/stats',
  challengeCtrl.stats
);

module.exports = router;
