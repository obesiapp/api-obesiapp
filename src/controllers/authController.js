// src/controllers/authController.js
// Capa de presentación: recibe HTTP, delega al servicio, responde JSON
'use strict';

const authService = require('../services/authService');
const { success, error } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// POST /api/v1/auth/register
const register = async (req, res, next) => {
  try {
    const { username, email, password, displayName } = req.body;
    const account = await authService.register({ username, email, password, displayName });
    return success(res, { accountId: account.account_id, username: account.username },
      'Cuenta creada exitosamente', 201);
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/login
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login({ username, password, ip: req.ip });
    return success(res, result, 'Login exitoso', 200);
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/change-password  [protegido]
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.accountId, { currentPassword, newPassword });
    return success(res, null, 'Contraseña actualizada correctamente');
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/auth/me  [protegido]
const me = async (req, res, next) => {
  try {
    return success(res, req.user, 'Perfil del token');
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, changePassword, me };
