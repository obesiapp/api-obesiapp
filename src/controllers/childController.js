// src/controllers/childController.js
// CRUD de perfiles de niños y dashboard del tutor
'use strict';

const childService           = require('../services/childService');
const { success, paginated } = require('../utils/apiResponse');

// GET /api/v1/children  — Lista hijos del tutor autenticado
const list = async (req, res, next) => {
  try {
    const children = await childService.getChildrenByGuardian(req.user.guardianId);
    return success(res, children, `${children.length} perfil(es) encontrado(s)`);
  } catch (err) { next(err); }
};

// GET /api/v1/children/:childId
const getOne = async (req, res, next) => {
  try {
    const child = await childService.getChildById(
      req.params.childId,
      req.user.guardianId   // verifica que sea su hijo
    );
    return success(res, child);
  } catch (err) { next(err); }
};

// POST /api/v1/children
const create = async (req, res, next) => {
  try {
    const { username, password, nickname, ageRange, avatarCode } = req.body;
    const child = await childService.createChild(
      req.user.accountId,  // guardianId se resuelve dentro del servicio
      { username, password, nickname, ageRange, avatarCode }
    );
    return success(res, child, 'Perfil de niño creado', 201);
  } catch (err) { next(err); }
};

// PATCH /api/v1/children/:childId
const update = async (req, res, next) => {
  try {
    const updated = await childService.updateChild(
      req.params.childId,
      req.user.accountId,
      req.body
    );
    return success(res, updated, 'Perfil actualizado');
  } catch (err) { next(err); }
};

// GET /api/v1/children/:childId/dashboard
const dashboard = async (req, res, next) => {
  try {
    const { date } = req.query;
    const summary  = await childService.getDailyDashboard(req.params.childId, date || null);
    return success(res, summary || {}, 'Resumen diario');
  } catch (err) { next(err); }
};

// GET /api/v1/children/:childId/trend
const trend = async (req, res, next) => {
  try {
    const weeks = parseInt(req.query.weeks) || 8;
    const data  = await childService.getWeeklyTrend(req.params.childId, weeks);
    return success(res, data, `Tendencia de las últimas ${weeks} semanas`);
  } catch (err) { next(err); }
};

module.exports = { list, getOne, create, update, dashboard, trend };
