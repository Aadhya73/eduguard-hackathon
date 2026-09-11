"""
Vercel Serverless Entrypoint for EduGuard Flask Backend
Exposes WSGI `app` callable for Vercel Python runtime
"""
import os
import sys
from pathlib import Path

# Ensure root backend directory is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Import Flask app instance from app/app.py
from app.app import app

# Export as app for WSGI / Vercel
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
