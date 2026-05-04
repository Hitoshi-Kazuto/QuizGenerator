from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
import os
from dotenv import load_dotenv
from database import Teacher, Student, verify_password

# Load environment variables
load_dotenv()

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-for-jwt-tokens")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Token functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict:
    """
    Synchronous JWT verification (for WebSocket auth).
    Raises JWTError on invalid/expired tokens.
    Returns the decoded payload dict.
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    user_id: str = payload.get("sub")
    user_type: str = payload.get("type")
    if not user_id or not user_type:
        from jose import JWTError
        raise JWTError("Missing sub or type claim")
    return payload

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        user_type: str = payload.get("type")
        if user_id is None or user_type is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    if user_type == "teacher":
        user = await Teacher.get_by_id(user_id)
    elif user_type == "student":
        user = await Student.get_by_id(user_id)
    else:
        raise credentials_exception
    
    if user is None:
        raise credentials_exception
    return user

async def get_current_teacher(token: str = Depends(oauth2_scheme)):
    user = await get_current_user(token)
    if not user or "email" not in user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a teacher"
        )
    return user

async def get_current_student(token: str = Depends(oauth2_scheme)):
    user = await get_current_user(token)
    if not user or "email" not in user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a student"
        )
    return user

# Authentication functions
async def authenticate_teacher(email: str, password: str):
    teacher = await Teacher.get_by_email(email)
    if not teacher:
        return False
    if not verify_password(password, teacher["password"]):
        return False
    return teacher

async def authenticate_student(email: str, password: str):
    student = await Student.get_by_email(email)
    if not student:
        return False
    if not verify_password(password, student["password"]):
        return False
    return student 