from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.config.settings import settings
import structlog

logger = structlog.get_logger()

# Make HTTPBearer optional for development/testing
security = HTTPBearer(auto_error=False)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Validate JWT token and extract user information
    This integrates with your identity service JWT validation
    
    For development: If no token is provided, returns a test user
    """
    
    # If no credentials provided, return test user for development
    if not credentials:
        logger.info("No authentication token provided - using test user for development")
        return {
            "user_id": "test-user-123",
            "email": "test@example.com", 
            "tenant_id": "default",
            "role": "user"
        }
    
    try:
        # Decode JWT token
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"]
        )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        logger.info("Authenticated user", user_id=user_id)
        return {
            "user_id": user_id,
            "email": payload.get("email"),
            "tenant_id": payload.get("tenant_id", "default"),
            "role": payload.get("role", "user")
        }
        
    except JWTError as e:
        logger.warning("JWT validation failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception as e:
        logger.error("Authentication failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )