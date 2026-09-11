"""
Attendance Service for EduGuard
"""
from typing import List, Dict, Any
from app.supabase_client import get_supabase_client
from app.risk_engine import get_default_signals_for_student


from app.services.student_service import get_student_by_id


def get_attendance(student_id: str) -> List[Dict[str, Any]]:
    """Fetch all attendance records for a student."""
    student = get_student_by_id(student_id)
    if not student:
        return []

    client = get_supabase_client()
    res = client.from_("attendance").select("*").eq("student_id", student["id"]).order("date", desc=True).execute()
    return res.data or []


def add_attendance(student_id: str, date: str, subject: str, present: bool) -> Dict[str, Any]:
    """Insert an attendance record for a student."""
    student = get_student_by_id(student_id)
    if not student:
        raise ValueError(f"Student '{student_id}' does not exist")

    client = get_supabase_client()
    payload = {
        "student_id": student["id"],
        "date": date,
        "subject": subject,
        "present": bool(present)
    }
    res = client.from_("attendance").insert(payload).execute()
    return res.data[0] if res.data else payload


def get_attendance_summary(student_id: str) -> Dict[str, Any]:
    """
    Calculate attendance percentage and summary:
    percentage = present / total * 100
    If no records in table, use the student baseline signal for demo realism.
    """
    records = get_attendance(student_id)
    if records:
        total = len(records)
        present = sum(1 for r in records if r.get("present"))
        absent = total - present
        percentage = round((present / total) * 100.0, 1) if total > 0 else 0.0
        return {
            "percentage": percentage,
            "total_classes": total,
            "present": present,
            "absent": absent
        }

    # Fallback to seed demo signals when table has no records
    defaults = get_default_signals_for_student(student_id)
    def_att = defaults["attendance"]
    est_total = 40
    est_present = int(round(est_total * (def_att / 100.0)))
    est_absent = est_total - est_present
    return {
        "percentage": float(def_att),
        "total_classes": est_total,
        "present": est_present,
        "absent": est_absent
    }
