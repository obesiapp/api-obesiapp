'use strict';

const mlService = require('../services/mlService');

// =====================================
// OBESIDAD
// =====================================

const createHealthMetric = async (req, res, next) => {
  try {
    const { childId } = req.params;

    const result = await mlService.createHealthMetric(
      childId,
      req.body
    );

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

// =====================================
// GENERAR QUIZ IA
// =====================================

const generateQuiz = async (req, res, next) => {
  try {
    const { childId } = req.params;
    const { topic } = req.body;

    const result = await mlService.generateQuiz(
      childId,
      topic
    );

    res.status(200).json({
      ok: true,
      message: 'Quiz generado correctamente',
      data: result
    });

  } catch (error) {
    next(error);
  }
};

// =====================================
// GUARDAR RESULTADO QUIZ
// =====================================

const saveQuizResult = async (req, res, next) => {
  try {
    const { childId } = req.params;

    const result = await mlService.saveQuizResult(
      childId,
      req.body
    );

    res.status(201).json({
      ok: true,
      message: 'Resultado del quiz guardado correctamente',
      data: result
    });

  } catch (error) {
    next(error);
  }
};

// =====================================
// ANÁLISIS DE PATRONES
// =====================================

const analyzeDailyPattern = async (req, res, next) => {
  try {
    const { summaryId } = req.params;

    const result = await mlService.analyzeDailyPattern(
      summaryId,
      req.body
    );

    res.status(200).json({
      ok: true,
      message: 'Patrón diario analizado y clasificado correctamente',
      data: result
    });

  } catch (error) {
    next(error);
  }
};

// =====================================
// EXPORTS
// =====================================

module.exports = {
  createHealthMetric,
  getLatestHealthMetric,
  generateQuiz,
  saveQuizResult,
  analyzeDailyPattern
};