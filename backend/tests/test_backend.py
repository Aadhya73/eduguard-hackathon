"""
Automated Pytest Suite for EduGuard Flask Backend
"""
import sys
from pathlib import Path
import pytest

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_endpoint(client):
    """Test /health endpoint."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] in ["healthy", "degraded"]
    assert "models" in data
    assert "supabase_connected" in data


def test_get_students(client):
    """Test GET /api/students returns student list."""
    res = client.get("/api/students")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert isinstance(data["students"], list)
    assert data["total"] >= 0


def test_get_dashboard(client):
    """Test GET /api/dashboard returns metrics."""
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.get_json()
    assert "total_students" in data
    assert "high_risk" in data
    assert "medium_risk" in data
    assert "low_risk" in data
    assert "average_attendance" in data


def test_student_risk_calculation(client):
    """Test GET /api/students/<student_id>/risk."""
    res = client.get("/api/students/STU001/risk")
    assert res.status_code == 200
    data = res.get_json()
    assert data["student_id"] == "STU001"
    assert "signals" in data
    assert "risk_score" in data
    assert "risk_level" in data
    assert "flags" in data
    assert "recommendation" in data
    assert 0 <= data["risk_score"] <= 100


def test_missing_student_risk(client):
    """Test GET /api/students/<non_existent>/risk returns 404."""
    res = client.get("/api/students/NON_EXISTENT_ID_99999/risk")
    assert res.status_code == 404
    data = res.get_json()
    assert data["success"] is False


def test_duplicate_student_id(client):
    """Test POST /api/students with duplicate ID returns HTTP 409."""
    # STU001 already exists
    res = client.post("/api/students", json={
        "student_id": "STU001",
        "name": "Duplicate Aarav",
        "email": "dup@example.com",
        "course": "CSE",
        "semester": 6
    })
    assert res.status_code == 409
    data = res.get_json()
    assert data["success"] is False
    assert "already exists" in data["error"].lower()


def test_invalid_student_payload(client):
    """Test POST /api/students with invalid data returns HTTP 400."""
    res = client.post("/api/students", json={
        "student_id": "",
        "name": "",
        "course": "",
        "semester": -1
    })
    assert res.status_code == 400
    data = res.get_json()
    assert data["success"] is False


def test_ml_predict_missing_fields(client):
    """Test POST /api/ml/predict with missing required fields returns 400."""
    res = client.post("/api/ml/predict", json={
        "model": "random_forest",
        "student_data": {
            "name": "Missing Required Features"
        }
    })
    assert res.status_code == 400
    data = res.get_json()
    assert "error" in data


def test_model_metrics(client):
    """Test GET /api/model-metrics."""
    res = client.get("/api/model-metrics")
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data, dict)
