# HealthKids API — REST Backend v1.0

API REST completa para la aplicación HealthKids de hábitos saludables infantiles.  
Construida con **Node.js + Express + PostgreSQL 16**, consumida por un frontend **Angular**.

---

## Arquitectura en capas

```
src/
├── server.js           ← Entrada: HTTP/HTTPS + cierre graceful (RF-05)
├── app.js              ← Express: middlewares globales, rutas, CORS
├── config/
│   ├── db.js           ← Pool pg + helpers (query, withTransaction, testConnection)
│   └── constants.js    ← Roles, permisos, estados, constantes de dominio
├── middleware/
│   ├── auth.js         ← Verificación JWT HS512 (RF-02)
│   ├── authorize.js    ← RBAC por permiso y por rol (RF-01)
│   ├── rateLimiter.js  ← Rate limiting global + login + estricto (RF-02, RF-05)
│   ├── errorHandler.js ← Manejo centralizado + unhandledRejection (RF-05)
│   ├── setRlsContext.js← Inyecta account_id para RLS de PostgreSQL (RF-01)
│   └── validate.js     ← Procesa errores de express-validator
├── routes/
│   ├── index.js        ← Monta todos los routers bajo /api/v1
│   ├── auth.routes.js
│   ├── child.routes.js ← Hábitos y retos incluidos aquí
│   ├── catalog.routes.js
│   ├── notification.routes.js
│   └── health.routes.js← GET /health para PM2/cron (RF-05)
├── controllers/        ← Capa HTTP: recibe req, llama servicio, responde JSON
│   ├── authController.js
│   ├── childController.js
│   ├── habitController.js
│   ├── challengeController.js
│   └── notificationController.js
├── services/           ← Lógica de negocio + consultas SQL
│   ├── authService.js
│   ├── childService.js
│   ├── habitService.js
│   ├── challengeService.js
│   └── notificationService.js
├── validators/         ← Cadenas express-validator por entidad
│   ├── authValidators.js
│   └── childValidators.js
└── utils/
    ├── apiResponse.js  ← Formato estándar { success, data, message, meta }
    ├── logger.js       ← Logger JSON (producción) / color (desarrollo)
    ├── passwordValidator.js ← Reglas de fortaleza RF-02
    └── integrity.js    ← SHA-256 checksum para RF-03

angular/                ← Integración con frontend Angular
├── src/app/
│   ├── services/auth.service.ts
│   ├── services/child.service.ts
│   ├── interceptors/auth.interceptor.ts
│   ├── guards/auth.guard.ts
│   ├── app.config.ts
│   └── environments/environment.ts

scripts/
├── backup/backup_healthkids.sh  ← pg_dump + SHA-256 (RF-03)
└── monitor/health_check.sh      ← Cron cada 5 min + reinicio PM2 (RF-05)
```

---

## Requisitos de seguridad implementados

| RF    | Descripción                                          | Archivos clave                                      |
|-------|------------------------------------------------------|-----------------------------------------------------|
| RF-01 | Cifrado en tránsito TLS 1.2+, RBAC, sin email niños  | `server.js`, `authorize.js`, `authService.js`       |
| RF-02 | JWT HS512, bcrypt cost=12, rate limit login, validación password | `auth.js`, `rateLimiter.js`, `authService.js` |
| RF-03 | SHA-256 checksum en habit_logs, backup pg_dump + sha256 | `integrity.js`, `habitService.js`, `backup_healthkids.sh` |
| RF-05 | PM2 cluster, health check, manejo graceful, anti-DoS  | `server.js`, `errorHandler.js`, `health.routes.js`  |

---

## Instalación rápida

```bash
# 1. Clonar y entrar al proyecto
cd healthkids-api

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL

# 4. Crear la base de datos (si no existe)
psql -U postgres -c "CREATE DATABASE healthkids_db;"

# 5. Ejecutar el script SQL del modelo de datos
psql -U postgres -d healthkids_db -f healthkids_ddl_v1.sql

# 6. Iniciar en desarrollo
npm run dev

# 7. Verificar
curl http://localhost:3000/health
```

