"""
EduGuard Flask REST API Backend
Integrates Supabase persistent database, explainable Demo Risk Engine,
and trained Research Machine Learning models.
"""
import os
import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Ensure root backend dir is in sys.path and app dir is not first
BASE_DIR = Path(__file__).resolve().parent.parent
script_dir = str(Path(__file__).resolve().parent)
while script_dir in sys.path:
    sys.path.remove(script_dir)
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Load environment
backend_env = BASE_DIR / ".env"
root_env = BASE_DIR.parent / ".env.local"
if backend_env.exists():
    load_dotenv(backend_env)
elif root_env.exists():
    load_dotenv(root_env)
else:
    load_dotenv()

from app.supabase_client import check_supabase_connection
from app.routes.students import students_bp
from app.routes.risk import risk_bp
from app.routes.dashboard import dashboard_bp
from models.predictor import DropoutPredictor
from utils.preprocessing import StudentDataPreprocessor

app = Flask(__name__)

# Configure CORS
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
if FRONTEND_URL:
    for u in FRONTEND_URL.split(","):
        cleaned = u.strip().rstrip("/")
        if cleaned and cleaned not in allowed_origins:
            allowed_origins.append(cleaned)
CORS(app, origins=allowed_origins, supports_credentials=True)

# Register Blueprints
app.register_blueprint(students_bp)
app.register_blueprint(risk_bp)
app.register_blueprint(dashboard_bp)

# Resolve Model Directory
env_model_dir = os.getenv("MODEL_DIR", "models/saved_models")
if os.path.isabs(env_model_dir):
    MODEL_DIR = Path(env_model_dir)
else:
    candidate = BASE_DIR / env_model_dir
    if candidate.exists():
        MODEL_DIR = candidate
    else:
        MODEL_DIR = BASE_DIR / "models" / "saved_models"

DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "random_forest")

models = {}
preprocessor = None
metrics = {}


def load_models():
    """Safely load trained ML models, preprocessor, and metrics."""
    global models, preprocessor, metrics

    try:
        prep_path = MODEL_DIR / "preprocessor.pkl"
        if prep_path.exists():
            preprocessor = StudentDataPreprocessor.load(str(prep_path))
            print("Preprocessor loaded successfully")
        else:
            print(f"Notice: Preprocessor not found at {prep_path}")

        for m_type in ["logistic_regression", "random_forest", "xgboost"]:
            m_path = MODEL_DIR / f"{m_type}_model.pkl"
            if m_path.exists():
                try:
                    models[m_type] = DropoutPredictor.load(str(m_path))
                    print(f"Loaded {m_type} model")
                except Exception as me:
                    print(f"Notice: Could not load {m_type} model: {me}")

        metrics_path = MODEL_DIR / "model_metrics.json"
        if metrics_path.exists():
            with open(metrics_path, "r") as f:
                metrics = json.load(f)
            print("Model metrics loaded")

        return len(models) > 0
    except Exception as e:
        print(f"Error loading models: {e}")
        return False


# Load models on initialization
load_models()


# ============================================================
# Health & Status Endpoint (PART 14)
# ============================================================

@app.route("/api/health", methods=["GET"])
@app.route("/health", methods=["GET"])
def health_check():
    """
    Health check endpoint reporting Flask status, Supabase connectivity,
    and loaded research ML models.
    """
    supabase_ok = check_supabase_connection()
    models_loaded = len(models) > 0

    return jsonify({
        "status": "healthy" if (supabase_ok or models_loaded) else "degraded",
        "supabase_connected": supabase_ok,
        "models_loaded": models_loaded,
        "models": list(models.keys())
    }), 200


# ============================================================
# Research ML Model Endpoints (PART 9, 25, 26)
# ============================================================

@app.route("/api/models", methods=["GET"])
@app.route("/models", methods=["GET"])
def list_models():
    """List available research ML models."""
    return jsonify({
        "models": list(models.keys()),
        "default": DEFAULT_MODEL
    }), 200


@app.route("/api/model-metrics", methods=["GET"])
@app.route("/model-stats", methods=["GET"])
def model_stats():
    """Get model performance metrics from model_metrics.json."""
    model_type = request.args.get("model")
    if model_type:
        if model_type not in metrics:
            return jsonify({"error": f"Metrics for '{model_type}' not available"}), 404
        return jsonify({model_type: metrics[model_type]}), 200
    return jsonify(metrics), 200


