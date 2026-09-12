"""
Flask REST API for Student Dropout Prediction
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from models.predictor import DropoutPredictor
from utils.preprocessing import StudentDataPreprocessor
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Configuration
MODEL_DIR = os.getenv('MODEL_DIR', '../models/saved_models')
DEFAULT_MODEL = os.getenv('DEFAULT_MODEL', 'random_forest')

# Global variables for loaded models
models = {}
preprocessor = None
metrics = {}


def load_models():
    """Load trained models and preprocessor"""
    global models, preprocessor, metrics

    print("Loading models...")

    # Load preprocessor
    preprocessor_path = os.path.join(MODEL_DIR, 'preprocessor.pkl')
    if os.path.exists(preprocessor_path):
        preprocessor = StudentDataPreprocessor.load(preprocessor_path)
        print("Preprocessor loaded")
    else:
        print(f"Warning: Preprocessor not found at {preprocessor_path}")
        return False

    # Load models
    model_types = ['logistic_regression', 'random_forest', 'xgboost']
    for model_type in model_types:
        model_path = os.path.join(MODEL_DIR, f'{model_type}_model.pkl')
        if os.path.exists(model_path):
            models[model_type] = DropoutPredictor.load(model_path)
            print(f"Loaded {model_type} model")
        else:
            print(f"Warning: {model_type} model not found")

    # Load metrics
    metrics_path = os.path.join(MODEL_DIR, 'model_metrics.json')
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r') as f:
            metrics = json.load(f)
        print("Metrics loaded")

    return len(models) > 0


# Load models on startup
if not load_models():
    print("Warning: Models not loaded. Please train models first.")


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'models_loaded': list(models.keys()),
        'preprocessor_loaded': preprocessor is not None
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict dropout risk for a single student

    Request body:
    {
        "model": "random_forest",  // optional, default is random_forest
        "student_data": {
            "age": 16,
            "gender": "M",
            "ethnicity": "White",
            ...
        }
    }

    Response:
    {
        "student_id": "provided or generated",
        "dropout_probability": 0.75,
        "dropout_prediction": 1,
        "risk_level": "High",
        "model_used": "random_forest"
    }
    """
    try:
        data = request.get_json()

        if not data or 'student_data' not in data:
            return jsonify({'error': 'Missing student_data in request'}), 400

        # Get model type
        model_type = data.get('model', DEFAULT_MODEL)

        if model_type not in models:
            return jsonify({'error': f'Model {model_type} not available'}), 400

        if preprocessor is None:
            return jsonify({'error': 'Preprocessor not loaded'}), 500

        # Convert to DataFrame
        student_data = data['student_data']
        if 'student_id' not in student_data:
            student_data['student_id'] = 'PRED_' + str(np.random.randint(100000, 999999))

        df = pd.DataFrame([student_data])

        # Preprocess
        X, _ = preprocessor.transform(df)

        # Predict
        model = models[model_type]
        dropout_proba = float(model.predict_proba(X)[0])
        dropout_pred = int(model.predict(X)[0])

        # Determine risk level
        if dropout_proba < 0.3:
            risk_level = "Low"
        elif dropout_proba < 0.6:
            risk_level = "Medium"
        else:
            risk_level = "High"

        result = {
            'student_id': student_data['student_id'],
            'dropout_probability': round(dropout_proba, 4),
            'dropout_prediction': dropout_pred,
            'risk_level': risk_level,
            'model_used': model_type
        }

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/batch-predict', methods=['POST'])
def batch_predict():
    """
    Predict dropout risk for multiple students

    Request body:
    {
        "model": "random_forest",  // optional
        "students": [
            {"age": 16, "gender": "M", ...},
            {"age": 17, "gender": "F", ...}
        ]
    }

    Response:
    {
        "predictions": [
            {"student_id": "...", "dropout_probability": 0.75, ...},
            ...
        ],
        "summary": {
            "total": 100,
            "high_risk": 25,
            "medium_risk": 30,
            "low_risk": 45
        }
    }
    """
    try:
        data = request.get_json()

        if not data or 'students' not in data:
            return jsonify({'error': 'Missing students array in request'}), 400

        # Get model type
        model_type = data.get('model', DEFAULT_MODEL)

        if model_type not in models:
            return jsonify({'error': f'Model {model_type} not available'}), 400

        if preprocessor is None:
            return jsonify({'error': 'Preprocessor not loaded'}), 500

        # Convert to DataFrame
        students_data = data['students']

        # Add student IDs if missing
        for i, student in enumerate(students_data):
            if 'student_id' not in student:
                student['student_id'] = f'PRED_{i+1:06d}'

        df = pd.DataFrame(students_data)

        # Preprocess
        X, _ = preprocessor.transform(df)

        # Predict
        model = models[model_type]
        dropout_probas = model.predict_proba(X)
        dropout_preds = model.predict(X)

        # Format results
        predictions = []
        risk_counts = {'high_risk': 0, 'medium_risk': 0, 'low_risk': 0}

        for i, (proba, pred) in enumerate(zip(dropout_probas, dropout_preds)):
            if proba < 0.3:
                risk_level = "Low"
                risk_counts['low_risk'] += 1
            elif proba < 0.6:
                risk_level = "Medium"
                risk_counts['medium_risk'] += 1
            else:
                risk_level = "High"
                risk_counts['high_risk'] += 1

            predictions.append({
                'student_id': students_data[i]['student_id'],
                'dropout_probability': round(float(proba), 4),
                'dropout_prediction': int(pred),
                'risk_level': risk_level
            })

        result = {
            'predictions': predictions,
            'summary': {
                'total': len(predictions),
                **risk_counts
            },
            'model_used': model_type
        }

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/model-stats', methods=['GET'])
def model_stats():
    """
    Get model performance statistics

    Query params:
        model: model type (optional, returns all if not specified)

    Response:
    {
        "random_forest": {
            "accuracy": 0.85,
            "precision": 0.82,
            "recall": 0.78,
            "f1": 0.80,
            "roc_auc": 0.90
        },
        ...
    }
    """
    try:
        model_type = request.args.get('model')

        if model_type:
            if model_type not in metrics:
                return jsonify({'error': f'Metrics for {model_type} not available'}), 404
            return jsonify({model_type: metrics[model_type]})
        else:
            return jsonify(metrics)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/feature-importance', methods=['GET'])
