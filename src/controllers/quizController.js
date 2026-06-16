const quizService =
require('../services/quizService');

exports.generateQuiz =
async(req,res,next)=>{

    try{

        const result =
        await quizService.generateQuiz(
            req.params.childId,
            req.body.topic
        );

        res.json(result);

    }catch(error){

        next(error);

    }

};