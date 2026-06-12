from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import random
from datetime import datetime, timezone
from app import database, models, schemas, auth, tournament

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.post("/seed", status_code=status.HTTP_200_OK)
def seed_database(
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(auth.get_current_admin)
):
    """Seed or re-seed the World Cup match data."""
    try:
        tournament.seed_matches(db)
        return {"message": "Database successfully seeded with 104 World Cup matches"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed database: {str(e)}"
        )

@router.post("/reset", status_code=status.HTTP_200_OK)
def reset_database(
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(auth.get_current_admin)
):
    """Reset all match scores, predictions, and bracket placements (keeps users)."""
    try:
        tournament.seed_matches(db)
        return {"message": "All matches and predictions reset successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset database: {str(e)}"
        )

@router.post("/matches/{match_id}/score", response_model=schemas.MatchResponse)
def update_match_score(
    match_id: int,
    score_update: schemas.MatchScoreUpdate,
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(auth.get_current_admin)
):
    """Update a match score, score all predictions, and advance teams in the bracket."""
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    if not match.home_team or not match.away_team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update score for a match with unconfirmed teams"
        )
        
    # If it is a draw in knockout stage, we need a winning team override
    if match.group_name is None and score_update.home_score == score_update.away_score:
        if not score_update.winning_team:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Knockout matches cannot end in a draw without a winning team specified (penalty/extra-time winner)"
            )
        if score_update.winning_team not in [match.home_team, match.away_team]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Winning team must be either {match.home_team} or {match.away_team}"
            )
            
    # Update score and status
    match.home_score = score_update.home_score
    match.away_score = score_update.away_score
    match.winning_team = score_update.winning_team
    
    # If it's a normal win/loss, automatically set winning team
    if score_update.home_score > score_update.away_score:
        match.winning_team = match.home_team
    elif score_update.away_score > score_update.home_score:
        match.winning_team = match.away_team
        
    match.status = "completed"
    db.commit()
    
    # Score predictions for this match
    tournament.score_predictions_for_match(db, match)
    
    # Update bracket/standings
    if match.group_name:
        # Group stage match
        tournament.calculate_group_standings(db, match.group_name)
    else:
        # Knockout stage match
        tournament.check_and_advance_knockout(db, match)
        
    # Re-fetch match with updated properties
    db.refresh(match)
    
    # Format and return response
    current_time = datetime.now(timezone.utc).replace(tzinfo=None)
    pred_status = tournament.compute_prediction_status(match, current_time)
    
    m_dict = schemas.MatchResponse.model_validate(match)
    m_dict.prediction_status = pred_status
    m_dict.user_prediction = None
    
    return m_dict

@router.post("/simulate-group-stage", status_code=status.HTTP_200_OK)
def simulate_group_stage(
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(auth.get_current_admin)
):
    """Simulate realistic random scores for all 72 group stage matches and progress standings."""
    try:
        # Get all group stage matches (IDs 1 to 72)
        group_matches = db.query(models.Match).filter(models.Match.group_name.isnot(None)).all()
        
        for m in group_matches:
            # Generate realistic football scores (higher probability for 1, 2, 0 goals)
            home_score = random.choices([0, 1, 2, 3, 4, 5], weights=[20, 35, 25, 12, 6, 2])[0]
            away_score = random.choices([0, 1, 2, 3, 4, 5], weights=[22, 36, 24, 11, 5, 2])[0]
            
            m.home_score = home_score
            m.away_score = away_score
            m.status = "completed"
            
            if home_score > away_score:
                m.winning_team = m.home_team
            elif away_score > home_score:
                m.winning_team = m.away_team
            else:
                m.winning_team = None  # Draw is fine in group stage
                
            db.commit()
            
            # Score predictions for this match
            tournament.score_predictions_for_match(db, m)
            
        # Re-calculate standings for all groups (A to L) to populate the R32
        for group_char in "ABCDEFGHIJKL":
            tournament.calculate_group_standings(db, group_char)
            
        return {"message": "All 72 group stage matches simulated and standings computed. Bracket populated."}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to simulate group stage: {str(e)}"
        )