@app.route("/api/model-feature-importance", methods=["GET"])
@app.route("/feature-importance", methods=["GET"])
def feature_importance():
    """Get top feature importances from trained model."""
    try:
        model_type = request.args.get("model", DEFAULT_MODEL)
        top_n = int(request.args.get("top_n", 10))

        if model_type not in models:
            return jsonify({"error": f"Model '{model_type}' not available"}), 404

        model = models[model_type]
        importance_list = model.get_feature_importance(top_n=top_n)

        features = [
            {"feature": name, "importance": round(float(imp), 4)}
            for name, imp in importance_list
        ]

        return jsonify({
            "model": model_type,
            "features": features
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ml/predict", methods=["POST"])
@app.route("/predict", methods=["POST"])
def predict_ml():
    """
    Research ML Prediction with strict schema validation.
    Only accepts the exact feature schema required by the trained model.
    """
    try:
        data = request.get_json()
        if not data or "student_data" not in data:
            return jsonify({"error": "Missing 'student_data' object in request"}), 400

        student_data = data["student_data"]
        model_type = data.get("model", DEFAULT_MODEL)

        if model_type not in models:
            return jsonify({"error": f"Model '{model_type}' not available"}), 400

        if preprocessor is None:
            return jsonify({"error": "Preprocessor not loaded"}), 500

        # Required fields check for research model
        required_fields = ["gpa", "attendance_rate"]
        missing = [f for f in required_fields if f not in student_data]
        if missing:
            return jsonify({
                "error": f"Missing required ML feature fields: {missing}. Research model expects features like gpa, attendance_rate, etc."
            }), 400

        if "student_id" not in student_data:
            student_data["student_id"] = "PRED_" + str(np.random.randint(100000, 999999))

        df = pd.DataFrame([student_data])
        X, _ = preprocessor.transform(df)

        model = models[model_type]
        dropout_proba = float(model.predict_proba(X)[0])
        dropout_pred = int(model.predict(X)[0])

        if dropout_proba < 0.30:
            risk_level = "Low"
        elif dropout_proba < 0.60:
            risk_level = "Medium"
        else:
            risk_level = "High"

        return jsonify({
            "student_id": student_data["student_id"],
            "dropout_probability": round(dropout_proba, 4),
            "dropout_prediction": dropout_pred,
            "risk_level": risk_level,
            "model_used": model_type
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/batch-predict", methods=["POST"])
def batch_predict():
    """Legacy research batch prediction endpoint."""
    try:
        data = request.get_json()
        if not data or "students" not in data:
            return jsonify({"error": "Missing 'students' array"}), 400

        model_type = data.get("model", DEFAULT_MODEL)
        if model_type not in models or preprocessor is None:
            return jsonify({"error": "Model or preprocessor unavailable"}), 500

        students_data = data["students"]
        for i, s in enumerate(students_data):
            if "student_id" not in s:
                s["student_id"] = f"PRED_{i+1:06d}"

        df = pd.DataFrame(students_data)
        X, _ = preprocessor.transform(df)

        model = models[model_type]
        dropout_probas = model.predict_proba(X)
        dropout_preds = model.predict(X)

        predictions = []
        counts = {"high_risk": 0, "medium_risk": 0, "low_risk": 0}

        for i, (proba, pred) in enumerate(zip(dropout_probas, dropout_preds)):
            p = float(proba)
            if p < 0.3:
                lvl = "Low"
                counts["low_risk"] += 1
            elif p < 0.6:
                lvl = "Medium"
                counts["medium_risk"] += 1
            else:
                lvl = "High"
                counts["high_risk"] += 1

            predictions.append({
                "student_id": students_data[i]["student_id"],
                "dropout_probability": round(p, 4),
                "dropout_prediction": int(pred),
                "risk_level": lvl
            })

        return jsonify({
            "predictions": predictions,
            "summary": {"total": len(predictions), **counts},
            "model_used": model_type
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/sample-student", methods=["GET"])
def sample_student():
    """Sample template for research ML predictions."""
    return jsonify({
        "age": 16,
        "gender": "M",
        "ethnicity": "White",
        "grade_level": 10,
        "gpa": 2.8,
        "prev_year_gpa": 2.7,
        "attendance_rate": 0.85,
        "prev_year_attendance": 0.88,
        "math_score": 520,
        "reading_score": 510,
        "disciplinary_incidents": 1,
        "days_suspended": 0,
        "extracurricular_activities": 2,
        "credits_earned": 60,
        "credits_attempted": 62,
        "parent_education": "Bachelor+",
        "special_education": 0,
        "english_learner": 0,
        "gifted_talented": 0,
        "school_changes": 0
    }), 200


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
