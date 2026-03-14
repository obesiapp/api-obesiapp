// src/utils/passwordValidator.js
// RF-02 — Validación de fortaleza de contraseña
'use strict';

const RULES = [
  { test: p => p.length >= 10,          msg: 'Mínimo 10 caracteres' },
  { test: p => /[A-Z]/.test(p),         msg: 'Al menos una mayúscula' },
  { test: p => /[a-z]/.test(p),         msg: 'Al menos una minúscula' },
  { test: p => /\d/.test(p),            msg: 'Al menos un número' },
  { test: p => /[!@#$%^&*_\-.]/.test(p),msg: 'Al menos un carácter especial (!@#$%^&*_-.)' },
];

/**
 * Lanza un Error si la contraseña no cumple las reglas de seguridad.
 * @param {string} password
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('La contraseña es requerida');
  }
  const errors = RULES.filter(r => !r.test(password)).map(r => r.msg);
  if (errors.length > 0) {
    throw new Error('Contraseña insegura: ' + errors.join(', '));
  }
}

module.exports = { validatePassword };
