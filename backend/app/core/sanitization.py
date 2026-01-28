"""
Security utilities for NovaPress AI v2
SQL sanitization and input validation helpers
"""
import re
from typing import Optional


def escape_sql_like(value: str) -> str:
    """
    Escape special characters in SQL LIKE patterns to prevent injection.
    
    The characters % and _ have special meaning in LIKE patterns:
    - % matches any sequence of characters
    - _ matches any single character
    
    This function escapes these characters so they are treated literally.
    
    Args:
        value: The input string to escape
        
    Returns:
        Escaped string safe for use in LIKE patterns
    """
    if not value:
        return value
    
    # Escape backslash first (since it's used as escape char)
    value = value.replace('\\', '\\\\')
    # Then escape LIKE special characters
    value = value.replace('%', '\\%')
    value = value.replace('_', '\\_')
    
    return value


def sanitize_search_query(query: str, max_length: int = 200) -> str:
    """
    Sanitize a search query by:
    1. Trimming whitespace
    2. Limiting length
    3. Removing potentially dangerous characters
    4. Escaping SQL LIKE patterns
    
    Args:
        query: Raw search query from user
        max_length: Maximum allowed length
        
    Returns:
        Sanitized query string
    """
    if not query:
        return ""
    
    # Trim and limit length
    query = query.strip()[:max_length]
    
    # Remove null bytes and other control characters
    query = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', query)
    
    # Escape SQL LIKE patterns
    query = escape_sql_like(query)
    
    return query


def is_safe_identifier(value: str) -> bool:
    """
    Check if a string is safe to use as an identifier (column name, table name).
    Only allows alphanumeric characters and underscores.
    
    Args:
        value: String to check
        
    Returns:
        True if safe, False otherwise
    """
    if not value:
        return False
    
    return bool(re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', value))


def sanitize_tag(tag: str) -> Optional[str]:
    """
    Sanitize a tag/category string.
    
    Args:
        tag: Raw tag from user input
        
    Returns:
        Sanitized tag or None if invalid
    """
    if not tag:
        return None
    
    # Lowercase, strip whitespace
    tag = tag.lower().strip()
    
    # Only allow alphanumeric, hyphens, and underscores
    tag = re.sub(r'[^a-z0-9\-_\s]', '', tag)
    
    # Replace spaces with hyphens
    tag = re.sub(r'\s+', '-', tag)
    
    # Limit length
    tag = tag[:50]
    
    return tag if tag else None
