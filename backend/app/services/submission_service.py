"""
Submission Service for EduGuard
"""
from typing import List, Dict, Any
from app.supabase_client import get_supabase_client
from app.risk_engine import get_default_signals_for_student


from app.services.student_service import get_student_by_id


def get_submissions(student_id: str) -> List[Dict[str, Any]]:
    """Retrieve all submissions for a student."""
    student = get_student_by_id(student_id)
    if not student:
        return []

    client = get_supabase_client()
    res = client.from_("submissions").select("*").eq("student_id", student["id"]).execute()
    return res.data or []


def add_submission(student_id: str, assignment_id: int, status: str = "Submitted") -> Dict[str, Any]:
    """Record a submission."""
    student = get_student_by_id(student_id)
    if not student:
        raise ValueError(f"Student '{student_id}' does not exist")

    client = get_supabase_client()
    payload = {
        "student_id": student["id"],
        "assignment_id": assignment_id,
        "status": status
    }
    res = client.from_("submissions").insert(payload).execute()
    return res.data[0] if res.data else payload


def get_submission_summary(student_id: str) -> Dict[str, Any]:
    """
    Calculate submission percentage:
    submitted assignments / total assignments * 100
    If no records, fallback to baseline signals.
    """
    client = get_supabase_client()
    assignments_res = client.from_("assignments").select("id").execute()
    total_assignments = len(assignments_res.data or [])

    submissions = get_submissions(student_id)
    submitted_count = len(submissions)

    if total_assignments > 0:
        sub_pct = round((submitted_count / total_assignments) * 100.0, 1)
        return {
            "submission_percentage": sub_pct,
            "total_assignments": total_assignments,
            "submitted_assignments": submitted_count
        }

    defaults = get_default_signals_for_student(student_id)
    return {
        "submission_percentage": float(defaults["submission"]),
        "total_assignments": 10,
        "submitted_assignments": int(round(10 * (defaults["submission"] / 100.0)))
    }
