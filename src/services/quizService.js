const axios = require('axios');

async function generateQuiz(
    childId,
    topic
){

    const response =
        await axios.post(
            'http://localhost:8000/generate-quiz',
            {
                child_id: childId,
                topic
            }
        );

    return response.data;
}

module.exports = {
    generateQuiz
};