// src/routes/auth.routes.js
'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/authController');
const { verifyToken }                            = require('../middleware/auth');
const { loginLimiter }                           = require('../middleware/rateLimiter');
const { validate }                               = require('../middleware/validate');
const { registerRules, loginRules, changePasswordRules } = require('../validators/authValidators');

const router = Router();

/**
 * @route  POST /api/v1/auth/register
 * @desc   Registrar nuevo tutor
 * @access Público
 */
router.post('/register',
  registerRules,
  validate,
  ctrl.register
);

/**
 * @route  POST /api/v1/auth/login
 * @desc   Iniciar sesión y obtener JWT  (RF-02: limitado a 5 intentos)
 * @access Público
 */
router.post('/login',
  loginLimiter,
  loginRules,
  validate,
  ctrl.login
);

/**
 * @route  GET /api/v1/auth/me
 * @desc   Obtener datos del token actual
 * @access Privado
 */
router.get('/me',
  verifyToken,
  ctrl.me
);

/**
 * @route  POST /api/v1/auth/change-password
 * @desc   Cambiar contraseña (RF-02)
 * @access Privado
 */
router.post('/change-password',
  verifyToken,
  changePasswordRules,
  validate,
  ctrl.changePassword
);

module.exports = router;
