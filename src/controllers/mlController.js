'use strict';

const mlService = require('../services/mlService');


// =====================================
// OBESIDAD (YA EXISTENTE)
// =====================================

const createHealthMetric = async (
  req,
  res,
  next
) => {

  try {

    const { childId } =
      req.params;

    const result =
      await mlService.createHealthMetric(
        childId,
        req.body
      );

    res.status(201).json({
      ok: true,
      message:
        'Evaluación de salud registrada y clasificada correctamente',
      data: result
    });

  } catch (error) {

    next(error);

  }
};


const getLatestHealthMetric = async (
  req,
  res,
  next
) => {

  try {

    const { childId } =
      req.params;

    const result =
      await mlService.getLatestHealthMetric(
        childId
      );

    res.status(200).json({
      ok: true,
      message:
        'Última evaluación de salud encontrada',
      data: result
    });

  } catch (error) {

    next(error);

  }
};


// =====================================
// GENERAR QUIZ IA
// =====================================

const generateQuiz = async (
  req,
  res,
  next
) => {

  try {

    const { childId } =
      req.params;

    const { topic } =
      req.body;

    const result =
      await mlService.generateQuiz(
        childId,
        topic
      );

    res.status(200).json({
      ok: true,
      message:
        'Quiz generado correctamente',
      data: result
    });

  } catch (error) {

    next(error);

  }
};


// =====================================
// GUARDAR RESULTADO QUIZ
// =====================================

const saveQuizResult = async (
  req,
  res,
  next
) => {

  try {

    const { childId } =
      req.params;

    const result =
      await mlService.saveQuizResult(
        childId,
        req.body
      );

    res.status(201).json({
      ok: true,
      message:
        'Resultado del quiz guardado correctamente',
      data: result
    });

  } catch (error) {

    next(error);

  }
};


// =====================================
// ANÁLISIS DE PATRONES 
// =====================================

const analyzeDailyPattern = async (
  req,
  res,
  next
) => {

  try {

    // Se extrae el ID del resumen diario desde la URL (ej. /analyze-pattern/12345)
    const { summaryId } =
      req.params;

    // Se mandan los hábitos (pantalla, retos, rachas) que vienen en el body
    const result =
      await mlService.analyzeDailyPattern(
        summaryId,
        req.body
      );

    res.status(200).json({
      ok: true,
      message:
        'Patrón diario analizado y clasificado correctamente',
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

  // obesidad
  createHealthMetric,
  getLatestHealthMetric,

  // quiz IA
  generateQuiz,
  saveQuizResult,
  
  // patrones diarios (TU IA)
  analyzeDailyPattern

};