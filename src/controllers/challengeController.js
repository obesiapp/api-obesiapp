// src/controllers/challengeController.js
'use strict';

const challengeService       = require('../services/challengeService');
const childService           = require('../services/childService');
const { success }            = require('../utils/apiResponse');

// GET /api/v1/challenges?ageRange=&category=&difficulty=
const catalog = async (req, res, next) => {
  try {
    const { ageRange, category, difficulty } = req.query;
    const challenges = await challengeService.getActiveChallenges({ ageRange, category, difficulty });
    return success(res, challenges, `${challenges.length} reto(s) disponibles`);
  } catch (err) { next(err); }
};

// GET /api/v1/children/:childId/challenges?status=
const list = async (req, res, next) => {
  try {
    const { childId } = req.params;
    const { status }  = req.query;
    const challenges  = await challengeService.getChildChallenges(childId, status || null);
    return success(res, challenges);
  } catch (err) { next(err); }
};

// POST /api/v1/children/:childId/challenges
const assign = async (req, res, next) => {
  try {
    const { childId }     = req.params;
    const { challengeId } = req.body;
    const assigned        = await challengeService.assignChallenge(childId, challengeId);
    return success(res, assigned, 'Reto asignado', 201);
  } catch (err) { next(err); }
};

// PATCH /api/v1/children/:childId/challenges/:childChallengeId
const updateStatus = async (req, res, next) => {
  try {
    const { childId, childChallengeId } = req.params;
    const { status }                    = req.body;
    const updated = await challengeService.updateChallengeStatus(childId, childChallengeId, status);
    return success(res, updated, `Reto actualizado a: ${status}`);
  } catch (err) { next(err); }
};

// GET /api/v1/children/:childId/challenges/stats
const stats = async (req, res, next) => {
  try {
    const data = await challengeService.getChallengeStats(req.params.childId);
    return success(res, data, 'Estadísticas de retos');
  } catch (err) { next(err); }
};

module.exports = { catalog, list, assign, updateStatus, stats };
