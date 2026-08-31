from datetime import datetime, timedelta, timezone
from typing import Optional, Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models import User
from ..config import settings

# Hardcoded demo users — always works regardless of DB or password hashing state
DEMO_USERS = {
    "admin":    {"password": "prahari123",  "role": "admin"},
    "operator": {"password": "operator123", "role": "operator"},
    "viewer":   {"password": "viewer123",   "role": "viewer"},
}

# Password hashing — gracefully handle passlib/bcrypt compatibility issues
_pwd_context = None

def _get_pwd_context():
    global _pwd_context
    if _pwd_context is not None:
        return _pwd_context
    try:
        from passlib.context import CryptContext
        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        ctx.hash("probe")          # verify it actually works
        _pwd_context = ctx
        return ctx
    except Exception:
        pass
    try:
        from passlib.context import CryptContext
        ctx = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
        _pwd_context = ctx
        return ctx
    except Exception:
        return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    ctx = _get_pwd_context()
    if ctx is None:
        return False
    try:
        return ctx.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    ctx = _get_pwd_context()
    if ctx is None:
        import hashlib
        return hashlib.sha256(password.encode()).hexdigest()
    try:
        return ctx.hash(password)
    except Exception:
        import hashlib
        return hashlib.sha256(password.encode()).hexdigest()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


class _DemoUser:
    """Lightweight stand-in when the real DB user isn't available."""
    def __init__(self, username: str, role: str):
        self.id = f"demo-{username}"
        self.username = username
        self.role = role
        self.email = f"{username}@prahari.local"
        self.is_active = True
        self.last_login = None
        self.hashed_password = ""


async def authenticate_user(db: AsyncSession, username: str, password: str):
    """
    Authenticate a user. Checks demo credentials first (always works),
    then falls back to the database for real users.
    """
    # 1. Demo / development credentials — plain-text comparison, always available
    if username in DEMO_USERS and DEMO_USERS[username]["password"] == password:
        return _DemoUser(username, DEMO_USERS[username]["role"])

    # 2. Database user with hashed password
    try:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if user and verify_password(password, user.hashed_password):
            return user
    except Exception:
        pass

    return None


async def get_current_user(db: AsyncSession, token: str) -> Optional[_DemoUser]:
    payload = decode_token(token)
    if not payload:
        return None
    username = payload.get("sub")
    role = payload.get("role", "viewer")
    if not username:
        return None

    # Try DB first
    try:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if user:
            return user
    except Exception:
        pass

    # Fall back to demo user
    if username in DEMO_USERS:
        return _DemoUser(username, role)
    return None


bearer_scheme = HTTPBearer()

async def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """JWT-backed identity dependency. Routers should use require_roles for writes."""
    # Avoid the dependency cycle introduced by database injection in this module.
    from ..database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        user = await get_current_user(session, credentials.credentials)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
    return user


def require_roles(*roles: str) -> Callable:
    async def guard(user=Depends(current_user)):
        if user.role.lower() not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your role is not allowed to perform this action")
        return user
    return guard
