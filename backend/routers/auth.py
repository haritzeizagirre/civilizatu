from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId
from datetime import datetime

from database import get_db
from models.user_models import UserCreate, UserLogin, UserPublic, TokenResponse
from services.auth_service import hash_password, verify_password, create_access_token
from services.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _serialize_user(doc: dict) -> UserPublic:
    return UserPublic(
        id=str(doc["_id"]),
        username=doc["username"],
        email=doc["email"],
        created_at=doc["created_at"],
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate):
    db = get_db()
    # Check uniqueness
    if await db.users.find_one({"username": body.username}):
        raise HTTPException(status_code=400, detail="Username already taken")
    if await db.users.find_one({"email": body.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    doc = {
        "username": body.username,
        "email": body.email,
        "password_hash": hash_password(body.password),
        "created_at": datetime.utcnow(),
        "last_login": datetime.utcnow(),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id

    token = create_access_token({"sub": str(result.inserted_id), "username": body.username})
    return TokenResponse(access_token=token, user=_serialize_user(doc))


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin):
    db = get_db()
    doc = await db.users.find_one({"username": body.username})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    await db.users.update_one({"_id": doc["_id"]}, {"$set": {"last_login": datetime.utcnow()}})
    token = create_access_token({"sub": str(doc["_id"]), "username": doc["username"]})
    return TokenResponse(access_token=token, user=_serialize_user(doc))


@router.get("/profile", response_model=UserPublic)
async def get_profile(current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.users.find_one({"_id": ObjectId(current_user["sub"])})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize_user(doc)
