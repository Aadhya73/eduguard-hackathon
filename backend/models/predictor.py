"""
Dropout Predictor Model Wrapper Class
Separated from train_models.py to fix pickle serialization issues with gunicorn
"""
import os
import pandas as pd
import numpy as np
import pickle
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

class DropoutPredictor:
    def __init__(self, model_type='logistic_regression'):
        self.model_type = model_type
        self.feature_names = None
        self.feature_importance = None
        self.metrics = {}
        self.model = self._get_model()

    def _get_model(self):
        if self.model_type == 'logistic_regression':
            return LogisticRegression(max_iter=1000, random_state=42)
        elif self.model_type == 'random_forest':
            return RandomForestClassifier(n_estimators=100, random_state=42)
        elif self.model_type == 'xgboost':
            return XGBClassifier(use_label_encoder=False, eval_metric='logloss', random_state=42)
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")

    def train(self, X_train, y_train, feature_names=None):
        """Train the model and calculate feature importance"""
        self.feature_names = feature_names
        self.model.fit(X_train, y_train)

        # Calculate feature importance
        if hasattr(self.model, 'feature_importances_'):
            self.feature_importance = self.model.feature_importances_
        elif hasattr(self.model, 'coef_'):
            self.feature_importance = np.abs(self.model.coef_[0])
        else:
            self.feature_importance = None

    def predict(self, X):
        return self.model.predict(X)

    def predict_proba(self, X):
        """Predict dropout probability (returns probability of positive class only)"""
        if hasattr(self.model, "predict_proba"):
            return self.model.predict_proba(X)[:, 1]
        return None

    def evaluate(self, X_test, y_test):
        """Evaluate model performance and store metrics"""
        y_pred = self.model.predict(X_test)
        y_prob = self.model.predict_proba(X_test)[:, 1] if hasattr(self.model, "predict_proba") else None

        metrics = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'f1': float(f1_score(y_test, y_pred, zero_division=0)),
            'roc_auc': float(roc_auc_score(y_test, y_prob)) if y_prob is not None else 0.0
        }

        # Add confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        metrics['confusion_matrix'] = {
            'tn': int(cm[0, 0]),
            'fp': int(cm[0, 1]),
            'fn': int(cm[1, 0]),
            'tp': int(cm[1, 1])
        }

        # Store metrics
        self.metrics = metrics

        # Print performance summary
        print(f"\n{self.model_type.upper()} Performance:")
        print(f"  Accuracy:  {metrics['accuracy']:.4f}")
        print(f"  Precision: {metrics['precision']:.4f}")
        print(f"  Recall:    {metrics['recall']:.4f}")
        print(f"  F1 Score:  {metrics['f1']:.4f}")
        print(f"  ROC AUC:   {metrics['roc_auc']:.4f}")
        print(f"\nConfusion Matrix:")
        print(f"  TN: {cm[0, 0]}, FP: {cm[0, 1]}")
        print(f"  FN: {cm[1, 0]}, TP: {cm[1, 1]}")

        return metrics

    def get_feature_importance(self, top_n=15):
        """Get top N most important features"""
        if self.feature_importance is None or self.feature_names is None:
            return []

        importance_df = pd.DataFrame({
            'feature': self.feature_names,
            'importance': self.feature_importance
        })
        importance_df = importance_df.sort_values('importance', ascending=False)

        return list(zip(
            importance_df['feature'].head(top_n).tolist(),
            importance_df['importance'].head(top_n).tolist()
        ))

    def save(self, filepath):
        """Save model to disk"""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'wb') as f:
            pickle.dump(self, f)
        print(f"Model saved to {filepath}")

    @staticmethod
    def load(filepath):
        """Load model from disk"""
        with open(filepath, 'rb') as f:
            return pickle.load(f)