import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from dotenv import load_dotenv

load_dotenv()

from app import auth, database, models, seed
from app.database import get_session
from app.models import User
from app.schemas import UserResponse, TokenResponse
from app.routers import zones, records

app = FastAPI(title="AWS Route 53 Clone API", version="1.0.0")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    database.create_db_and_tables()
    with Session(database.engine) as session:
        seed.seed_database(session)

app.include_router(zones.router, prefix="/api", tags=["zones"])
app.include_router(records.router, prefix="/api", tags=["records"])

@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "healthy", "service": "route53-backend"}

@app.post("/api/auth/login", response_model=TokenResponse, tags=["auth"])
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    """Authenticate with username & password against the SQLite database."""
    user = session.exec(select(User).where(User.username == form_data.username)).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = auth.create_access_token(data={"sub": user.username})
    return TokenResponse(access_token=access_token, token_type="bearer")

@app.post("/api/auth/logout", tags=["auth"])
async def logout():
    """Stateless client logout."""
    return {"message": "Logged out successfully"}

@app.get("/api/auth/me", response_model=UserResponse, tags=["auth"])
async def read_users_me(
    current_user: User = Depends(auth.get_current_user),
):
    """Validate current session token and return user profile from SQLite."""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        created_at=current_user.created_at,
    )
