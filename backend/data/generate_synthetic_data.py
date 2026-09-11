"""
Generate synthetic student administrative data for dropout prediction
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random

np.random.seed(42)
random.seed(42)

def generate_student_data(n_students=1000):
    """
    Generate realistic synthetic student data

    Features:
    - Demographics: gender, ethnicity, age, socioeconomic status
    - Academic: GPA, test scores, attendance rate
    - Behavioral: disciplinary incidents, extracurricular participation
    - Administrative: enrollment status, special education, English learner
    """

    data = []

    for i in range(n_students):
        student_id = f"STU{str(i+1).zfill(6)}"

        # Demographics
        gender = np.random.choice(['M', 'F'], p=[0.51, 0.49])
        ethnicity = np.random.choice(
            ['White', 'Black', 'Hispanic', 'Asian', 'Other'],
            p=[0.47, 0.15, 0.27, 0.06, 0.05]
        )
        age = np.random.randint(14, 19)
        grade_level = min(12, max(9, age - 5))

        # Socioeconomic factors
        free_reduced_lunch = np.random.choice([0, 1], p=[0.48, 0.52])
        parent_education = np.random.choice(
            ['Less than HS', 'High School', 'Some College', 'Bachelor+'],
            p=[0.12, 0.28, 0.31, 0.29]
        )

        # Special programs
        special_education = np.random.choice([0, 1], p=[0.87, 0.13])
        english_learner = np.random.choice([0, 1], p=[0.90, 0.10])
        gifted_talented = np.random.choice([0, 1], p=[0.92, 0.08])

        # Academic performance (correlated with dropout risk)
        base_gpa = np.random.normal(2.8, 0.8)

        # Factors that increase dropout risk
        risk_multiplier = 1.0
        if free_reduced_lunch == 1:
            risk_multiplier *= 1.5
        if special_education == 1:
            risk_multiplier *= 1.3
        if parent_education in ['Less than HS', 'High School']:
            risk_multiplier *= 1.4
        if age > grade_level + 5:  # Over-age for grade
            risk_multiplier *= 2.0

        # GPA adjusted by risk factors
        gpa = max(0.0, min(4.0, base_gpa - (risk_multiplier - 1.0) * 0.5 + np.random.normal(0, 0.2)))

        # Attendance rate (correlated with GPA and dropout)
        base_attendance = 0.85 + (gpa / 4.0) * 0.13
        attendance_rate = max(0.4, min(1.0, base_attendance + np.random.normal(0, 0.08)))

        # Standardized test scores
        math_score = max(200, min(800, 500 + (gpa - 2.5) * 100 + np.random.normal(0, 50)))
        reading_score = max(200, min(800, 500 + (gpa - 2.5) * 95 + np.random.normal(0, 55)))

        # Behavioral factors
        disciplinary_incidents = max(0, int(np.random.poisson((4.0 - gpa) * 0.8)))
        days_suspended = disciplinary_incidents * np.random.randint(0, 4)

        # Engagement
        extracurricular_activities = np.random.choice([0, 1, 2, 3, 4], p=[0.25, 0.35, 0.25, 0.10, 0.05])
        if gpa > 3.0:
            extracurricular_activities = min(4, extracurricular_activities + np.random.randint(0, 2))

        # Course-related
        credits_earned = grade_level * 6 + np.random.randint(-3, 4)
        credits_attempted = credits_earned + disciplinary_incidents + np.random.randint(0, 3)

        # Previous year data
        prev_year_gpa = max(0.0, min(4.0, gpa + np.random.normal(0, 0.3)))
        prev_year_attendance = max(0.4, min(1.0, attendance_rate + np.random.normal(0, 0.05)))

        # School changes (mobility)
        school_changes = np.random.choice([0, 1, 2, 3], p=[0.7, 0.2, 0.07, 0.03])

        # Dropout indicator (target variable)
        # Calculate dropout probability based on risk factors
        dropout_prob = 0.05  # Base dropout rate

        if gpa < 2.0:
            dropout_prob += 0.25
        elif gpa < 2.5:
            dropout_prob += 0.15

        if attendance_rate < 0.75:
            dropout_prob += 0.30
        elif attendance_rate < 0.85:
            dropout_prob += 0.15

        if disciplinary_incidents > 3:
            dropout_prob += 0.20
        elif disciplinary_incidents > 1:
            dropout_prob += 0.10

        if free_reduced_lunch == 1:
            dropout_prob += 0.08

        if school_changes > 1:
            dropout_prob += 0.12

        if special_education == 1:
            dropout_prob += 0.06

        if parent_education == 'Less than HS':
            dropout_prob += 0.10

        if age > grade_level + 5:
            dropout_prob += 0.25

        if extracurricular_activities == 0:
            dropout_prob += 0.10

        dropout_prob = min(0.85, dropout_prob)
        dropped_out = 1 if np.random.random() < dropout_prob else 0

        student = {
            'student_id': student_id,
            'age': age,
            'gender': gender,
            'ethnicity': ethnicity,
            'grade_level': grade_level,
            'gpa': round(gpa, 2),
            'prev_year_gpa': round(prev_year_gpa, 2),
            'attendance_rate': round(attendance_rate, 3),
            'prev_year_attendance': round(prev_year_attendance, 3),
            'math_score': int(math_score),
            'reading_score': int(reading_score),
            'disciplinary_incidents': disciplinary_incidents,
            'days_suspended': days_suspended,
            'extracurricular_activities': extracurricular_activities,
            'credits_earned': credits_earned,
            'credits_attempted': credits_attempted,
            'free_reduced_lunch': free_reduced_lunch,
            'parent_education': parent_education,
            'special_education': special_education,
            'english_learner': english_learner,
            'gifted_talented': gifted_talented,
            'school_changes': school_changes,
            'dropped_out': dropped_out
        }

        data.append(student)

    df = pd.DataFrame(data)
    return df

if __name__ == "__main__":
    print("Generating synthetic student data...")
    df = generate_student_data(1500)

    print(f"\nGenerated {len(df)} student records")
    print(f"Dropout rate: {df['dropped_out'].mean():.2%}")
    print(f"\nData shape: {df.shape}")
    print(f"\nColumns: {list(df.columns)}")

    # Save to CSV
    output_file = "student_data.csv"
    df.to_csv(output_file, index=False)
    print(f"\nData saved to {output_file}")

    # Display summary statistics
    print("\n" + "="*50)
    print("SUMMARY STATISTICS")
    print("="*50)
    print(f"\nDropout by GPA Range:")
    df['gpa_range'] = pd.cut(df['gpa'], bins=[0, 2.0, 2.5, 3.0, 4.0],
                              labels=['<2.0', '2.0-2.5', '2.5-3.0', '3.0+'])
    print(df.groupby('gpa_range')['dropped_out'].agg(['count', 'sum', 'mean']))

    print(f"\nDropout by Attendance Rate:")
    df['attendance_range'] = pd.cut(df['attendance_rate'], bins=[0, 0.75, 0.85, 0.95, 1.0],
                                     labels=['<75%', '75-85%', '85-95%', '95%+'])
    print(df.groupby('attendance_range')['dropped_out'].agg(['count', 'sum', 'mean']))

    print(f"\nDropout by Ethnicity:")
    print(df.groupby('ethnicity')['dropped_out'].agg(['count', 'sum', 'mean']))

    print(f"\nDropout by Free/Reduced Lunch:")
    print(df.groupby('free_reduced_lunch')['dropped_out'].agg(['count', 'sum', 'mean']))
