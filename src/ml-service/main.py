from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd

app = FastAPI(title="ObesiApp ML Service")

model = joblib.load("obesiapp_rf_model.pkl")

class RiskInput(BaseModel):
    age: int
    gender: str
    bmi: float

@app.get("/")
def home():
    return {
        "service": "ObesiApp Machine Learning",
        "status": "running",
        "model": "Random Forest - NHANES Child Obesity"
    }

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