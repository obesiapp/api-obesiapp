// src/app.js
// Fábrica de la aplicación Express — sin lógica de servidor HTTP/HTTPS
// (eso va en server.js para que sea testeable por separado)
'use strict';

require('dotenv').config();

const express        = require('express');
const helmet         = require('helmet');
const cors           = require('cors');
const morgan         = require('morgan');

const apiRoutes      = require('./routes/index');
const healthRoutes   = require('./routes/health.routes');
const { globalLimiter }  = require('./middleware/rateLimiter');
const { errorHandler }   = require('./middleware/errorHandler');
const logger             = require('./utils/logger');

const app = express();

// ─── 1. Cabeceras de seguridad HTTP (RF-01) ──────────────────────────────────
app.use(helmet());
app.use(helmet.hsts({ maxAge: 31_536_000, includeSubDomains: true }));

// ─── 2. CORS — solo orígenes autorizados ─────────────────────────────────────
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.CORS_ORIGINS_PROD || '').split(',')
  : [process.env.CORS_ORIGIN || 'proyecto-osb-app.vercel.app'];

app.use(cors({
  origin: (origin, cb) => {
    // Permitir sin origin (Postman, curl, mobile) en desarrollo
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials:     true,
  allowedHeaders:  ['Content-Type', 'Authorization'],
  exposedHeaders:  ['X-Total-Count'],
  methods:         ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ─── 3. Parsers ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));

// ─── 4. Logging HTTP ─────────────────────────────────────────────────────────
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ─── 5. Rate limiting global (RF-05 — anti DoS) ──────────────────────────────
app.use(globalLimiter);

// ─── 6. Confianza en proxy (necesario para req.ip correcto con nginx) ─────────
app.set('trust proxy', 1);

// ─── 7. Rutas ─────────────────────────────────────────────────────────────────
app.use('/health',      healthRoutes);        // pública — monitoreo RF-05
app.use('/api/v1',      apiRoutes);           // rutas versionadas

// ─── 8. 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` },
  });
});

// ─── 9. Manejador central de errores (RF-05) ──────────────────────────────────
app.use(errorHandler);

module.exports = app;
