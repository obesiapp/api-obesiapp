'use strict';

const mlService = require('../services/mlService');

const getRisk = async (req, res, next) => {
  try {
    const { childId } = req.params;

    const result = await mlService.getChildRisk(childId);

    res.status(200).json({
      ok: true,
      message: 'Clasificación de riesgo generada correctamente',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRisk
};