"""
Authentication API Routes — Stub (Not Implemented)
NovaPress AI v2 is Qdrant-only; user auth is not yet wired.
These stubs keep the API docs consistent without pulling in PostgreSQL models.
"""
from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.post("/register", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def register():
    """User registration — not yet implemented."""
    raise HTTPException(status_code=501, detail="Authentication not implemented")


@router.post("/login", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def login():
    """User login — not yet implemented."""
    raise HTTPException(status_code=501, detail="Authentication not implemented")


@router.post("/refresh", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def refresh_token():
    """Token refresh — not yet implemented."""
    raise HTTPException(status_code=501, detail="Authentication not implemented")


@router.post("/logout", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def logout():
    """User logout — not yet implemented."""
    raise HTTPException(status_code=501, detail="Authentication not implemented")


@router.get("/me", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def get_profile():
    """Get current user profile — not yet implemented."""
    raise HTTPException(status_code=501, detail="Authentication not implemented")


@router.put("/me", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def update_profile():
    """Update user profile — not yet implemented."""
    raise HTTPException(status_code=501, detail="Authentication not implemented")


@router.post("/change-password", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def change_password():
    """Change password — not yet implemented."""
    raise HTTPException(status_code=501, detail="Authentication not implemented")


@router.delete("/me", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def delete_account():
    """Delete account — not yet implemented."""
    raise HTTPException(status_code=501, detail="Authentication not implemented")
