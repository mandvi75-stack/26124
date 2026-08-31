from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import datetime, timezone

from ..database import get_db
from ..services.auth import authenticate_user, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    
    # Update last login (only for real DB users)
    try:
        user.last_login = datetime.now(timezone.utc)
        await db.commit()
    except Exception:
        pass
    
    token = create_access_token({"sub": user.username, "role": user.role})
    
    return LoginResponse(
        access_token=token,
        username=user.username,
        role=user.role,
    )


@router.get("/me")
async def get_me(credentials: HTTPAuthorizationCredentials = Depends(security), db: AsyncSession = Depends(get_db)):
    user = await get_current_user(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return {"username": user.username, "role": user.role, "email": user.email}


@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}
