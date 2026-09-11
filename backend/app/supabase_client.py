"""
Supabase Client for EduGuard Flask Backend
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from backend/.env if present, else root .env.local
backend_env = Path(__file__).resolve().parent.parent / ".env"
root_env = Path(__file__).resolve().parent.parent.parent / ".env.local"

if backend_env.exists():
    load_dotenv(backend_env)
elif root_env.exists():
    load_dotenv(root_env)
else:
    load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SECRET_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")
)

_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    """Return a singleton Supabase client instance."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY."
        )

    _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase_client


def check_supabase_connection() -> bool:
    """Test connection to Supabase students table."""
    try:
        client = get_supabase_client()
        res = client.from_("students").select("id").limit(1).execute()
        return res is not None
    except Exception as e:
        print(f"Supabase connection check failed: {e}")
        return False
