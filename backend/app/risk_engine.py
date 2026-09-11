"""
EduGuard Demo Risk Engine
Heuristic Model:
Weights:
- Attendance: 40%
- Academic Performance: 30%
- Assignment Submissions: 20%
- Engagement: 10%

Formula:
risk_score = round(
    (100 - attendance) * 0.40 +
    (100 - academic) * 0.30 +
    (100 - submission) * 0.20 +
    (100 - engagement) * 0.10
)

Note: Clearly labeled as "Demo Risk Model". Not claimed as scientifically validated.
"""
from typing import Dict, List, Any


MODEL_NAME = "EduGuard Demo Risk Model (Assistive Heuristic)"


def calculate_risk(
    attendance: float,
    academic: float,
    submission: float,
    engagement: float
) -> Dict[str, Any]:
    """
    Calculate explainable risk score and categorical level.
    """
    # Clamp input signals to 0..100
    att = max(0.0, min(100.0, float(attendance)))
    acad = max(0.0, min(100.0, float(academic)))
    sub = max(0.0, min(100.0, float(submission)))
    eng = max(0.0, min(100.0, float(engagement)))

    raw_score = (
        (100.0 - att) * 0.40 +
        (100.0 - acad) * 0.30 +
        (100.0 - sub) * 0.20 +
        (100.0 - eng) * 0.10
    )

    risk_score = int(round(max(0.0, min(100.0, raw_score))))

    if risk_score >= 70:
        risk_level = "High"
    elif risk_score >= 40:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    flags = generate_flags(att, acad, sub, eng)
    recommendation = generate_recommendation(risk_level, flags)

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "model_label": MODEL_NAME,
        "weights": {
            "attendance": 0.40,
            "academic": 0.30,
            "submission": 0.20,
            "engagement": 0.10
        },
        "signals": {
            "attendance": int(round(att)),
            "academic": int(round(acad)),
            "submission": int(round(sub)),
            "engagement": int(round(eng))
        },
        "flags": flags,
        "recommendation": recommendation
    }


def generate_flags(
    attendance: float,
    academic: float,
    submission: float,
    engagement: float
) -> List[str]:
    """Generate human-readable warning flags based on threshold boundaries."""
    flags: List[str] = []

    if attendance < 75:
        flags.append(f"Attendance is at {int(round(attendance))}% (below recommended 75%)")
    if academic < 70:
        flags.append(f"Academic score is at {int(round(academic))}% (requires attention)")
    if submission < 70:
        flags.append(f"Assignment submission rate is at {int(round(submission))}% (missed deadlines)")
    if engagement < 65:
        flags.append(f"Engagement activity is at {int(round(engagement))}% (below expected level)")

    if not flags:
        flags.append("Student demonstrates strong academic consistency and engagement")

    return flags


def generate_recommendation(risk_level: str, flags: List[str]) -> str:
    """Generate assistive recommendation for mentors/advisors."""
    if risk_level == "High":
        return "Schedule an immediate mentor meeting, provide academic support, and notify faculty advisor."
    elif risk_level == "Medium":
        return "Monitor upcoming assignment deadlines and schedule a routine check-in."
    else:
        return "Maintain regular monitoring and provide positive encouragement."


def get_default_signals_for_student(student_id: str) -> Dict[str, float]:
    """
    Provide deterministic baseline demo signals for seed students
    when granular database tables contain no records yet.
    """
    sid = (student_id or "").upper().strip()
    if sid == "STU001":
        return {"attendance": 28.0, "academic": 35.0, "submission": 30.0, "engagement": 25.0}
    elif sid == "STU002":
        return {"attendance": 65.0, "academic": 60.0, "submission": 55.0, "engagement": 50.0}
    elif sid == "STU003":
        return {"attendance": 92.0, "academic": 88.0, "submission": 95.0, "engagement": 90.0}
    else:
        return {"attendance": 85.0, "academic": 80.0, "submission": 80.0, "engagement": 80.0}
