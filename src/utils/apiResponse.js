// src/utils/apiResponse.js
// Formatos de respuesta estandarizados para la API REST
'use strict';

/**
 * Respuesta de éxito.
 * @param {Response} res
 * @param {*}        data    - Payload principal
 * @param {string}   message - Mensaje descriptivo
 * @param {number}   status  - Código HTTP (default 200)
 * @param {object}   meta    - Metadatos opcionales (paginación, etc.)
 */
const success = (res, data, message = 'OK', status = 200, meta = null) => {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
};

/**
 * Respuesta de error.
 */
const error = (res, message = 'Error interno del servidor', status = 500, details = null) => {
  const body = { success: false, error: { message } };
  if (details && process.env.NODE_ENV !== 'production') body.error.details = details;
  return res.status(status).json(body);
};

/**
 * Respuesta paginada.
 */
const paginated = (res, data, { total, page, limit }) => {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      total,
      page:       parseInt(page),
      limit:      parseInt(limit),
      totalPages: Math.ceil(total / limit),
    },
  });
};

module.exports = { success, error, paginated };
