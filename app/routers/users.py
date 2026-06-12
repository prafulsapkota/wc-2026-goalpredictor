from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
from app import database, models, schemas, crud, auth

router = APIRouter(prefix="/api/users", tags=["users"])

def get_current_time():
    return datetime.now()

@router.get("/profile", response_model=schemas.UserProfileResponse)
def get_user_profile(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    current_time = get_current_time()
    
    # 1. Fetch user stats
    stats = crud.get_user_stats(db, current_user.id)
    
    # 2. Fetch user predictions with match details
    predictions = db.query(models.Prediction).filter(
        models.Prediction.user_id == current_user.id
    ).all()
    
    history = []
    for pred in predictions:
        match = pred.match
        
        # Calculate prediction details status
        if match.status == "completed":
            pred_status = "scored" if pred.points_earned is not None else "completed"
        elif match.kickoff_time - current_time < timedelta(minutes=15):
            pred_status = "locked"
        else:
            pred_status = "open"
            
        detail = schemas.PredictionDetail(
            id=pred.id,
            match_id=match.id,
            round=match.round,
            home_team=match.home_team,
            away_team=match.away_team,
            home_placeholder=match.home_placeholder,
            away_placeholder=match.away_placeholder,
            kickoff_time=match.kickoff_time,
            home_score=match.home_score,
            away_score=match.away_score,
            predicted_goals=pred.predicted_goals,
            points_earned=pred.points_earned,
            status=pred_status
        )
        history.append(detail)
        
    # Sort history by kickoff time (most recent completed/scored or next upcoming)
    # Let's sort by kickoff_time descending (newest match first)
    history.sort(key=lambda x: x.kickoff_time, reverse=True)
    
    user_res = schemas.UserResponse.model_validate(current_user)
    
    return schemas.UserProfileResponse(
        user=user_res,
        stats=stats,
        history=history
    )
