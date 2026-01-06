"""
User service for NovaPress AI v2
Simple JSON-based storage for MVP (can migrate to PostgreSQL later)
"""
import json
import os
from datetime import datetime
from typing import Optional, Dict, List
from pathlib import Path
from loguru import logger

from app.models.user import UserInDB, UserCreate, UserResponse
from app.core.security import get_password_hash, verify_password


class UserService:
    """
    User management service with JSON file storage.
    For MVP/development only - migrate to PostgreSQL for production.
    """

    def __init__(self, storage_path: str = "data/users.json"):
        self.storage_path = Path(storage_path)
        self.users: Dict[str, UserInDB] = {}
        self._ensure_storage()
        self._load_users()

    def _ensure_storage(self):
        """Ensure storage directory exists"""
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.storage_path.exists():
            self.storage_path.write_text("{}")

    def _load_users(self):
        """Load users from JSON file"""
        try:
            data = json.loads(self.storage_path.read_text())
            for user_id, user_data in data.items():
                # Convert datetime strings back to datetime objects
                if isinstance(user_data.get("created_at"), str):
                    user_data["created_at"] = datetime.fromisoformat(user_data["created_at"])
                if isinstance(user_data.get("updated_at"), str):
                    user_data["updated_at"] = datetime.fromisoformat(user_data["updated_at"])
                self.users[user_id] = UserInDB(**user_data)
            logger.info(f"Loaded {len(self.users)} users from storage")
        except Exception as e:
            logger.warning(f"Could not load users: {e}")
            self.users = {}

    def _save_users(self):
        """Save users to JSON file"""
        try:
            data = {}
            for user_id, user in self.users.items():
                user_dict = user.model_dump()
                # Convert datetime to ISO string for JSON
                user_dict["created_at"] = user_dict["created_at"].isoformat()
                user_dict["updated_at"] = user_dict["updated_at"].isoformat()
                data[user_id] = user_dict
            self.storage_path.write_text(json.dumps(data, indent=2))
        except Exception as e:
            logger.error(f"Could not save users: {e}")

    async def create_user(self, user_data: UserCreate) -> Optional[UserInDB]:
        """
        Create a new user

        Args:
            user_data: User registration data

        Returns:
            Created user or None if email already exists
        """
        # Check if email already exists
        existing = await self.get_user_by_email(user_data.email)
        if existing:
            logger.warning(f"User with email {user_data.email} already exists")
            return None

        # Create new user
        user = UserInDB(
            email=user_data.email,
            name=user_data.name,
            hashed_password=get_password_hash(user_data.password),
            is_active=True,
            is_admin=False
        )

        self.users[user.id] = user
        self._save_users()

        logger.info(f"Created user: {user.email} (ID: {user.id})")
        return user

    async def get_user_by_id(self, user_id: str) -> Optional[UserInDB]:
        """Get user by ID"""
        return self.users.get(user_id)

    async def get_user_by_email(self, email: str) -> Optional[UserInDB]:
        """Get user by email"""
        for user in self.users.values():
            if user.email.lower() == email.lower():
                return user
        return None

    async def authenticate_user(self, email: str, password: str) -> Optional[UserInDB]:
        """
        Authenticate user with email and password

        Args:
            email: User's email
            password: Plain text password

        Returns:
            User if authenticated, None otherwise
        """
        user = await self.get_user_by_email(email)

        if not user:
            logger.warning(f"Login attempt for non-existent user: {email}")
            return None

        if not user.is_active:
            logger.warning(f"Login attempt for inactive user: {email}")
            return None

        if not verify_password(password, user.hashed_password):
            logger.warning(f"Invalid password for user: {email}")
            return None

        logger.info(f"User authenticated: {email}")
        return user

    async def update_user(
        self,
        user_id: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Optional[UserInDB]:
        """Update user information"""
        user = await self.get_user_by_id(user_id)
        if not user:
            return None

        if name is not None:
            user.name = name
        if email is not None:
            # Check if new email is already taken
            existing = await self.get_user_by_email(email)
            if existing and existing.id != user_id:
                logger.warning(f"Email {email} already taken")
                return None
            user.email = email
        if is_active is not None:
            user.is_active = is_active

        user.updated_at = datetime.utcnow()
        self.users[user_id] = user
        self._save_users()

        return user

    async def change_password(
        self,
        user_id: str,
        old_password: str,
        new_password: str
    ) -> bool:
        """
        Change user password

        Args:
            user_id: User ID
            old_password: Current password
            new_password: New password

        Returns:
            True if password changed, False otherwise
        """
        user = await self.get_user_by_id(user_id)
        if not user:
            return False

        if not verify_password(old_password, user.hashed_password):
            return False

        user.hashed_password = get_password_hash(new_password)
        user.updated_at = datetime.utcnow()
        self.users[user_id] = user
        self._save_users()

        logger.info(f"Password changed for user: {user.email}")
        return True

    async def delete_user(self, user_id: str) -> bool:
        """Delete a user"""
        if user_id in self.users:
            user = self.users.pop(user_id)
            self._save_users()
            logger.info(f"Deleted user: {user.email}")
            return True
        return False

    async def list_users(self, skip: int = 0, limit: int = 100) -> List[UserInDB]:
        """List all users with pagination"""
        users = list(self.users.values())
        return users[skip:skip + limit]

    def to_response(self, user: UserInDB) -> UserResponse:
        """Convert UserInDB to UserResponse (without password)"""
        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            is_active=user.is_active,
            is_admin=user.is_admin,
            created_at=user.created_at
        )


# Singleton instance
user_service = UserService(storage_path="backend/data/users.json")
