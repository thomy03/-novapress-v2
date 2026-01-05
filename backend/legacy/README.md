# Legacy Flask API (Archived)

> ⚠️ **DEPRECATED**: This file was archived on 2026-01-05 as part of the backend unification.

## Why was this archived?

The NovaPress v2 project had two backend implementations:
1. **Flask API** (`api.py`) - Simple MVP for initial development
2. **FastAPI** (`app/main.py`) - Production-ready with async support, auth, rate limiting

Going forward, only the **FastAPI backend** is maintained and should be used.

## Running the backend

Use the FastAPI backend:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 5000
```

## If you need Flask features

The archived Flask API is preserved here for reference only. If you need to restore it:

1. Copy `flask_api.py.bak` to `../api.py`
2. Install Flask dependencies: `pip install flask flask-cors`
3. Run: `python api.py`

**Note**: The Flask API does not have authentication, rate limiting, or ML pipeline integration.
