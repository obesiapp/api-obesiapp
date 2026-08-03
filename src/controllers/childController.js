// src/controllers/childController.js
// CRUD de perfiles de niños y dashboard del tutor
'use strict';

const childService = require('../services/childService');
const { success } = require('../utils/apiResponse');

// GET /api/v1/children
const list = async (req, res, next) => {
  try {
    const children = await childService.getChildrenByGuardian(
      req.user.guardianId
    );

    return success(
      res,
      children,
      `${children.length} perfil(es) encontrado(s)`
    );
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/children/:childId
const getOne = async (req, res, next) => {
  try {
    const child = await childService.getChildById(
      req.params.childId,
      req.user.guardianId
    );

    return success(
      res,
      child,
      'Perfil de niño encontrado'
    );
  } catch (error) {
    return next(error);
  }
};

// POST /api/v1/children
const create = async (req, res, next) => {
  try {
    const {
      username,
      password,
      nickname,
      ageRange,
      avatarCode
    } = req.body;

    const child = await childService.createChild(
      req.user.accountId,
      {
        username,
        password,
        nickname,
        ageRange,
        avatarCode
      }
    );

    return success(
      res,
      child,
      'Perfil de niño creado',
      201
    );
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/v1/children/:childId
const update = async (req, res, next) => {
  try {
    const updated = await childService.updateChild(
      req.params.childId,
      req.user.accountId,
      req.body
    );

    return success(
      res,
      updated,
      'Perfil actualizado'
    );
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/v1/children/:childId
const deleteChild = async (req, res, next) => {
  try {
    const result = await childService.deleteChild(
      req.params.childId,
      req.user.accountId
    );

    return success(
      res,
      result,
      'Perfil de niño eliminado correctamente'
    );
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/children/:childId/dashboard
const dashboard = async (req, res, next) => {
  try {
    const { date } = req.query;

    const summary = await childService.getDailyDashboard(
      req.params.childId,
      date || null
    );

    return success(
      res,
      summary || {},
      'Resumen diario'
    );
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/children/:childId/trend
const trend = async (req, res, next) => {
  try {
    const parsedWeeks = Number.parseInt(
      req.query.weeks,
      10
    );

    const weeks =
      Number.isInteger(parsedWeeks) && parsedWeeks > 0
        ? parsedWeeks
        : 8;

    const data = await childService.getWeeklyTrend(
      req.params.childId,
      weeks
    );

    return success(
      res,
      data,
      `Tendencia de las últimas ${weeks} semanas`
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  list,
  getOne,
  create,
  update,
  deleteChild,
  dashboard,
  trend
};