import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

FALLBACK_QUIZ = {
    "questions": [
        {
            "question": "¿Cuál de estos alimentos es más saludable?",
            "options": ["Hamburguesa", "Brócoli", "Refresco", "Dulces"],
            "answer": "Brócoli"
        },
        {
            "question": "¿Qué bebida ayuda más a hidratarte?",
            "options": ["Agua", "Refresco", "Bebida energética", "Jugo azucarado"],
            "answer": "Agua"
        },
        {
            "question": "¿Qué actividad ayuda a mantenerte saludable?",
            "options": ["Correr", "Ver televisión todo el día", "Dormir todo el día", "Jugar videojuegos todo el día"],
            "answer": "Correr"
        },
        {
            "question": "¿Qué alimento contiene vitaminas importantes?",
            "options": ["Frutas", "Papas fritas", "Dulces", "Refresco"],
            "answer": "Frutas"
        },
        {
            "question": "¿Cuántas veces al día es recomendable tomar agua?",
            "options": ["Varias veces al día", "Una vez al día", "Nunca", "Solo cuando hace calor"],
            "answer": "Varias veces al día"
        }
    ]
}


def generate_quiz(age_range, level, topic):
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("OPENAI_API_KEY no encontrada")
            return FALLBACK_QUIZ

        client = OpenAI(api_key=api_key)

        # 1. Definir qué significa cada nivel en términos de dificultad para el LLM
        instrucciones_nivel = {
            1: "Dificultad FÁCIL: Haz preguntas muy básicas y directas. Las opciones incorrectas deben ser absurdas o muy fáciles de descartar.",
            2: "Dificultad MEDIA: Haz preguntas que requieran un poco más de memoria o reflexión. Las opciones incorrectas deben parecer lógicas pero ser claramente falsas.",
            3: "Dificultad DIFÍCIL: Haz preguntas sobre detalles específicos o conceptos más avanzados. Las opciones incorrectas (distractores) deben ser muy similares a la correcta para que el niño tenga que razonar bien su respuesta."
        }

        # Asegurarnos de que el nivel sea un entero y exista en nuestro diccionario (por defecto nivel 1)
        try:
            nivel_num = int(level)
            # Si el nivel es mayor a 3, aplicamos la dificultad máxima
            if nivel_num > 3:
                nivel_num = 3
        except (ValueError, TypeError):
            nivel_num = 1
            
        instruccion_dificultad = instrucciones_nivel.get(nivel_num, instrucciones_nivel[1])

        # 2. Inyectar la instrucción de dificultad en el prompt
        prompt = f"""
Genera un quiz educativo para niños.

Edad: {age_range}
Nivel de avance: {level}
Tema: {topic}

Instrucción de Dificultad:
{instruccion_dificultad}

Reglas:
- Genera exactamente 5 preguntas.
- Cada pregunta debe tener 4 opciones.
- Solo una respuesta correcta.
- Lenguaje adecuado para niños en el rango de edad indicado.
- Devuelve únicamente JSON válido.
- No agregues texto adicional.

Formato:

{{
  "questions": [
    {{
      "question": "Pregunta",
      "options": [
        "Opción A",
        "Opción B",
        "Opción C",
        "Opción D"
      ],
      "answer": "Opción correcta"
    }}
  ]
}}
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres un experto en nutrición infantil "
                        "y educación para niños."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            response_format={
                "type": "json_object"
            }
        )

        content = response.choices[0].message.content
        print("RESPUESTA OPENAI:")
        print(content)

        quiz = json.loads(content)

        if not quiz.get("questions"):
            print("OpenAI devolvió un JSON vacío")
            return FALLBACK_QUIZ

        return quiz

    except Exception as error:
        print("ERROR GENERANDO QUIZ:")
        print(str(error))
        return {
            "questions": FALLBACK_QUIZ["questions"],
            "error": str(error)
        }