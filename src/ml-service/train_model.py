import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import joblib

df = pd.read_csv("training_data.csv")

X = df[
    [
        "screen_time_minutes",
        "habits_completed",
        "challenges_completed",
        "streak_days"
    ]
]

y = df["risk"]

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(X, y)

joblib.dump(model, "obesity_rf_model.pkl")

print("Modelo Random Forest entrenado correctamente")