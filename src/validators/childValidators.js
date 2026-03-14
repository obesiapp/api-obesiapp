// src/validators/childValidators.js
'use strict';

const { body, query, param } = require('express-validator');

const createChildRules = [
  body('username')
    .trim().isLength({ min: 3, max: 50 })
    .withMessage('Username del niño: entre 3 y 50 caracteres'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Contraseña del niño: mínimo 8 caracteres'),

  body('nickname')
    .trim().isLength({ min: 2, max: 30 })
    .withMessage('Apodo: entre 2 y 30 caracteres'),

  body('ageRange')
    .isIn(['6-8', '9-10', '11-12'])
    .withMessage('Rango de edad inválido. Use: 6-8, 9-10 o 11-12'),

  body('avatarCode')
    .optional().trim().isLength({ max: 50 }),
];

const updateChildRules = [
  body('nickname')
    .optional().trim().isLength({ min: 2, max: 30 })
    .withMessage('Apodo: entre 2 y 30 caracteres'),

  body('avatar_code')
    .optional().trim().isLength({ max: 50 }),
];

const logHabitRules = [
  body('habitId').isUUID().withMessage('habitId inválido'),
  body('logDate').isDate({ format: 'YYYY-MM-DD' }).withMessage('logDate inválido. Formato: YYYY-MM-DD'),
  body('valueAchieved').optional().isFloat({ min: 0 }).withMessage('valueAchieved debe ser >= 0'),
  body('isCompleted').optional().isBoolean(),
  body('source').optional().isIn(['manual', 'sensor', 'system']),
];

const assignChallengeRules = [
  body('challengeId').isUUID().withMessage('challengeId inválido'),
];

const updateChallengeStatusRules = [
  body('status')
    .isIn(['in_progress', 'completed', 'abandoned'])
    .withMessage('Estado inválido. Use: in_progress, completed o abandoned'),
];

module.exports = {
  createChildRules,
  updateChildRules,
  logHabitRules,
  assignChallengeRules,
  updateChallengeStatusRules,
};
