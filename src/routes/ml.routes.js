'use strict';

const { Router } = require('express');
const mlController = require('../controllers/mlController');
const { verifyToken } = require('../middleware/auth');

const router = Router();

router.use(verifyToken);

router.post('/children/:childId/health-metrics', mlController.createHealthMetric);

router.get('/children/:childId/health-metrics/latest', mlController.getLatestHealthMetric);


module.exports = router;