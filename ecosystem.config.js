// ecosystem.config.js — Configuración PM2 (RF-05 Alta Disponibilidad)
module.exports = {
  apps: [{
    name:              'healthkids-api',
    script:            './src/server.js',
    instances:         4,               // modo cluster: 1 por núcleo de CPU
    exec_mode:         'cluster',
    watch:             false,
    max_memory_restart:'512M',
    restart_delay:     3000,
    max_restarts:      10,
    min_uptime:        '10s',
    log_date_format:   'YYYY-MM-DD HH:mm:ss',
    error_file:        './logs/pm2-error.log',
    out_file:          './logs/pm2-out.log',
    merge_logs:        true,
    env_production: {
      NODE_ENV: 'production',
      PORT:     3000
    },
    env_development: {
      NODE_ENV: 'development',
      PORT:     3000
    }
  }]
};
