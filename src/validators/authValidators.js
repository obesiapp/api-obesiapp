// src/validators/authValidators.js
// Cadenas de validación con express-validator
'use strict';

const { body } = require('express-validator');

const registerRules = [
  body('username')
    .trim().isLength({ min: 3, max: 50 })
    .withMessage('El username debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Username solo puede contener letras, números, _ . -'),

  body('email')
    .trim().isEmail().normalizeEmail()
    .withMessage('Email inválido'),

  body('password')
    .isLength({ min: 10 })
    .withMessage('La contraseña debe tener al menos 10 caracteres'),

  body('displayName')
    .optional().trim().isLength({ min: 2, max: 80 })
    .withMessage('El nombre debe tener entre 2 y 80 caracteres'),

    // ── NUEVO: bloquear registro directo como child o admin ──
  body('role')
    .optional()
    .custom((value) => {
      if (value === 'child') {
        throw new Error(
          'RF-01 VIOLACIÓN: Los niños no pueden registrarse directamente. ' +
          'Deben ser creados por un tutor desde /children'
        );
      }
      if (value === 'admin') {
        throw new Error('No puedes registrarte como administrador');
      }
      return true;
    }),

  // ── NUEVO: bloquear email si el rol es child ──────────────
  body('email')
    .if(body('role').equals('child'))
    .isEmpty()
    .withMessage('RF-01 VIOLACIÓN: Los niños no pueden tener email'),

  body('username')
    .trim().isLength({ min: 3, max: 50 })
    .withMessage('El username debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Username solo puede contener letras, números, _ . -'),

  body('email')
    .trim().isEmail().normalizeEmail()
    .withMessage('Email inválido'),

  body('password')
    .isLength({ min: 10 })
    .withMessage('La contraseña debe tener al menos 10 caracteres'),

  body('displayName')
    .optional().trim().isLength({ min: 2, max: 80 })
    .withMessage('El nombre debe tener entre 2 y 80 caracteres'),
];


const loginRules = [
  body('username').trim().notEmpty().withMessage('Username o email requerido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Contraseña actual requerida'),
  body('newPassword').isLength({ min: 10 }).withMessage('Nueva contraseña: mínimo 10 caracteres'),
];

module.exports = { registerRules, loginRules, changePasswordRules };
