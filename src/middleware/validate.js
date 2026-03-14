// src/middleware/validate.js
// Helper para validar con express-validator y retornar errores estandarizados
'use strict';

const { validationResult } = require('express-validator');
const { error }            = require('../utils/apiResponse');

/**
 * Middleware que lee los errores de express-validator y los retorna como JSON.
 * Usar DESPUÉS de los chains de validación.
 *
 * @example
 *   router.post('/', [body('email').isEmail(), validate], controller.create)
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, 'Datos de entrada inválidos', 422, errors.array());
  }
  next();
};

module.exports = { validate };
