const router =
require('express').Router();

const controller =
require('../controllers/quizController');

router.post(
 '/children/:childId/quiz',
 controller.generateQuiz
);

module.exports = router;