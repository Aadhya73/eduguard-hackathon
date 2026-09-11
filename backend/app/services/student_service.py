"""
Student Service - Database CRUD operations for EduGuard
"""
from typing import List, Dict, Any, Optional
from app.supabase_client import get_supabase_client


def get_all_students(exclude_tests: bool = True) -> List[Dict[str, Any]]:
    """Retrieve all students from Supabase."""
    client = get_supabase_client()
    query = client.from_("students").select("id, student_id, name, email, course, semester, created_at").order("id", desc=False)
    
    if exclude_tests:
        # Exclude temporary TEST_ prefixes
        query = query.not_.ilike("student_id", "TEST_%")
        
    res = query.execute()
    return res.data or []


def get_student_by_id(identifier: Any) -> Optional[Dict[str, Any]]:
    """Retrieve a single student by their text student_id (e.g. 'STU001') or database primary key id."""
    if identifier is None:
        return None
    ident_str = str(identifier).strip()
    if not ident_str:
        return None

    client = get_supabase_client()
    # Try exact match on student_id text column
    res = client.from_("students").select("*").eq("student_id", ident_str).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]

    # If numeric, also check primary key id
    if ident_str.isdigit():
        res_id = client.from_("students").select("*").eq("id", int(ident_str)).execute()
        if res_id.data and len(res_id.data) > 0:
            return res_id.data[0]

    return None


def create_student(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate and insert a new student record into Supabase.
    Raises ValueError with status details on validation or duplicate errors.
    """
    if not data:
        raise ValueError("Missing student payload")

    student_id = str(data.get("student_id", "")).strip()
    name = str(data.get("name", "")).strip()
    course = str(data.get("course", "")).strip()
    email = data.get("email")
    if email:
        email = str(email).strip() or None
    else:
        email = None

    raw_semester = data.get("semester")
    try:
        semester = int(raw_semester)
        if semester <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValueError("Semester must be a valid positive number")

    if not student_id:
        raise ValueError("Student ID cannot be empty")
    if not name:
        raise ValueError("Student Name cannot be empty")
    if not course:
        raise ValueError("Course cannot be empty")

    # Check for existing student ID to handle duplicates gracefully
    existing = get_student_by_id(student_id)
    if existing:
        raise ValueError(f"DUPLICATE: Student ID '{student_id}' already exists")

    client = get_supabase_client()
    payload = {
        "student_id": student_id,
        "name": name,
        "email": email,
        "course": course,
        "semester": semester
    }

    try:
        res = client.from_("students").insert(payload).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        # In case single row insert returns payload
        return payload
    except Exception as e:
        err_msg = str(e)
        if "23505" in err_msg or "unique constraint" in err_msg.lower() or "duplicate key" in err_msg.lower():
            raise ValueError(f"DUPLICATE: Student ID '{student_id}' already exists")
        raise e


def delete_student(student_id: str) -> bool:
    """Delete a student by student_id."""
    client = get_supabase_client()
    existing = get_student_by_id(student_id)
    if not existing:
        return False
    client.from_("students").delete().eq("student_id", student_id.strip()).execute()
    return True
