// src/config/db.js
// Conexión al pool de PostgreSQL con pg
// Gestiona reconexiones, timeouts y búsqueda del esquema healthkids

'use strict';

const { Pool } = require('pg');
require('dotenv').config();

// ─── Configuración del pool ──────────────────────────────────────────────────
const pool = new Pool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 5434,
  database:           process.env.DB_NAME     || 'healthkids_db',
  user:               process.env.DB_USER     || 'postgres',
  password:           process.env.DB_PASSWORD || '0404',
  min:                parseInt(process.env.DB_POOL_MIN)            || 2,
  max:                parseInt(process.env.DB_POOL_MAX)            || 10,
  idleTimeoutMillis:  parseInt(process.env.DB_IDLE_TIMEOUT)        || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
});

// ─── Fijar el search_path al esquema healthkids en cada nueva conexión ───────
pool.on('connect', (client) => {
  client.query(`SET search_path = ${process.env.DB_SCHEMA || 'healthkids'}, public`);
});

pool.on('error', (err) => {
  console.error('[DB] Error inesperado en el pool de conexiones:', err.message);
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Ejecuta una query simple.
 * @param {string} text   - Sentencia SQL con placeholders $1, $2, ...
 * @param {Array}  params - Valores de los parámetros
 */
const query = (text, params) => pool.query(text, params);

/**
 * Obtiene un cliente del pool para transacciones manuales.
 * IMPORTANTE: siempre llamar a client.release() en el bloque finally.
 */
const getClient = () => pool.connect();

/**
 * Ejecuta un bloque de sentencias dentro de una transacción.
 * Hace ROLLBACK automático si ocurre un error.
 * @param {Function} fn - async (client) => { ... }
 */
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Verifica la conexión a la base de datos.
 * Usada por el endpoint /health.
 */
const testConnection = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
};

module.exports = { query, getClient, withTransaction, testConnection, pool };
