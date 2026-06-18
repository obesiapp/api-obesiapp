from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd
import json


import os

print("OPENAI_API_KEY:", os.getenv("OPENAI_API_KEY"))

# Importar generador de quiz
from quiz_generator import generate_quiz

app = FastAPI(title="ObesiApp ML Service")

# ==========================
# CARGA DE MODELOS IA
# ==========================

# 1. Modelo de Riesgo (Original)
model = joblib.load("obesiapp_rf_model.pkl")

# 2. Modelo de Clustering / Patrones Diarios (Tuyo)
# NOTA: Cambia el nombre si tu archivo .pkl de clustering se llama diferente
clustering_model = joblib.load("obesity_rf_model.pkl") 


# ==========================
# ESQUEMAS DE DATOS
# ==========================

class RiskInput(BaseModel):
    age: int
    gender: str
    bmi: float

class QuizRequest(BaseModel):
    age_range: str
    level: int
    topic: str

# 3. Tu nuevo esquema para validar los hábitos de los niños
class DatosDiarios(BaseModel):
    screen_time_minutes: int
    challenges_completed: int
    habits_completed: int
    streak_days: int
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
            "generate-quiz",
            "analizar-patron"  # <-- 4. Tu servicio ya aparece disponible aquí
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


# ==========================
# ANÁLISIS DE PATRONES 
# ==========================

# 5. Tu endpoint para recibir los hábitos de DBeaver
@app.post("/analizar-patron")
def analizar_patron(data: DatosDiarios):
    
    # 1. Metemos los datos en un diccionario
    datos_dict = {
        "screen_time_minutes": data.screen_time_minutes,
        "challenges_completed": data.challenges_completed,
        "habits_completed": data.habits_completed,
        "streak_days": data.streak_days
    }
    
    # 2. Creamos el DataFrame
    features = pd.DataFrame([datos_dict])
    
    # 3. EL TRUCO: Reordenamos las columnas automáticamente al gusto del modelo
    features = features[clustering_model.feature_names_in_]
    
    # 4. Hacer la predicción
    resultado = clustering_model.predict(features)
    cluster_asignado = int(resultado[0])
    
    return {
        "success": True,
        "ml_cluster_id": cluster_asignado,
        "mensaje": f"Patrón analizado correctamente. Asignado al grupo {cluster_asignado}"
    }