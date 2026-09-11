"""
Train multiple ML models for student dropout prediction
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import json
from models.predictor import DropoutPredictor
from utils.preprocessing import load_and_preprocess_data


# DropoutPredictor class has been moved to predictor.py to fix pickle serialization issues
# with gunicorn. Import it from there instead of defining it here.


def train_all_models(data_path, output_dir='./saved_models'):
    """
    Train all three models and save them

    Args:
        data_path: path to student data CSV
        output_dir: directory to save models

    Returns:
        dict of trained models and metrics
    """
    print("="*60)
    print("STUDENT DROPOUT PREDICTION - MODEL TRAINING")
    print("="*60)

    # Load and preprocess data
    print("\nLoading and preprocessing data...")
    X_train, X_test, y_train, y_test, preprocessor, feature_names = load_and_preprocess_data(data_path)

    # Save preprocessor
    os.makedirs(output_dir, exist_ok=True)
    preprocessor.save(os.path.join(output_dir, 'preprocessor.pkl'))

    # Train models
    model_types = ['logistic_regression', 'random_forest', 'xgboost']
    models = {}
    all_metrics = {}

    for model_type in model_types:
        print("\n" + "="*60)

        # Create and train model
        model = DropoutPredictor(model_type)
        model.train(X_train, y_train, feature_names)

        # Evaluate
        metrics = model.evaluate(X_test, y_test)
        all_metrics[model_type] = metrics

        # Save model
        model_path = os.path.join(output_dir, f'{model_type}_model.pkl')
        model.save(model_path)

        # Display top features
        print(f"\nTop 10 Important Features:")
        for i, (feature, importance) in enumerate(model.get_feature_importance(top_n=10), 1):
            print(f"  {i}. {feature}: {importance:.4f}")

        models[model_type] = model

    # Save metrics comparison
    metrics_path = os.path.join(output_dir, 'model_metrics.json')
    with open(metrics_path, 'w') as f:
        json.dump(all_metrics, f, indent=2)

    print("\n" + "="*60)
    print("MODEL COMPARISON")
    print("="*60)
    comparison_df = pd.DataFrame(all_metrics).T
    print(comparison_df[['accuracy', 'precision', 'recall', 'f1', 'roc_auc']])

    print("\n" + "="*60)
    print(f"All models and metrics saved to {output_dir}")
    print("="*60)

    return models, all_metrics


if __name__ == "__main__":
    # Train models
    data_path = "../data/student_data.csv"

    if not os.path.exists(data_path):
        print(f"Error: Data file not found at {data_path}")
        print("Please run generate_synthetic_data.py first")
        sys.exit(1)

    train_all_models(data_path, output_dir='models/saved_models')
