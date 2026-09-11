"""
Risk Routes for EduGuard REST API
"""
from datetime import datetime, timezone
from flask import Blueprint, jsonify
from app.supabase_client import get_supabase_client
from app.services import student_service, attendance_service, academic_service, submission_service, engagement_service
from app.risk_engine import calculate_risk

risk_bp = Blueprint("risk_bp", __name__)


def compute_student_risk(student_id: str):
    """Internal helper to calculate signals and risk for a student."""
    student = student_service.get_student_by_id(student_id)
    if not student:
        return None

    att_summary = attendance_service.get_attendance_summary(student_id)
    acad_summary = academic_service.get_performance_summary(student_id)
    sub_summary = submission_service.get_submission_summary(student_id)
    eng_summary = engagement_service.get_engagement_summary(student_id)

    att = att_summary["percentage"]
    acad = acad_summary["average_score_percentage"]
    sub = sub_summary["submission_percentage"]
    eng = eng_summary["engagement_score"]

    risk_result = calculate_risk(att, acad, sub, eng)

    return {
        "student_id": student["student_id"],
        "student_db_id": student["id"],
        "student_name": student["name"],
        "signals": risk_result["signals"],
        "risk_score": risk_result["risk_score"],
        "risk_level": risk_result["risk_level"],
        "flags": risk_result["flags"],
        "recommendation": risk_result["recommendation"]
    }


@risk_bp.route("/api/students/<student_id>/risk", methods=["GET"])
def get_student_risk(student_id):
    """
    Unified Student Risk Endpoint (PART 10)
    Returns live explainable signals, risk score, flags, and recommendations.
    Does not write to database.
    """
    try:
        res = compute_student_risk(student_id)
        if not res:
            return jsonify({"success": False, "error": f"Student '{student_id}' not found"}), 404
        # Format response matching PART 10 exactly
        return jsonify({
            "student_id": res["student_id"],
            "student_name": res["student_name"],
            "signals": res["signals"],
            "risk_score": res["risk_score"],
            "risk_level": res["risk_level"],
            "flags": res["flags"],
            "recommendation": res["recommendation"]
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@risk_bp.route("/api/students/<student_id>/risk/calculate", methods=["POST"])
def calculate_and_save_student_risk(student_id):
    """
    Calculate and persist student risk into risk_scores table (PART 11).
    """
    try:
        res = compute_student_risk(student_id)
        if not res:
            return jsonify({"success": False, "error": f"Student '{student_id}' not found"}), 404

        client = get_supabase_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        payload = {
            "student_id": res["student_db_id"],
            "calculated_at": now_iso,
            "attendance_percentage": res["signals"]["attendance"],
            "average_score_percentage": res["signals"]["academic"],
            "submission_percentage": res["signals"]["submission"],
            "engagement_score": res["signals"]["engagement"],
            "risk_score": res["risk_score"],
            "risk_level": res["risk_level"]
        }

        try:
            db_res = client.from_("risk_scores").insert(payload).execute()
            saved_record = db_res.data[0] if db_res.data else payload
        except Exception as db_err:
            print(f"Notice: risk_scores insert error: {db_err}")
            saved_record = payload

        return jsonify({
            "success": True,
            "record": saved_record,
            "risk_assessment": {
                "student_id": res["student_id"],
                "student_name": res["student_name"],
                "signals": res["signals"],
                "risk_score": res["risk_score"],
                "risk_level": res["risk_level"],
                "flags": res["flags"],
                "recommendation": res["recommendation"]
            }
        }), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@risk_bp.route("/api/risk/calculate-all", methods=["POST"])
def calculate_all_students_risk():
    """
    Batch Risk Calculation (PART 12)
    Calculates for all students, saves risk_scores records, and returns summary.
    """
    try:
        students = student_service.get_all_students()
        results = []
        counts = {"High": 0, "Medium": 0, "Low": 0}

        client = get_supabase_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        for student in students:
            sid = student["student_id"]
            res = compute_student_risk(sid)
            if res:
                formatted = {
                    "student_id": res["student_id"],
                    "student_name": res["student_name"],
                    "signals": res["signals"],
                    "risk_score": res["risk_score"],
                    "risk_level": res["risk_level"],
                    "flags": res["flags"],
                    "recommendation": res["recommendation"]
                }
                results.append(formatted)
                lvl = res["risk_level"]
                counts[lvl] = counts.get(lvl, 0) + 1

                # Save record to risk_scores using student integer id
                try:
                    client.from_("risk_scores").insert({
                        "student_id": res["student_db_id"],
                        "calculated_at": now_iso,
                        "attendance_percentage": res["signals"]["attendance"],
                        "average_score_percentage": res["signals"]["academic"],
                        "submission_percentage": res["signals"]["submission"],
                        "engagement_score": res["signals"]["engagement"],
                        "risk_score": res["risk_score"],
                        "risk_level": res["risk_level"]
                    }).execute()
                except Exception as insert_err:
                    print(f"Batch risk insert note for {sid}: {insert_err}")

        return jsonify({
            "total": len(results),
            "high_risk": counts.get("High", 0),
            "medium_risk": counts.get("Medium", 0),
            "low_risk": counts.get("Low", 0),
            "students": results
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
