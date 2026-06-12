from fastapi import FastAPI, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os

from app.database import engine, Base, get_db
from app import models, tournament
from app.routers import auth, matches, users, admin

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="World Cup Goal Predictor",
    description="FastAPI + HTML5 World Cup Goal Predictor Application",
    version="1.0.0"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static and template directories exist
os.makedirs("app/static/css", exist_ok=True)
os.makedirs("app/static/js", exist_ok=True)
os.makedirs("app/templates", exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Templates setup
templates = Jinja2Templates(directory="app/templates")

# Register API routers
app.include_router(auth.router)
app.include_router(matches.router)
app.include_router(users.router)
app.include_router(admin.router)

@app.on_event("startup")
def startup_event():
    # Automatically seed or sync database matches from the API
    db = next(get_db())
    try:
        print("Syncing 2026 World Cup matches from API on startup...")
        tournament.sync_matches_from_api(db)
        print("Startup sync completed successfully.")
    except Exception as e:
        print(f"Error syncing database on startup: {e}")
    finally:
        db.close()

@app.get("/", response_class=HTMLResponse)
def read_root(request: Request):
    """Serve the single page application interface."""
    return templates.TemplateResponse(request, "index.html")
