import os
import json
import random
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ==========================================
# 1. MOTOR DE PROGRESIÓN Y DIFICULTAD
# ==========================================
def get_level_config(level: int):
    """Devuelve la configuración exacta basada en el nivel (1-50)."""
    if 1 <= level <= 10:
        return {
            "dificultad": "Muy fácil",
            "temas": "Reconocimiento de alimentos, hábitos básicos, agua, frutas, verduras.",
            "enfoque": "Preguntas visuales (si aplica) o descriptivas muy obvias. Distractores absurdos.",
            "xp_reward": 50
        }
    elif 11 <= level <= 20:
        return {
            "dificultad": "Fácil",
            "temas": "Grupos alimenticios, actividad física, hidratación, sueño.",
            "enfoque": "Asociación de conceptos. Distractores lógicos pero claramente incorrectos.",
            "xp_reward": 75
        }
    elif 21 <= level <= 30:
        return {
            "dificultad": "Intermedio",
            "temas": "Calorías, nutrientes, metabolismo básico, hábitos saludables.",
            "enfoque": "Preguntas de memoria y comprensión intermedia. Requiere conocer funciones de los nutrientes.",
            "xp_reward": 100
        }
    elif 31 <= level <= 40:
        return {
            "dificultad": "Difícil",
            "temas": "Interpretación de situaciones, selección de mejores decisiones, razonamiento nutricional.",
            "enfoque": "Escenarios cotidianos. El niño debe elegir la mejor opción entre varias que parecen buenas.",
            "xp_reward": 150
        }
    else: # 41-50
        return {
            "dificultad": "Experto Infantil",
            "temas": "Casos prácticos complejos, toma de decisiones, análisis de hábitos, pensamiento crítico.",
            "enfoque": "Análisis de rutinas completas. Preguntas capciosas donde debe aplicar pensamiento crítico.",
            "xp_reward": 200
        }

# ==========================================
# 2. SISTEMA ANTI-REPETICIÓN Y FALLBACK (MOCK DB)
# ==========================================
def get_recent_questions(db_session, child_id: int, limit: int = 20):
    """
    Consulta a la tabla `quiz_answers` unida con `quiz_attempts` 
    para obtener las últimas preguntas vistas por el niño.
    """
    # Lógica pseudo-código para tu base de datos:
    # SELECT question_text FROM quiz_answers qa 
    # JOIN quiz_attempts qat ON qa.attempt_id = qat.id 
    # WHERE qat.child_id = child_id ORDER BY qat.created_at DESC LIMIT limit;
    return ["¿Qué es una manzana?", "¿Cuánta agua tomar?"] # Ejemplo

def get_intelligent_fallback(db_session, level: int):
    """
    Si OpenAI falla, extrae 5 preguntas aleatorias del mismo nivel 
    que ya existan en la base de datos (generadas previamente).
    """
    # Pseudo-código:
    # SELECT question_text, options, answer FROM quiz_answers qa
    # JOIN quiz_attempts qat ON qa.attempt_id = qat.id
    # WHERE qat.level = level
    # ORDER BY random() LIMIT 5;
    print(f"Usando fallback inteligente para el nivel {level} desde PostgreSQL.")
    # Si la BD está vacía para ese nivel, devuelve un fallback duro de seguridad.
    return {"questions": [{"question": "Fallback", "options": ["A", "B", "C", "D"], "answer": "A"}]}

# ==========================================
# 3. GENERADOR NÚCLEO (LLM)
# ==========================================
def generate_quiz(db_session, child_id: int, age_range: str, level: int):
    config = get_level_config(level)
    recent_questions = get_recent_questions(db_session, child_id)
    
    # Formatear preguntas previas para el prompt
    avoid_questions_str = "\n".join([f"- {q}" for q in recent_questions])
    
    prompt = f"""
Genera un quiz educativo de nutrición para niños.

PERFIL DEL JUGADOR:
- Edad: {age_range}
- Nivel actual: {level} / 50

CONFIGURACIÓN DE DIFICULTAD:
- Dificultad: {config['dificultad']}
- Temas permitidos: {config['temas']}
- Enfoque metodológico: {config['enfoque']}

REGLA ANTI-REPETICIÓN ESTRICTA:
NO puedes generar ninguna de las siguientes preguntas (ni variaciones de las mismas):
{avoid_questions_str}

REGLAS TÉCNICAS:
1. Genera exactamente 5 preguntas.
2. Cada pregunta debe tener 4 opciones.
3. Solo una respuesta correcta.
4. Devuelve ÚNICAMENTE un JSON válido. Cero texto adicional.

FORMATO ESPERADO:
{{
  "questions": [
    {{
      "question": "Texto de la pregunta",
      "options": ["A", "B", "C", "D"],
      "answer": "A"
    }}
  ]
}}
"""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres el motor de IA de un videojuego educativo de nutrición infantil."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            timeout=10 # ¡Importante en producción para evitar cuellos de botella!
        )
        
        quiz = json.loads(response.choices[0].message.content)
        
        if not quiz.get("questions") or len(quiz["questions"]) != 5:
            raise ValueError("El JSON generado está incompleto.")
            
        return quiz

    except Exception as error:
        print(f"Error en LLM: {str(error)}. Disparando fallback inteligente.")
        return get_intelligent_fallback(db_session, level)

# ==========================================
# 4. EVALUACIÓN Y PROGRESIÓN (Llamado tras enviar las respuestas)
# ==========================================
def process_quiz_results(db_session, child_id: int, level: int, correct_answers_count: int):
    """
    Procesa el intento, actualiza XP, maneja desbloqueos y trofeos.
    Este método interactúa fuertemente con tus tablas.
    """
    total_questions = 5
    score_percentage = (correct_answers_count / total_questions) * 100
    passed = score_percentage >= 80.0
    config = get_level_config(level)
    
    # 1. Guardar el intento en `quiz_attempts`
    # INSERT INTO quiz_attempts (child_id, level, score, passed, created_at) ...
    
    # 2. Guardar las respuestas en `quiz_answers`
    # INSERT INTO quiz_answers (attempt_id, question_id/text, child_answer, is_correct) ...
    
    if passed:
        xp_earned = config['xp_reward']
        # Bonus de perfección
        if score_percentage == 100:
            xp_earned += int(xp_earned * 0.2) # 20% más por perfección
            
        # 3. Actualizar `child_profiles`
        # UPDATE child_profiles SET xp = xp + xp_earned, current_level = level + 1 WHERE id = child_id;
        
        # 4. Evaluar Trofeos e insertar en `child_achievements`
        new_level = level + 1
        achievements_unlocked = []
        if new_level == 10:
            achievements_unlocked.append("Explorador Saludable")
            # INSERT INTO child_achievements ...
        elif new_level == 25:
            achievements_unlocked.append("Héroe de la Nutrición")
            # INSERT INTO child_achievements ...
        elif new_level == 50:
            achievements_unlocked.append("Maestro de Hábitos")
            # INSERT INTO child_achievements ...
            
        return {
            "success": True,
            "message": "¡Nivel superado!",
            "xp_earned": xp_earned,
            "level_up": True,
            "new_level": new_level,
            "achievements": achievements_unlocked
        }
    else:
        return {
            "success": False,
            "message": "Sigue intentando. Necesitas 4 respuestas correctas para avanzar.",
            "xp_earned": 10, # XP de consolación por el esfuerzo
            "level_up": False
        }