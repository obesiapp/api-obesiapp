// src/services/authService.js
// RF-01 RF-02 — Registro, login, hash de contraseñas y JWT
'use strict';

const bcrypt                = require('bcryptjs');
const db                    = require('../config/db');
const { generateToken }     = require('../middleware/auth');
const { validatePassword }  = require('../utils/passwordValidator');
const logger                = require('../utils/logger');
const { BCRYPT_SALT_ROUNDS, MAX_LOGIN_ATTEMPTS, LOCK_DURATION_MINUTES } = require('../config/constants');

// ─── Registro de tutor ───────────────────────────────────────────────────────
const register = async ({ username, email, password, displayName, role }) => {

  // ── RF-01: Bloquear registro directo como child ───────────────────────────
  if (role === 'child') {
    const err = new Error(
      'RF-01 VIOLACIÓN: Los niños no pueden registrarse directamente. ' +
      'Deben ser creados por un tutor autenticado desde POST /api/v1/children'
    );
    err.status = 403;
    throw err;
  }

  // ── RF-01: Bloquear registro como admin desde endpoint público ────────────
  if (role === 'admin') {
    const err = new Error('No puedes registrarte como administrador');
    err.status = 403;
    throw err;
  }

  // ── RF-02: Validar fortaleza de contraseña ────────────────────────────────
  validatePassword(password);

  // Verificar que no exista el username o email
  const exists = await db.query(
    `SELECT account_id FROM accounts
     WHERE username = $1 OR email = $2 LIMIT 1`,
    [username, email]
  );
  if (exists.rowCount > 0) {
    const err = new Error('El usuario o correo ya está registrado');
    err.status = 409;
    throw err;
  }

  // Hash bcrypt (RF-02)
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  // Insertar en accounts + guardian_profiles en una transacción
  const result = await db.withTransaction(async (client) => {
    const { rows: [account] } = await client.query(
      `INSERT INTO accounts (role, username, password_hash, email)
       VALUES ('guardian', $1, $2, $3)
       RETURNING account_id, role, username, email, created_at`,
      [username, passwordHash, email]
    );

    await client.query(
      `INSERT INTO guardian_profiles (account_id, display_name)
       VALUES ($1, $2)`,
      [account.account_id, displayName || username]
    );

    // Auditoría (RF-03)
    await client.query(
      `INSERT INTO audit_log (event_type, actor_account_id, target_account_id,
         description, metadata)
       VALUES ('account_created', $1, $1, 'Registro de nuevo tutor',
         $2::jsonb)`,
      [account.account_id, JSON.stringify({ username, role: 'guardian' })]
    );

    return account;
  });

  logger.info('[AUTH] Tutor registrado', { accountId: result.account_id, username });
  return result;
};

// ─── Login ───────────────────────────────────────────────────────────────────
const login = async ({ username, password, ip }) => {
  // Obtener la cuenta
  const { rows } = await db.query(
    `SELECT account_id, role, username, email, password_hash,
            is_active, failed_login_attempts, locked_until
     FROM accounts
     WHERE username = $1 OR email = $1
     LIMIT 1`,
    [username]
  );

  const account = rows[0];

  // Verificar si la cuenta está bloqueada
  if (account?.locked_until && new Date(account.locked_until) > new Date()) {
    const err = new Error('Cuenta bloqueada temporalmente por seguridad. Intenta más tarde.');
    err.status = 429;
    throw err;
  }

  // Verificar credenciales
  const valid = account && await bcrypt.compare(password, account.password_hash);

  if (!valid || !account?.is_active) {
    // ── RF-02: Registrar intento fallido y bloquear al llegar al límite ──────
    if (account) {
      const attempts  = (account.failed_login_attempts || 0) + 1;
      const lockUntil = attempts >= MAX_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
        : null;

      await db.query(
        `UPDATE accounts
         SET failed_login_attempts = $1, locked_until = $2
         WHERE account_id = $3`,
        [attempts, lockUntil, account.account_id]
      );

      logger.warn('[AUTH] Intento fallido de login', {
        accountId: account.account_id, attempts, ip,
        bloqueado: lockUntil !== null,
      });

      if (lockUntil) {
        const err = new Error(
          `Cuenta bloqueada por ${LOCK_DURATION_MINUTES} minutos ` +
          `después de ${MAX_LOGIN_ATTEMPTS} intentos fallidos.`
        );
        err.status = 429;
        throw err;
      }

      const restantes = MAX_LOGIN_ATTEMPTS - attempts;
      const err = new Error(
        `Credenciales inválidas. Te quedan ${restantes} intento(s) antes del bloqueo.`
      );
      err.status = 401;
      throw err;
    }

    const err = new Error('Credenciales inválidas');
    err.status = 401;
    throw err;
  }

  // Login exitoso — limpiar intentos fallidos
  await db.query(
    `UPDATE accounts
     SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
     WHERE account_id = $1`,
    [account.account_id]
  );

  // Construir payload del token
  const payload = {
    accountId: account.account_id,
    role:      account.role,
    username:  account.username,
  };

  // Obtener perfil según rol para enriquecer el token
  if (account.role === 'guardian') {
    const { rows: [gp] } = await db.query(
      `SELECT guardian_id FROM guardian_profiles WHERE account_id = $1`,
      [account.account_id]
    );
    if (gp) payload.guardianId = gp.guardian_id;
  } else if (account.role === 'child') {
    const { rows: [cp] } = await db.query(
      `SELECT child_id FROM child_profiles WHERE account_id = $1`,
      [account.account_id]
    );
    if (cp) payload.childId = cp.child_id;
  }

  const token = generateToken(payload, account.role);

  // Auditoría de login (RF-03)
  await db.query(
    `INSERT INTO audit_log (event_type, actor_account_id, ip_address, description)
     VALUES ('login', $1, $2::inet, 'Login exitoso')`,
    [account.account_id, ip || null]
  );

  logger.info('[AUTH] Login exitoso', { accountId: account.account_id, role: account.role, ip });

  return {
    token,
    expiresIn: account.role === 'guardian' ? '8h' : account.role === 'child' ? '1h' : '4h',
    user: {
      accountId: account.account_id,
      role:      account.role,
      username:  account.username,
    },
  };
};

// ─── Cambio de contraseña ─────────────────────────────────────────────────────
const changePassword = async (accountId, { currentPassword, newPassword }) => {
  validatePassword(newPassword);

  const { rows: [account] } = await db.query(
    `SELECT password_hash FROM accounts WHERE account_id = $1`,
    [accountId]
  );

  const valid = await bcrypt.compare(currentPassword, account.password_hash);
  if (!valid) {
    const err = new Error('La contraseña actual es incorrecta');
    err.status = 400;
    throw err;
  }

  // ── RF-02: Bloquear reutilización de la misma contraseña ─────────────────
  const samePassword = await bcrypt.compare(newPassword, account.password_hash);
  if (samePassword) {
    const err = new Error('La nueva contraseña no puede ser igual a la actual');
    err.status = 400;
    throw err;
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  await db.query(
    `UPDATE accounts SET password_hash = $1 WHERE account_id = $2`,
    [newHash, accountId]
  );

  // Auditoría (RF-03)
  await db.query(
    `INSERT INTO audit_log (event_type, actor_account_id, target_account_id, description)
     VALUES ('password_changed', $1, $1, 'Cambio de contraseña exitoso')`,
    [accountId]
  );

  logger.info('[AUTH] Contraseña cambiada', { accountId });
};

module.exports = { register, login, changePassword };