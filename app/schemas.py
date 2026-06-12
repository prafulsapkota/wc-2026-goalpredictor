from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# --- User Schemas ---
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)

class UserLogin(BaseModel):
    email: str  # Can be email or username
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None

# --- Prediction Schemas ---
class PredictionCreate(BaseModel):
    predicted_home_goals: int = Field(..., ge=0, le=15)
    predicted_away_goals: int = Field(..., ge=0, le=15)

class PredictionResponse(BaseModel):
    id: int
    user_id: int
    match_id: int
    predicted_goals: int
    predicted_home_goals: int
    predicted_away_goals: int
    points_earned: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PredictionDetail(BaseModel):
    id: int
    match_id: int
    round: str
    home_team: Optional[str] = None
    away_team: Optional[str] = None
    home_placeholder: Optional[str] = None
    away_placeholder: Optional[str] = None
    kickoff_time: datetime
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    predicted_goals: int
    predicted_home_goals: int
    predicted_away_goals: int
    points_earned: Optional[int] = None
    status: str  # prediction status: 'scored', 'completed', 'locked', 'open'

    class Config:
        from_attributes = True

# --- Match Schemas ---
class MatchResponse(BaseModel):
    id: int
    round: str
    home_team: Optional[str] = None
    away_team: Optional[str] = None
    home_placeholder: Optional[str] = None
    away_placeholder: Optional[str] = None
    kickoff_time: datetime
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    status: str
    group_name: Optional[str] = None
    winning_team: Optional[str] = None
    
    # Extra field populated dynamically
    prediction_status: Optional[str] = None  # 'open', 'locked', 'completed'
    user_prediction: Optional[PredictionResponse] = None

    class Config:
        from_attributes = True

class MatchScoreUpdate(BaseModel):
    home_score: int = Field(..., ge=0, le=20)
    away_score: int = Field(..., ge=0, le=20)
    winning_team: Optional[str] = None  # Required for knockout draws

# --- Leaderboard Schema ---
class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    total_points: int
    exact_predictions: int
    total_predictions: int

# --- User Stats & Profile Schema ---
class UserStats(BaseModel):
    total_points: int
    total_predictions: int
    exact_predictions: int
    close_predictions: int  # Off by 1
    accuracy_rate: float     # Percentage of scored predictions that got > 0 points
    average_points: float

class UserProfileResponse(BaseModel):
    user: UserResponse
    stats: UserStats
    history: List[PredictionDetail]
