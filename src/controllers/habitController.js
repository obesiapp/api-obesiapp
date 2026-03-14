// src/controllers/habitController.js
'use strict';

const habitService          = require('../services/habitService');
const { success, paginated } = require('../utils/apiResponse');

// GET /api/v1/habits/catalog
const catalog = async (req, res, next) => {
  try {
    const habits = await habitService.getCatalog();
    return success(res, habits, `${habits.length} hábito(s) disponibles`);
  } catch (err) { next(err); }
};

// GET /api/v1/children/:childId/habits?date=YYYY-MM-DD
const getLogs = async (req, res, next) => {
  try {
    const { childId } = req.params;
    const date        = req.query.date || new Date().toISOString().split('T')[0];
    const logs        = await habitService.getHabitLogs(childId, date);
    return success(res, logs, `Hábitos del ${date}`);
  } catch (err) { next(err); }
};

// GET /api/v1/children/:childId/habits/:habitId/history?year=&month=
const getHistory = async (req, res, next) => {
  try {
    const { childId, habitId }  = req.params;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const data  = await habitService.getHabitHistory(childId, habitId, year, month);
    return success(res, data);
  } catch (err) { next(err); }
};

// POST /api/v1/children/:childId/habits  — Registrar o actualizar hábito del día
const log = async (req, res, next) => {
  try {
    const { childId } = req.params;
    const result      = await habitService.logHabit(childId, req.body);
    return success(res, result, 'Hábito registrado', 201);
  } catch (err) { next(err); }
};

// GET /api/v1/children/:childId/habits/compliance?year=&month=
const compliance = async (req, res, next) => {
  try {
    const { childId }   = req.params;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const data  = await habitService.getMonthlyCompliance(childId, year, month);
    return success(res, data, `Cumplimiento de hábitos — ${year}/${month}`);
  } catch (err) { next(err); }
};

module.exports = { catalog, getLogs, getHistory, log, compliance };
