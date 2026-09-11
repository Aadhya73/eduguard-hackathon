"""
Dashboard Routes for EduGuard REST API
"""
from flask import Blueprint, jsonify
from app.services import student_service, attendance_service
from app.routes.risk import compute_student_risk

dashboard_bp = Blueprint("dashboard_bp", __name__)


@dashboard_bp.route("/api/dashboard", methods=["GET"])
def get_dashboard_metrics():
    """
    Dashboard Metrics Endpoint (PART 13)
    Calculates dynamic summary metrics from current Supabase data.
    """
    try:
        students = student_service.get_all_students()
        total_students = len(students)

        high_risk = 0
        medium_risk = 0
        low_risk = 0
        attendance_percentages = []

        for student in students:
            sid = student["student_id"]
            risk_info = compute_student_risk(sid)
            if risk_info:
                lvl = risk_info["risk_level"]
                if lvl == "High":
                    high_risk += 1
                elif lvl == "Medium":
                    medium_risk += 1
                else:
                    low_risk += 1
                attendance_percentages.append(risk_info["signals"]["attendance"])

        avg_attendance = (
            int(round(sum(attendance_percentages) / len(attendance_percentages)))
            if attendance_percentages
            else 0
        )

        # Baseline active support count for high risk students
        active_interventions = max(high_risk, 1) if total_students > 0 else 0

        return jsonify({
            "total_students": total_students,
            "high_risk": high_risk,
            "medium_risk": medium_risk,
            "low_risk": low_risk,
            "average_attendance": avg_attendance,
            "active_interventions": active_interventions
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
