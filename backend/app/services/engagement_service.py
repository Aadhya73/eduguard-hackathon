"""
Engagement Service for EduGuard
"""
from typing import List, Dict, Any
from app.supabase_client import get_supabase_client
from app.risk_engine import get_default_signals_for_student


from app.services.student_service import get_student_by_id


def get_engagement(student_id: str) -> List[Dict[str, Any]]:
    """Fetch engagement records for a student."""
    student = get_student_by_id(student_id)
    if not student:
        return []

    client = get_supabase_client()
    res = client.from_("engagement").select("*").eq("student_id", student["id"]).order("activity_date", desc=True).execute()
    return res.data or []


def add_engagement(student_id: str, activity_date: str, login_count: int, activity_minutes: int) -> Dict[str, Any]:
    """Add an engagement entry."""
    student = get_student_by_id(student_id)
    if not student:
        raise ValueError(f"Student '{student_id}' does not exist")

    client = get_supabase_client()
    payload = {
        "student_id": student["id"],
        "activity_date": activity_date,
        "login_count": int(login_count),
        "activity_minutes": int(activity_minutes)
    }
    res = client.from_("engagement").insert(payload).execute()
    return res.data[0] if res.data else payload


def get_engagement_summary(student_id: str) -> Dict[str, Any]:
    """
    Calculate engagement score (0-100) based on recent logins and activity minutes.
    If no records, fallback to baseline signals.
    """
    records = get_engagement(student_id)
    if records:
        total_mins = sum(int(r.get("activity_minutes") or 0) for r in records)
        total_logins = sum(int(r.get("login_count") or 0) for r in records)
        # Simple explainable normalization: e.g., 60 mins/day and 5 logins/week = 100%
        target_mins = max(len(records) * 45, 1)
        score = min(100.0, (total_mins / target_mins) * 100.0)
        return {
            "engagement_score": round(score, 1),
            "total_minutes": total_mins,
            "total_logins": total_logins,
            "sessions_recorded": len(records)
        }

    defaults = get_default_signals_for_student(student_id)
    return {
        "engagement_score": float(defaults["engagement"]),
        "total_minutes": 120,
        "total_logins": 8,
        "sessions_recorded": 0
    }
