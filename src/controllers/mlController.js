'use strict';

const mlService = require('../services/mlService');

const createHealthMetric = async (req, res, next) => {
  try {
    const { childId } = req.params;

    const result = await mlService.createHealthMetric(childId, req.body);

    res.status(201).json({
      ok: true,
      message: 'Evaluación de salud registrada y clasificada correctamente',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getLatestHealthMetric = async (req, res, next) => {
  try {
    const { childId } = req.params;

    const result = await mlService.getLatestHealthMetric(childId);

    res.status(200).json({
      ok: true,
      message: 'Última evaluación de salud encontrada',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createHealthMetric,
  getLatestHealthMetric
};