from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import time
from app import database, models, schemas, crud, auth, tournament

router = APIRouter(prefix="/api/matches", tags=["matches"])

# Cache the external API sync so /api/matches doesn't block on a network call
# on every page load. Re-sync at most every SYNC_TTL_SECONDS.
SYNC_TTL_SECONDS = 300  # 5 minutes
_last_sync_monotonic = 0.0


def _run_sync_and_mark():
    """Background-safe sync that opens its own session and stamps the cache."""
    global _last_sync_monotonic
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        tournament.sync_matches_from_api(db)
        _last_sync_monotonic = time.monotonic()
    except Exception as e:
        print(f"Background sync_matches_from_api failed: {e}")
    finally:
        db.close()


def _ensure_fresh_sync(background_tasks: BackgroundTasks):
    """Trigger a background sync if the cache is stale; never block the response."""
    if time.monotonic() - _last_sync_monotonic > SYNC_TTL_SECONDS:
        background_tasks.add_task(_run_sync_and_mark)

def get_current_time():
    """Helper to consistently get UTC time for kickoff comparisons."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

def get_optional_user(token: Optional[str] = Depends(auth.oauth2_scheme), db: Session = Depends(database.get_db)) -> Optional[models.User]:
    if not token:
        return None
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        user_id_int = int(user_id)
        return db.query(models.User).filter(models.User.id == user_id_int).first()
    except (auth.JWTError, ValueError):
        return None

def compute_prediction_status(match: models.Match, current_time: datetime) -> str:
    """Determine match prediction status: open, locked, completed."""
    return tournament.compute_prediction_status(match, current_time)

@router.get("", response_model=List[schemas.MatchResponse])
def get_matches_endpoint(
    background_tasks: BackgroundTasks,
    round_filter: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: Optional[models.User] = Depends(get_optional_user)
):
    # Schedule a background sync if the external cache is stale — never block.
    _ensure_fresh_sync(background_tasks)

    current_time = get_current_time()
    query = db.query(models.Match)
    
    if round_filter:
        if round_filter.lower() == "group":
            query = query.filter(models.Match.group_name.isnot(None))
        elif round_filter.lower() == "knockout":
            query = query.filter(models.Match.group_name.is_(None))
        else:
            # e.g., "Round of 16", "Quarterfinals", "Semifinals", "Final"
            query = query.filter(models.Match.round.ilike(f"%{round_filter}%"))
            
    matches = query.order_by(models.Match.kickoff_time).all()
    
    response_data = []
    user_predictions = {}
    if current_user:
        preds = crud.get_user_predictions(db, current_user.id)
        user_predictions = {p.match_id: p for p in preds}
        
    for match in matches:
        pred_status = compute_prediction_status(match, current_time)
        pred = user_predictions.get(match.id)
        
        # Pydantic schema will require prediction_status and user_prediction
        m_dict = schemas.MatchResponse.model_validate(match)
        m_dict.prediction_status = pred_status
        
        # Security rule: If prediction is open, user can see their own prediction.
        # If prediction is locked, they can still see their own.
        # But when returning predictions of others (handled in a separate endpoint if needed), we hide it.
        # Since this returns ONLY the current user's prediction, it's safe to return.
        m_dict.user_prediction = schemas.PredictionResponse.model_validate(pred) if pred else None
        
        response_data.append(m_dict)
        
    return response_data

@router.post("/{match_id}/predict", response_model=schemas.PredictionResponse)
def predict_match(
    match_id: int,
    prediction_in: schemas.PredictionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    current_time = get_current_time()
    match = crud.get_match(db, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    pred_status = compute_prediction_status(match, current_time)
    
    if pred_status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot predict a completed match"
        )
    elif pred_status == "locked":
        # Check why it's locked
        if not match.home_team or not match.away_team:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Predictions are not available until knockout teams are confirmed"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Predictions are locked 15 minutes before kickoff"
        )
        
    # Also enforce only future matches (kickoff_time > current_time)
    if match.kickoff_time <= current_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot predict a match that has already started"
        )
        
    # Store or update the prediction
    return crud.create_or_update_prediction(
        db, current_user.id, match_id, prediction_in.predicted_home_goals, prediction_in.predicted_away_goals
    )

@router.get("/leaderboard", response_model=List[schemas.LeaderboardEntry])
def get_leaderboard_endpoint(db: Session = Depends(database.get_db)):
    return crud.get_leaderboard(db)

@router.get("/bracket", response_model=List[schemas.MatchResponse])
def get_bracket_endpoint(
    db: Session = Depends(database.get_db),
    current_user: Optional[models.User] = Depends(get_optional_user)
):
    """Retrieve all 32 knockout stage matches for the visual bracket."""
    current_time = get_current_time()
    # Knockout stage matches are IDs 73 to 104
    matches = db.query(models.Match).filter(models.Match.id >= 73).order_by(models.Match.id).all()
    
    response_data = []
    user_predictions = {}
    if current_user:
        preds = crud.get_user_predictions(db, current_user.id)
        user_predictions = {p.match_id: p for p in preds}
        
    for match in matches:
        pred_status = compute_prediction_status(match, current_time)
        pred = user_predictions.get(match.id)
        
        m_dict = schemas.MatchResponse.model_validate(match)
        m_dict.prediction_status = pred_status
        m_dict.user_prediction = schemas.PredictionResponse.model_validate(pred) if pred else None
        
        response_data.append(m_dict)
        
    return response_data
