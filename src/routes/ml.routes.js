'use strict';

const { Router } = require('express');
const mlController = require('../controllers/mlController');
const { verifyToken } = require('../middleware/auth');

const router = Router();

router.use(verifyToken);

router.get('/children/:childId/risk', mlController.getRisk);

module.exports = router;