// src/utils/integrity.js
// RF-03 — Integridad de datos mediante checksum SHA-256
'use strict';

const crypto = require('crypto');
const logger = require('./logger');

/**
 * Calcula el hash SHA-256 de un objeto JSON.
 * Las claves se ordenan alfabéticamente para garantizar determinismo.
 * @param {object} data
 * @returns {string} hex digest de 64 caracteres
 */
const computeHash = (data) => {
  const sorted  = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(sorted).digest('hex');
};

/**
 * Verifica que el hash almacenado coincida con el hash calculado del objeto.
 * Lanza un error si detecta alteración.
 * @param {object} originalData   - Campos críticos tal como se leen de BD
 * @param {string} storedHash     - Hash almacenado en el registro
 */
const verifyIntegrity = (originalData, storedHash) => {
  const calculated = computeHash(originalData);
  if (calculated !== storedHash) {
    logger.error('[INTEGRITY] ALERTA — Datos alterados detectados', { originalData });
    const err = new Error('Violación de integridad: el registro ha sido modificado');
    err.status = 422;
    throw err;
  }
  return true;
};

module.exports = { computeHash, verifyIntegrity };
