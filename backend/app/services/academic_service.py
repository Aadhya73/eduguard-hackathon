"""
Academic Performance Service for EduGuard
"""
from typing import List, Dict, Any
from app.supabase_client import get_supabase_client
from app.risk_engine import get_default_signals_for_student


from app.services.student_service import get_student_by_id


def get_performance(student_id: str) -> List[Dict[str, Any]]:
    """Retrieve all academic performance records for a student."""
    student = get_student_by_id(student_id)
    if not student:
        return []

    client = get_supabase_client()
    res = client.from_("academic_performance").select("*").eq("student_id", student["id"]).execute()
    return res.data or []


def add_performance(
    student_id: str,
    subject: str,
    assessment_name: str,
    score: float,
    max_score: float,
    assessment_date: str
) -> Dict[str, Any]:
    """Add a performance assessment record."""
    student = get_student_by_id(student_id)
    if not student:
        raise ValueError(f"Student '{student_id}' does not exist")

    client = get_supabase_client()
    payload = {
        "student_id": student["id"],
        "subject": subject,
        "assessment_name": assessment_name,
        "score": float(score),
        "max_score": float(max_score),
        "assessment_date": assessment_date
    }
    res = client.from_("academic_performance").insert(payload).execute()
    return res.data[0] if res.data else payload


def get_performance_summary(student_id: str) -> Dict[str, Any]:
    """
    Calculate average score percentage:
    sum(score) / sum(max_score) * 100
    If no records, fallback to baseline signals.
    """
    records = get_performance(student_id)
    if records:
        total_score = sum(float(r.get("score") or 0) for r in records)
        total_max = sum(float(r.get("max_score") or 100) for r in records)
        avg_pct = round((total_score / total_max) * 100.0, 1) if total_max > 0 else 0.0
        return {
            "average_score_percentage": avg_pct,
            "assessments_count": len(records),
            "records": records
        }

    defaults = get_default_signals_for_student(student_id)
    return {
        "average_score_percentage": float(defaults["academic"]),
        "assessments_count": 0,
        "records": []
    }
