import requests

url = "http://127.0.0.1:5000/predict"

student = {
    "student_data": {
        "age": 16,
        "attendance_rate": 0.85,
        "credits_attempted": 62,
        "credits_earned": 60,
        "days_suspended": 0,
        "disciplinary_incidents": 1,
        "english_learner": 0,
        "ethnicity": "White",
        "extracurricular_activities": 2,
        "free_reduced_lunch": 0,
        "gender": "M",
        "gifted_talented": 0,
        "gpa": 2.8,
        "grade_level": 10,
        "math_score": 520,
        "parent_education": "Bachelor+",
        "prev_year_attendance": 0.88,
        "prev_year_gpa": 2.7,
        "reading_score": 510,
        "school_changes": 0,
        "special_education": 0
    }
}

response = requests.post(url, json=student)

print("Status:", response.status_code)
print("Response:")
print(response.json())