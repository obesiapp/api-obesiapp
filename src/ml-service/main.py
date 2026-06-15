from fastapi import FastAPI
import joblib
import pandas as pd

app = FastAPI(title="ObesiApp ML Service")

model = joblib.load("obesity_rf_model.pkl")

@app.get("/")
def home():
    return {
        "service": "ObesiApp Machine Learning",
        "status": "running"
    }

@app.post("/predict-risk")
def predict(data: dict):

    features = pd.DataFrame([{
        "screen_time_minutes": data["screen_time_minutes"],
        "habits_completed": data["habits_completed"],
        "challenges_completed": data["challenges_completed"],
        "streak_days": data["streak_days"]
    }])

    prediction = model.predict(features)[0]

    risks = {
        0: "bajo",
        1: "medio",
        2: "alto"
    }

    risk = risks[int(prediction)]

    recommendation = {
        "bajo": "Mantener hábitos saludables.",
        "medio": "Incrementar actividad física y mejorar alimentación.",
        "alto": "Reducir tiempo de pantalla y aumentar actividad física."
    }

    return {
        "risk": risk,
        "recommendation": recommendation[risk]
    }