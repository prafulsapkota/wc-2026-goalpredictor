from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    predictions = relationship("Prediction", back_populates="user", cascade="all, delete-orphan")


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)  # Match 1 to 64
    round = Column(String, nullable=False)  # e.g., 'Group A', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Third Place', 'Final'
    home_team = Column(String, nullable=True)  # Nullable for unconfirmed knockout matches
    away_team = Column(String, nullable=True)
    home_placeholder = Column(String, nullable=True)  # e.g., 'Winner Group A'
    away_placeholder = Column(String, nullable=True)  # e.g., 'Runner-up Group B'
    kickoff_time = Column(DateTime, nullable=False)
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)
    status = Column(String, default="scheduled")  # 'scheduled', 'completed'
    group_name = Column(String, nullable=True)  # 'A', 'B', etc. for Group Stage, None for Knockout
    winning_team = Column(String, nullable=True)  # To handle who advances (especially on draws/penalties in knockouts)

    predictions = relationship("Prediction", back_populates="match", cascade="all, delete-orphan")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    predicted_goals = Column(Integer, nullable=False)  # Total goals predicted (0 to 10+)
    predicted_home_goals = Column(Integer, default=0, nullable=False)
    predicted_away_goals = Column(Integer, default=0, nullable=False)
    points_earned = Column(Integer, nullable=True)  # None until match is completed
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="predictions")
    match = relationship("Match", back_populates="predictions")

    __table_args__ = (
        UniqueConstraint("user_id", "match_id", name="uq_user_match_prediction"),
    )
