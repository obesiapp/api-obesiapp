import os
import json

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


def generate_quiz(age_range, level, topic):

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise Exception(
            "OPENAI_API_KEY no encontrada en variables de entorno"
        )

    client = OpenAI(api_key=api_key)

    prompt = f"""
Genera un quiz educativo para niños.

Edad: {age_range}
Nivel: {level}
Tema: {topic}

Reglas:
- Genera exactamente 5 preguntas.
- Cada pregunta debe tener 4 opciones.
- Solo una respuesta correcta.
- Lenguaje adecuado para niños.
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

    try:
        return json.loads(content)
    except Exception:
        return {
            "questions": [],
            "raw_response": content
        }