---

## Producción con PM2

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar en modo cluster (4 instancias)
npm run pm2:start

# Ver estado
npm run pm2:status

# Configurar inicio automático al reiniciar el servidor
pm2 startup systemd
pm2 save
```

---

## Endpoints disponibles

### Públicos
```
GET  /health                              → Estado del sistema y DB
POST /api/v1/auth/register                → Registrar tutor
POST /api/v1/auth/login                   → Login → JWT
```

### Autenticados (Bearer Token requerido)
```
GET  /api/v1/auth/me                      → Datos del token
POST /api/v1/auth/change-password         → Cambiar contraseña

GET  /api/v1/children                     → Listar hijos del tutor
POST /api/v1/children                     → Crear perfil de niño
GET  /api/v1/children/:id                 → Detalle del niño
PATCH /api/v1/children/:id                → Actualizar apodo/avatar

GET  /api/v1/children/:id/dashboard       → Resumen diario
GET  /api/v1/children/:id/trend           → Tendencia semanal XP

GET  /api/v1/children/:id/habits          → Hábitos del día  ?date=
POST /api/v1/children/:id/habits          → Registrar hábito
GET  /api/v1/children/:id/habits/compliance → Cumplimiento mensual
GET  /api/v1/children/:id/habits/:hId/history → Historial mensual

GET  /api/v1/children/:id/challenges      → Retos del niño  ?status=
POST /api/v1/children/:id/challenges      → Asignar reto
PATCH /api/v1/children/:id/challenges/:cId → Actualizar estado
GET  /api/v1/children/:id/challenges/stats → Estadísticas

GET  /api/v1/catalog/habits               → Catálogo de hábitos
GET  /api/v1/catalog/challenges           → Catálogo de retos

GET  /api/v1/notifications                → Todas (paginadas)
GET  /api/v1/notifications/unread         → No leídas
PATCH /api/v1/notifications/read-all      → Marcar todas como leídas
PATCH /api/v1/notifications/:id/read      → Marcar una como leída
```

---

## Formato estándar de respuesta

```json
// Éxito
{
  "success": true,
  "message": "Descripción",
  "data": { ... }
}

// Éxito paginado
{
  "success": true,
  "data": [ ... ],
  "meta": { "total": 50, "page": 1, "limit": 20, "totalPages": 3 }
}

// Error
{
  "success": false,
  "error": { "message": "Descripción del error" }
}
```

---

## Cron jobs (configurar en servidor)

```bash
crontab -e

# Respaldo diario a las 2:00 AM (RF-03)
0 2 * * * /bin/bash /scripts/backup/backup_healthkids.sh >> /var/log/healthkids/backup.log 2>&1

# Health check cada 5 minutos (RF-05)
*/5 * * * * /bin/bash /scripts/monitor/health_check.sh
```

---

## Variables de entorno clave (.env)

| Variable             | Descripción                                     | Requerida |
|----------------------|-------------------------------------------------|-----------|
| `DB_HOST`            | Host de PostgreSQL                              | ✅        |
| `DB_NAME`            | Nombre de la base de datos                      | ✅        |
| `DB_USER`            | Usuario de PostgreSQL                           | ✅        |
| `DB_PASSWORD`        | Contraseña de PostgreSQL                        | ✅        |
| `DB_ENCRYPTION_KEY`  | Clave AES-256 para campos cifrados (mín 32 chars)| ✅       |
| `JWT_SECRET`         | Secreto JWT (mínimo 64 caracteres aleatorios)   | ✅        |
| `TLS_KEY_PATH`       | Ruta al archivo .pem de clave privada TLS       | Producción|
| `TLS_CERT_PATH`      | Ruta al certificado TLS                         | Producción|
| `CORS_ORIGIN`        | Origen permitido en desarrollo                  | ✅        |
| `CORS_ORIGINS_PROD`  | Orígenes separados por coma en producción       | Producción|
