from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from app import models, schemas, auth

# --- User CRUD ---
def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user_in: schemas.UserCreate):
    hashed_pw = auth.get_password_hash(user_in.password)
    # The first user registered can be admin for convenience, or we can set it via a flag
    is_admin = db.query(models.User).count() == 0
    
    db_user = models.User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_pw,
        is_admin=is_admin
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Match CRUD ---
def get_match(db: Session, match_id: int):
    return db.query(models.Match).filter(models.Match.id == match_id).first()

def get_matches(db: Session):
    return db.query(models.Match).order_by(models.Match.kickoff_time).all()

# --- Prediction CRUD ---
def get_prediction(db: Session, prediction_id: int):
    return db.query(models.Prediction).filter(models.Prediction.id == prediction_id).first()

def get_user_prediction_for_match(db: Session, user_id: int, match_id: int):
    return db.query(models.Prediction).filter(
        models.Prediction.user_id == user_id,
        models.Prediction.match_id == match_id
    ).first()

def get_user_predictions(db: Session, user_id: int):
    return db.query(models.Prediction).filter(models.Prediction.user_id == user_id).all()

def create_or_update_prediction(db: Session, user_id: int, match_id: int, predicted_home_goals: int, predicted_away_goals: int):
    # Check if prediction already exists
    pred = get_user_prediction_for_match(db, user_id, match_id)
    predicted_goals = predicted_home_goals + predicted_away_goals
    if pred:
        pred.predicted_home_goals = predicted_home_goals
        pred.predicted_away_goals = predicted_away_goals
        pred.predicted_goals = predicted_goals
        pred.updated_at = datetime.now()
    else:
        pred = models.Prediction(
            user_id=user_id,
            match_id=match_id,
            predicted_home_goals=predicted_home_goals,
            predicted_away_goals=predicted_away_goals,
            predicted_goals=predicted_goals
        )
        db.add(pred)
    db.commit()
    db.refresh(pred)
    return pred

# --- Stats & Leaderboard ---
def get_leaderboard(db: Session):
    """Get the leaderboard of users ranked by points."""
    # Query all users
    users = db.query(models.User).all()
    
    leaderboard = []
    for user in users:
        # Calculate stats for the user
        preds = db.query(models.Prediction).filter(
            models.Prediction.user_id == user.id,
            models.Prediction.points_earned.isnot(None)
        ).all()
        
        total_points = sum(p.points_earned for p in preds if p.points_earned is not None)
        exact_predictions = sum(1 for p in preds if p.points_earned == 10)
        total_predictions = len(preds)
        
        leaderboard.append({
            "username": user.username,
            "total_points": total_points,
            "exact_predictions": exact_predictions,
            "total_predictions": total_predictions
        })
        
    # Sort leaderboard: total_points DESC, exact_predictions DESC, username ASC
    sorted_leaderboard = sorted(
        leaderboard,
        key=lambda x: (-x["total_points"], -x["exact_predictions"], x["username"])
    )
    
    # Assign ranks
    for i, entry in enumerate(sorted_leaderboard):
        entry["rank"] = i + 1
        
    return sorted_leaderboard

def get_user_stats(db: Session, user_id: int):
    """Get statistics for a specific user."""
    preds = db.query(models.Prediction).filter(
        models.Prediction.user_id == user_id
    ).all()
    
    total_predictions = len(preds)
    scored_preds = [p for p in preds if p.points_earned is not None]
    total_scored = len(scored_preds)
    
    total_points = sum(p.points_earned for p in scored_preds)
    exact_predictions = sum(1 for p in scored_preds if p.points_earned == 10)
    close_predictions = sum(1 for p in scored_preds if p.points_earned == 5)
    
    # Accuracy rate is percentage of predictions that earned points (> 0)
    points_earning_preds = sum(1 for p in scored_preds if p.points_earned > 0)
    accuracy_rate = (points_earning_preds / total_scored * 100) if total_scored > 0 else 0.0
    average_points = (total_points / total_scored) if total_scored > 0 else 0.0
    
    return schemas.UserStats(
        total_points=total_points,
        total_predictions=total_predictions,
        exact_predictions=exact_predictions,
        close_predictions=close_predictions,
        accuracy_rate=round(accuracy_rate, 1),
        average_points=round(average_points, 2)
    )
