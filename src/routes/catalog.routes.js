// src/routes/catalog.routes.js
// Catálogos públicos (con auth) de hábitos y retos
'use strict';

const { Router }    = require('express');
const habitCtrl     = require('../controllers/habitController');
const challengeCtrl = require('../controllers/challengeController');
const { verifyToken } = require('../middleware/auth');
const { authorize }   = require('../middleware/authorize');

const router = Router();

router.use(verifyToken);

// GET /api/v1/catalog/habits
router.get('/habits',    authorize('read:catalog'), habitCtrl.catalog);

// GET /api/v1/catalog/challenges?ageRange=&category=&difficulty=
router.get('/challenges', authorize('read:catalog'), challengeCtrl.catalog);

module.exports = router;