def feature_importance():
    """
    Get feature importance for a model

    Query params:
        model: model type (default: random_forest)
        top_n: number of top features (default: 15)

    Response:
    {
        "model": "random_forest",
        "features": [
            {"feature": "gpa", "importance": 0.25},
            {"feature": "attendance_rate", "importance": 0.18},
            ...
        ]
    }
    """
    try:
        model_type = request.args.get('model', DEFAULT_MODEL)
        top_n = int(request.args.get('top_n', 15))

        if model_type not in models:
            return jsonify({'error': f'Model {model_type} not available'}), 404

        model = models[model_type]
        importance_list = model.get_feature_importance(top_n=top_n)

        features = [
            {'feature': name, 'importance': round(float(imp), 4)}
            for name, imp in importance_list
        ]

        return jsonify({
            'model': model_type,
            'features': features
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/models', methods=['GET'])
def list_models():
    """
    List available models

    Response:
    {
        "models": ["logistic_regression", "random_forest", "xgboost"],
        "default": "random_forest"
    }
    """
    return jsonify({
        'models': list(models.keys()),
        'default': DEFAULT_MODEL
    })


@app.route('/sample-student', methods=['GET'])
def sample_student():
    """
    Get a sample student data template

    Response:
    {
        "age": 16,
        "gender": "M",
        "ethnicity": "White",
        ...
    }
    """
    sample = {
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
        "free_reduced_lunch": 0,
        "parent_education": "Bachelor+",
        "special_education": 0,
        "english_learner": 0,
        "gifted_talented": 0,
        "school_changes": 0
    }

    return jsonify(sample)


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
