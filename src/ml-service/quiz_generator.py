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
# 2. SISTEMA ANTI-REPETICIÓN Y FALLBACK
# ==========================================
def get_recent_questions(db_session, child_id):
    # Si no hay sesión de BD, retornamos lista vacía para no romper el flujo
    if not db_session or not child_id:
        return []
        
    # Aquí irá tu consulta SQL real en el futuro
    return [] 

def get_intelligent_fallback(level: int, db_session=None):
    if db_session:
        # Aquí irá tu lógica SQL para extraer preguntas previas
        print(f"Usando fallback inteligente para el nivel {level} desde PostgreSQL.")
    
    # Fallback duro de seguridad si no hay BD conectada aún
    return {
        "questions": [
            {"question": "¿Cuál de estos alimentos es más saludable?", "options": ["Hamburguesa", "Brócoli", "Refresco", "Dulces"], "answer": "Brócoli"},
            {"question": "¿Qué bebida ayuda más a hidratarte?", "options": ["Agua", "Refresco", "Bebida energética", "Jugo azucarado"], "answer": "Agua"},
            {"question": "¿Qué actividad ayuda a mantenerte saludable?", "options": ["Correr", "Ver televisión", "Dormir todo el día", "Jugar videojuegos"], "answer": "Correr"},
            {"question": "¿Qué alimento contiene vitaminas importantes?", "options": ["Frutas", "Papas fritas", "Dulces", "Refresco"], "answer": "Frutas"},
            {"question": "¿Cuántas veces al día es recomendable tomar agua?", "options": ["Varias veces al día", "Una vez al día", "Nunca", "Solo cuando hace calor"], "answer": "Varias veces al día"}
        ]
    }

# ==========================================
# 3. GENERADOR NÚCLEO (LLM)
# ==========================================
# Reordenamos los parámetros y hacemos db_session y child_id opcionales (=None)
def generate_quiz(age_range, level, topic, db_session=None, child_id=int):
    
    # Convertir level a int de forma segura
    try:
        level_num = int(level)
    except (ValueError, TypeError):
        level_num = 1
        
    config = get_level_config(level_num)
    
    # Intentar obtener preguntas recientes solo si pasaron la base de datos
    recent_questions = get_recent_questions(db_session, child_id)
    
    avoid_questions_str = "\n".join([f"- {q}" for q in recent_questions]) if recent_questions else "Ninguna por ahora."
    
    prompt = f"""
Genera un quiz educativo de nutrición para niños.

PERFIL DEL JUGADOR:
- Edad: {age_range}
- Nivel actual: {level_num} / 50
- Tema general: {topic}

CONFIGURACIÓN DE DIFICULTAD:
- Dificultad: {config['dificultad']}
- Subtemas permitidos: {config['temas']}
- Enfoque metodológico: {config['enfoque']}

REGLA ANTI-REPETICIÓN ESTRICTA:
NO puedes generar ninguna de las siguientes preguntas:
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
            timeout=10
        )
        
        quiz = json.loads(response.choices[0].message.content)
        
        if not quiz.get("questions") or len(quiz["questions"]) != 5:
            raise ValueError("El JSON generado está incompleto.")
            
        return quiz

    except Exception as error:
        print(f"Error en LLM: {str(error)}. Disparando fallback inteligente.")
        return get_intelligent_fallback(level_num, db_session)
# ==========================================
# 3. GENERADOR NÚCLEO (LLM)
# ==========================================
# Agregamos 'topic' de vuelta a los parámetros con un valor por defecto
def generate_quiz(db_session, child_id: int, age_range: str, level: int, topic: str = "Nutrición"):
    config = get_level_config(level)
    recent_questions = get_recent_questions(db_session, child_id)
    
    avoid_questions_str = "\n".join([f"- {q}" for q in recent_questions])
    
    prompt = f"""
Genera un quiz educativo de nutrición para niños.

PERFIL DEL JUGADOR:
- Edad: {age_range}
- Nivel actual: {level} / 50
- Tema general: {topic}

CONFIGURACIÓN DE DIFICULTAD:
- Dificultad: {config['dificultad']}
- Subtemas permitidos para este nivel: {config['temas']}
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
            timeout=10
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