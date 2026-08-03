// src/controllers/childController.js
// CRUD de perfiles de niños y dashboard del tutor
'use strict';

const childService = require('../services/childService');
const { success } = require('../utils/apiResponse');

// GET /api/v1/children
// Lista los niños pertenecientes al tutor autenticado
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
// Obtiene un perfil infantil verificando que pertenezca al tutor
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
// Crea un nuevo perfil infantil
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
// Actualiza el apodo o avatar del niño
const update = async (req, res, next) => {
  try {
    const updatedChild = await childService.updateChild(
      req.params.childId,
      req.user.accountId,
      req.body
    );

    return success(
      res,
      updatedChild,
      'Perfil actualizado'
    );
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/children/:childId/dashboard
// Obtiene el resumen diario del niño
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
// Obtiene la tendencia semanal del niño
const trend = async (req, res, next) => {
  try {
    const parsedWeeks = Number.parseInt(req.query.weeks, 10);
    const weeks = Number.isInteger(parsedWeeks) && parsedWeeks > 0
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

// DELETE /api/v1/children/:childId
// Elimina completamente el perfil del niño
const deleteChild = async (req, res, next) => {
  try {
    const { childId } = req.params;

    await childService.deleteChild(
      req.user.accountId,
      childId
    );

    return success(
      res,
      null,
      'Niño eliminado correctamente'
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
  dashboard,
  trend,
  deleteChild
};