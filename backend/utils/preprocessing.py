"""
Data preprocessing and feature engineering
for student dropout prediction.
"""

import os
import pickle

import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler


class StudentDataPreprocessor:
    """Handles data cleaning, feature engineering, and preprocessing."""

    def __init__(self):
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.feature_names = None

        self.categorical_features = [
            "gender",
            "ethnicity",
            "parent_education"
        ]

        self.numeric_features = None

    def create_features(self, df):
        """Create engineered features from student data."""

        df = df.copy()

        df["credit_completion_rate"] = (
            df["credits_earned"]
            / (df["credits_attempted"] + 1)
        )

        df["gpa_trend"] = (
            df["gpa"] - df["prev_year_gpa"]
        )

        df["attendance_trend"] = (
            df["attendance_rate"]
            - df["prev_year_attendance"]
        )

        df["avg_test_score"] = (
            df["math_score"] + df["reading_score"]
        ) / 2

        df["test_score_gap"] = abs(
            df["math_score"] - df["reading_score"]
        )

        df["low_gpa"] = (
            df["gpa"] < 2.5
        ).astype(int)

        df["low_attendance"] = (
            df["attendance_rate"] < 0.85
        ).astype(int)

        df["high_discipline"] = (
            df["disciplinary_incidents"] > 2
        ).astype(int)

        df["no_activities"] = (
            df["extracurricular_activities"] == 0
        ).astype(int)

        df["high_mobility"] = (
            df["school_changes"] > 1
        ).astype(int)

        df["risk_score"] = (
            df["low_gpa"]
            + df["low_attendance"]
            + df["high_discipline"]
            + df["no_activities"]
            + df["high_mobility"]
        )

        df["over_age"] = (
            df["age"] > df["grade_level"] + 5
        ).astype(int)

        df["engagement_score"] = (
            df["attendance_rate"]
            + (df["extracurricular_activities"] / 4)
            + (1 - df["disciplinary_incidents"] / 10)
        ) / 3

        return df

    def prepare_features(self, df, is_training=True):
        """
        Prepare features for model training or prediction.
        """

        df = self.create_features(df)

        exclude_columns = [
            "student_id",
            "dropped_out"
        ]

        if is_training:

            feature_columns = [
                column
                for column in df.columns
                if column not in exclude_columns
            ]

            self.feature_names = list(feature_columns)

            self.numeric_features = [
                column
                for column in feature_columns
                if column not in self.categorical_features
            ]

        else:

            if self.feature_names is None:
                raise ValueError(
                    "Preprocessor has not been fitted yet."
                )

            feature_columns = list(self.feature_names)

            missing_features = [
                column
                for column in feature_columns
                if column not in df.columns
            ]

            if missing_features:
                raise ValueError(
                    "Missing required features: "
                    + ", ".join(missing_features)
                )

        X = df[feature_columns].copy()

        for column in self.categorical_features:

            if column not in X.columns:
                continue

            if is_training:

                encoder = LabelEncoder()

                X[column] = encoder.fit_transform(
                    X[column].astype(str)
                )

                self.label_encoders[column] = encoder

            else:

                if column not in self.label_encoders:
                    raise ValueError(
                        "Encoder not found for: "
                        + column
                    )

                encoder = self.label_encoders[column]

                X[column] = X[column].astype(str).apply(
                    lambda value: (
                        encoder.transform([value])[0]
                        if value in encoder.classes_
                        else -1
                    )
                )

        if "dropped_out" in df.columns:
            y = df["dropped_out"]
        else:
            y = None

        return X, y, list(X.columns)

    def scale_features(self, X, is_training=True):
        """Scale numeric features."""

        X_scaled = X.copy()

        if self.numeric_features is None:
            raise ValueError(
                "Numeric features have not been initialized."
            )

        if is_training:

            X_scaled[self.numeric_features] = (
                self.scaler.fit_transform(
                    X[self.numeric_features]
                )
            )

        else:

            X_scaled[self.numeric_features] = (
                self.scaler.transform(
                    X[self.numeric_features]
                )
            )

        return X_scaled

    def fit_transform(self, df):
        """Fit preprocessor and transform training data."""

        X, y, feature_names = self.prepare_features(
            df,
            is_training=True
        )

        X_scaled = self.scale_features(
            X,
            is_training=True
        )

        return X_scaled, y, feature_names

    def transform(self, df):
        """Transform new data using fitted preprocessor."""

        X, y, _ = self.prepare_features(
            df,
            is_training=False
        )

        X_scaled = self.scale_features(
            X,
            is_training=False
        )

        return X_scaled, y

    def save(self, filepath):
        """Save fitted preprocessor to disk."""

        directory = os.path.dirname(filepath)

        if directory:
            os.makedirs(
                directory,
                exist_ok=True
            )

        with open(filepath, "wb") as file:
            pickle.dump(self, file)

    @staticmethod
    def load(filepath):
        """Load saved preprocessor from disk."""

        with open(filepath, "rb") as file:
            return pickle.load(file)


def load_and_preprocess_data(
    data_path,
    test_size=0.2,
    random_state=42
):
    """Load data and create train/test split."""

    df = pd.read_csv(data_path)

    if "dropped_out" not in df.columns:
        raise ValueError(
            "CSV file must contain a 'dropped_out' column."
        )

    train_df, test_df = train_test_split(
        df,
        test_size=test_size,
        random_state=random_state,
        stratify=df["dropped_out"]
    )

    preprocessor = StudentDataPreprocessor()

    X_train, y_train, feature_names = (
        preprocessor.fit_transform(train_df)
    )

    X_test, y_test = (
        preprocessor.transform(test_df)
    )

    print(
        f"Training set: {X_train.shape}, "
        f"Dropout rate: {y_train.mean():.2%}"
    )

    print(
        f"Test set: {X_test.shape}, "
        f"Dropout rate: {y_test.mean():.2%}"
    )

    print(
        f"Number of features: {len(feature_names)}"
    )

    return (
        X_train,
        X_test,
        y_train,
        y_test,
        preprocessor,
        feature_names
    )


if __name__ == "__main__":

    data_path = "../data/student_data.csv"

    if os.path.exists(data_path):

        (
            X_train,
            X_test,
            y_train,
            y_test,
            preprocessor,
            feature_names
        ) = load_and_preprocess_data(
            data_path
        )

        print("\nFeature names:")
        print(feature_names)

        print("\nSample features:")
        print(X_train.head())

    else:

        print(
            "Data file not found: "
            + data_path
        )

        print(
            "Run generate_synthetic_data.py first."
        )