"""
EduGuard Backend Server Runner
Run: python run_backend.py
"""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(BASE_DIR))

from app.app import app

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"Starting EduGuard Backend Server on http://0.0.0.0:{port}...")
    app.run(host="0.0.0.0", port=port, debug=False)

