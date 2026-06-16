from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd
import json

# Importar generador de quiz
from quiz_generator import generate_quiz

app = FastAPI(title="ObesiApp ML Service")

# ==========================
# MODELO DE OBESIDAD
# ==========================

model = joblib.load("obesiapp_rf_model.pkl")


class RiskInput(BaseModel):
    age: int
    gender: str
    bmi: float


# ==========================
# MODELO DE QUIZ
# ==========================

class QuizRequest(BaseModel):
    age_range: str
    level: int
    topic: str


# ==========================
# HOME
# ==========================

@app.get("/")
def home():
    return {
        "service": "ObesiApp Machine Learning",
        "status": "running",
        "services": [
            "predict-risk",
            "generate-quiz"
        ]
    }


# ==========================
# PREDICCIÓN DE RIESGO
# ==========================

@app.post("/predict-risk")
def predict(data: RiskInput):

    features = pd.DataFrame([{
        "age": data.age,
        "gender": data.gender.lower(),
        "bmi": data.bmi
    }])

    prediction = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]
    classes = model.classes_

    confidence = float(max(probabilities))

    recommendations = {
        "bajo": "Mantener hábitos saludables y continuar con actividad física regular.",
        "medio": "Reforzar alimentación saludable, actividad física e hidratación.",
        "alto": "Se recomienda reforzar actividad física, mejorar hábitos alimenticios y dar seguimiento con el tutor."
    }

    return {
        "risk": prediction,
        "confidence": round(confidence, 2),
        "recommendation": recommendations.get(
            prediction,
            "Mantener seguimiento de hábitos saludables."
        ),
        "probabilities": {
            str(label): round(float(prob), 4)
            for label, prob in zip(classes, probabilities)
        }
    }


# ==========================
# GENERADOR DE QUIZ IA
# ==========================

@app.post("/generate-quiz")
def create_quiz(data: QuizRequest):

    try:

        quiz = generate_quiz(
            age_range=data.age_range,
            level=data.level,
            topic=data.topic
        )

        # Si OpenAI devuelve texto JSON
        try:
            quiz = json.loads(quiz)
        except:
            pass

        return {
            "success": True,
            "quiz": quiz
        }

    except Exception as e:

        return {
            "success": False,
            "error": str(e)
        }