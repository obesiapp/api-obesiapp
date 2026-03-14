// src/utils/logger.js
// Logger estructurado en JSON para producción y legible para desarrollo
'use strict';

const isDev = process.env.NODE_ENV !== 'production';

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = levels[process.env.LOG_LEVEL || 'debug'] ?? 3;

function log(level, message, meta = {}) {
  if (levels[level] > currentLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level:     level.toUpperCase(),
    message,
    ...meta,
  };

  if (isDev) {
    const colors = { ERROR:'\x1b[31m', WARN:'\x1b[33m', INFO:'\x1b[36m', DEBUG:'\x1b[90m' };
    const reset  = '\x1b[0m';
    const color  = colors[entry.level] || '';
    console.log(`${color}[${entry.timestamp}] [${entry.level}] ${message}${reset}`,
      Object.keys(meta).length ? meta : '');
  } else {
    console.log(JSON.stringify(entry));
  }
}

module.exports = {
  error: (msg, meta)  => log('error', msg, meta),
  warn:  (msg, meta)  => log('warn',  msg, meta),
  info:  (msg, meta)  => log('info',  msg, meta),
  debug: (msg, meta)  => log('debug', msg, meta),
};
