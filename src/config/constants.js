// src/config/constants.js
'use strict';

module.exports = {
  ROLES: {
    CHILD:    'child',
    GUARDIAN: 'guardian',
    ADMIN:    'admin',
  },

  PERMISSIONS: {
    child:    ['read:own_profile', 'read:own_challenges', 'read:own_habits',
               'write:habit_log', 'read:catalog'],
    guardian: ['read:own_profile', 'read:children', 'write:screen_config',
               'read:dashboard', 'write:notifications', 'read:catalog'],
    admin:    ['*'],
  },

  CHALLENGE_STATUS: {
    PENDING:     'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED:   'completed',
    ABANDONED:   'abandoned',
  },

  NOTIFICATION_TYPES: {
    SCREEN_LIMIT:    'screen_limit_exceeded',
    STREAK_BROKEN:   'streak_broken',
    CHALLENGE_DONE:  'challenge_completed',
    ACHIEVEMENT:     'achievement_earned',
    HABIT_MISSED:    'habit_missed',
    SYSTEM:          'system',
  },

  HTTP: {
    OK:           200,
    CREATED:      201,
    NO_CONTENT:   204,
    BAD_REQUEST:  400,
    UNAUTHORIZED: 401,
    FORBIDDEN:    403,
    NOT_FOUND:    404,
    CONFLICT:     409,
    UNPROCESSABLE:422,
    TOO_MANY:     429,
    SERVER_ERROR: 500,
  },

  MAX_CHILDREN_PER_GUARDIAN: 5,
  BCRYPT_SALT_ROUNDS: 12,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCK_DURATION_MINUTES: 15,
};
