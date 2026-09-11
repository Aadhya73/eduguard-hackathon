"""
Students Routes for EduGuard REST API
"""
from flask import Blueprint, request, jsonify
from app.services import student_service, attendance_service, academic_service, submission_service, engagement_service

students_bp = Blueprint("students_bp", __name__)


@students_bp.route("/api/students", methods=["GET"])
def list_students():
    """Retrieve all students."""
    try:
        students = student_service.get_all_students()
        return jsonify({
            "success": True,
            "total": len(students),
            "students": students
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@students_bp.route("/api/students", methods=["POST"])
def add_student():
    """
    Create a new student in Supabase.
    Accepts: { student_id, name, email, course, semester }
    Returns 409 on duplicate student_id.
    """
    try:
        data = request.get_json() or {}
        student = student_service.create_student(data)
        return jsonify({
            "success": True,
            "student": student
        }), 201
    except ValueError as ve:
        err_msg = str(ve)
        if "DUPLICATE:" in err_msg or "already exists" in err_msg:
            return jsonify({
                "success": False,
                "error": "Student ID already exists"
            }), 409
        return jsonify({
            "success": False,
            "error": err_msg
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@students_bp.route("/api/students/<student_id>", methods=["GET"])
def get_student(student_id):
    """Retrieve single student by student_id."""
    try:
        student = student_service.get_student_by_id(student_id)
        if not student:
            return jsonify({"success": False, "error": f"Student '{student_id}' not found"}), 404
        return jsonify({"success": True, "student": student}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@students_bp.route("/api/students/<student_id>", methods=["DELETE"])
def delete_student(student_id):
    """Delete a student by student_id."""
    try:
        deleted = student_service.delete_student(student_id)
        if not deleted:
            return jsonify({"success": False, "error": f"Student '{student_id}' not found"}), 404
        return jsonify({"success": True, "message": f"Student '{student_id}' deleted successfully"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# Attendance Endpoints
# ============================================================

@students_bp.route("/api/students/<student_id>/attendance", methods=["GET"])
def student_attendance(student_id):
    try:
        records = attendance_service.get_attendance(student_id)
        return jsonify({"success": True, "student_id": student_id, "attendance": records}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@students_bp.route("/api/students/<student_id>/attendance", methods=["POST"])
def record_attendance(student_id):
    try:
        data = request.get_json() or {}
        date = data.get("date")
        subject = data.get("subject", "General")
        present = data.get("present", True)
        if not date:
            return jsonify({"success": False, "error": "date is required"}), 400
        record = attendance_service.add_attendance(student_id, date, subject, present)
        return jsonify({"success": True, "record": record}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@students_bp.route("/api/students/<student_id>/attendance-summary", methods=["GET"])
def student_attendance_summary(student_id):
    try:
        summary = attendance_service.get_attendance_summary(student_id)
        return jsonify({"success": True, "student_id": student_id, **summary}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# Academic Performance Endpoints
# ============================================================

@students_bp.route("/api/students/<student_id>/performance", methods=["GET"])
def student_performance(student_id):
    try:
        summary = academic_service.get_performance_summary(student_id)
        return jsonify({"success": True, "student_id": student_id, **summary}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@students_bp.route("/api/students/<student_id>/performance", methods=["POST"])
def record_performance(student_id):
    try:
        data = request.get_json() or {}
        subject = data.get("subject")
        assessment_name = data.get("assessment_name")
        score = data.get("score")
        max_score = data.get("max_score", 100)
        assessment_date = data.get("assessment_date")
        if not subject or not assessment_name or score is None:
            return jsonify({"success": False, "error": "subject, assessment_name, score required"}), 400
        record = academic_service.add_performance(student_id, subject, assessment_name, score, max_score, assessment_date)
        return jsonify({"success": True, "record": record}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# Submissions Endpoints
# ============================================================

@students_bp.route("/api/students/<student_id>/submissions", methods=["GET"])
def student_submissions(student_id):
    try:
        summary = submission_service.get_submission_summary(student_id)
        return jsonify({"success": True, "student_id": student_id, **summary}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@students_bp.route("/api/students/<student_id>/submissions", methods=["POST"])
def record_submission(student_id):
    try:
        data = request.get_json() or {}
        assignment_id = data.get("assignment_id")
        status = data.get("status", "Submitted")
        if not assignment_id:
            return jsonify({"success": False, "error": "assignment_id required"}), 400
        record = submission_service.add_submission(student_id, assignment_id, status)
        return jsonify({"success": True, "record": record}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# Engagement Endpoints
# ============================================================

@students_bp.route("/api/students/<student_id>/engagement", methods=["GET"])
def student_engagement(student_id):
    try:
        summary = engagement_service.get_engagement_summary(student_id)
        return jsonify({"success": True, "student_id": student_id, **summary}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@students_bp.route("/api/students/<student_id>/engagement", methods=["POST"])
def record_engagement(student_id):
    try:
        data = request.get_json() or {}
        activity_date = data.get("activity_date")
        login_count = data.get("login_count", 1)
        activity_minutes = data.get("activity_minutes", 30)
        if not activity_date:
            return jsonify({"success": False, "error": "activity_date required"}), 400
        record = engagement_service.add_engagement(student_id, activity_date, login_count, activity_minutes)
        return jsonify({"success": True, "record": record}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
