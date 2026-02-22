"""
Security validation for NovaPress AI v2
Ensures critical secrets are properly configured before startup
"""
import sys
from loguru import logger
from app.core.config import settings


class SecurityConfigError(Exception):
    """Raised when security configuration is invalid"""
    pass


def validate_secrets():
    """
    Validate that required secrets are properly configured.
    Should be called during application startup.

    Raises:
        SecurityConfigError: If any required secret is missing or insecure
    """
    errors = []

    # Check SECRET_KEY
    secret_key = settings.SECRET_KEY
    if not secret_key:
        errors.append("SECRET_KEY is not set. Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
    elif any(word in secret_key.lower() for word in ["change", "default", "example", "novapress-secret"]):
        errors.append("SECRET_KEY contains insecure default value. Please generate a secure key.")
    elif len(secret_key) < 32:
        errors.append("SECRET_KEY is too short. Use at least 32 characters.")

    # Check OPENROUTER_API_KEY (only if LLM features are enabled)
    openrouter_key = settings.OPENROUTER_API_KEY
    debug_mode = settings.DEBUG

    if not openrouter_key and not debug_mode:
        logger.warning("⚠️ OPENROUTER_API_KEY is not set. LLM synthesis features will be disabled.")
    elif openrouter_key:
        logger.success(f"✅ OPENROUTER_API_KEY configured (model: {settings.OPENROUTER_MODEL})")

    # Check if we're in production (DEBUG=False means production)
    is_production = not settings.DEBUG

    if errors and is_production:
        error_msg = "Security configuration errors:\n" + "\n".join(f"  - {e}" for e in errors)
        logger.error(f"🔴 {error_msg}")
        raise SecurityConfigError(error_msg)
    elif errors:
        # In development, just warn
        for error in errors:
            logger.warning(f"⚠️ {error}")
    else:
        logger.success("✅ Security configuration validated")


def generate_secret_key() -> str:
    """Generate a secure random key for SECRET_KEY"""
    import secrets
    return secrets.token_urlsafe(32)


if __name__ == "__main__":
    # Allow running directly to test configuration
    print("🔍 Validating security configuration...")
    try:
        validate_secrets()
        print("✅ Security configuration is valid")
    except SecurityConfigError as e:
        print(f"❌ {e}")
        sys.exit(1)
