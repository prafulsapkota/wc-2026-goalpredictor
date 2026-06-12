from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import urllib.request
import json
from app import models

# Mapping of 2026 knockout matches (R32 -> R16 -> QF -> SF)
# Format: match_id: (destination_match_id, slot_type)
KNOCKOUT_PROGRESSION = {
    # Round of 32 -> Round of 16
    74: (89, "home"),
    77: (89, "away"),
    73: (90, "home"),
    75: (90, "away"),
    76: (91, "home"),
    78: (91, "away"),
    79: (92, "home"),
    80: (92, "away"),
    83: (93, "home"),
    84: (93, "away"),
    81: (94, "home"),
    82: (94, "away"),
    86: (95, "home"),
    88: (95, "away"),
    85: (96, "home"),
    87: (96, "away"),

    # Round of 16 -> Quarterfinals
    89: (97, "home"),
    90: (97, "away"),
    93: (98, "home"),
    94: (98, "away"),
    91: (99, "home"),
    92: (99, "away"),
    95: (100, "home"),
    96: (100, "away"),

    # Quarterfinals -> Semifinals
    97: (101, "home"),
    98: (101, "away"),
    99: (102, "home"),
    100: (102, "away"),
}

# Semifinals have progression to both Final (104) and Third Place (103)
# Format: semifinal_match_id: {"winner": (104, slot), "loser": (103, slot)}
SEMIFINAL_PROGRESSION = {
    101: {"winner": (104, "home"), "loser": (103, "home")},
    102: {"winner": (104, "away"), "loser": (103, "away")},
}

def sync_matches_from_api(db: Session):
    """Fetch 2026 World Cup matches from the API and sync them to the database."""
    url = "https://worldcup26.ir/get/games"
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            games = data.get("games", [])
    except Exception as e:
        print(f"Error fetching matches from API: {e}")
        return

    for game in games:
        match_id = int(game["id"])
        
        # Determine round name
        g_type = game.get("type", "group")
        group = game.get("group")
        if g_type == "group":
            round_name = f"Group Stage - Group {group}"
        elif g_type == "r32":
            round_name = "Round of 32"
        elif g_type == "r16":
            round_name = "Round of 16"
        elif g_type == "qf":
            round_name = "Quarterfinals"
        elif g_type == "sf":
            round_name = "Semifinals"
        elif g_type == "third":
            round_name = "Third Place Playoff"
        elif g_type == "final":
            round_name = "Final"
        else:
            round_name = "Group Stage"
            
        # Parse kickoff time
        local_date_str = game.get("local_date", "")
        try:
            kickoff = datetime.strptime(local_date_str, "%m/%d/%Y %H:%M")
        except Exception:
            kickoff = datetime.now()
            
        # Parse teams and placeholders
        home_team = game.get("home_team_name_en")
        away_team = game.get("away_team_name_en")
        if home_team == "null" or not home_team:
            home_team = None
        if away_team == "null" or not away_team:
            away_team = None
            
        home_placeholder = game.get("home_team_label")
        away_placeholder = game.get("away_team_label")
        if home_placeholder == "null" or not home_placeholder:
            home_placeholder = None
        if away_placeholder == "null" or not away_placeholder:
            away_placeholder = None
            
        # Parse scores and status
        finished = game.get("finished", "FALSE") == "TRUE" or game.get("time_elapsed") == "finished"
        home_score = None
        away_score = None
        status = "scheduled"
        winning_team = None
        
        if finished:
            status = "completed"
            try:
                home_score = int(game.get("home_score", 0))
                away_score = int(game.get("away_score", 0))
                
                # Determine winning team
                if home_score > away_score:
                    winning_team = home_team
                elif away_score > home_score:
                    winning_team = away_team
            except Exception:
                pass
                
        # Look for existing match in DB
        match = db.query(models.Match).filter(models.Match.id == match_id).first()
        
        was_completed = False
        if match:
            was_completed = match.status == "completed"
            # Update fields
            match.round = round_name
            match.home_team = home_team
            match.away_team = away_team
            match.home_placeholder = home_placeholder
            match.away_placeholder = away_placeholder
            match.kickoff_time = kickoff
            match.home_score = home_score
            match.away_score = away_score
            match.status = status
            match.group_name = group if g_type == "group" else None
            match.winning_team = winning_team
        else:
            # Create new match
            match = models.Match(
                id=match_id,
                round=round_name,
                home_team=home_team,
                away_team=away_team,
                home_placeholder=home_placeholder,
                away_placeholder=away_placeholder,
                kickoff_time=kickoff,
                home_score=home_score,
                away_score=away_score,
                status=status,
                group_name=group if g_type == "group" else None,
                winning_team=winning_team
            )
            db.add(match)
            
        db.commit()
        
        # If it just completed, score predictions!
        if finished and not was_completed:
            score_predictions_for_match(db, match)

def seed_matches(db: Session):
    """Seed the database with all 2026 World Cup matches from the API."""
    # Delete existing predictions and matches to reset
    db.query(models.Prediction).delete()
    db.query(models.Match).delete()
    db.commit()
    
    sync_matches_from_api(db)

def calculate_group_standings(db: Session, group_name: str):
    """Calculate the group standings and populate Round of 32 slots if group matches are all completed."""
    # Find all matches in this group
    matches = db.query(models.Match).filter(models.Match.group_name == group_name).all()
    
    # Check if all matches are completed
    all_completed = all(m.status == "completed" for m in matches)
    
    # Initialize stats for all unique teams found in the group matches
    teams = set()
    for m in matches:
        if m.home_team:
            teams.add(m.home_team)
        if m.away_team:
            teams.add(m.away_team)
            
    standings = {team: {"points": 0, "gd": 0, "gs": 0, "name": team} for team in teams}
    
    for m in matches:
        if m.status == "completed" and m.home_score is not None and m.away_score is not None:
            home, away = m.home_team, m.away_team
            hs, as_ = m.home_score, m.away_score
            
            # Goals Scored (GS) and Goal Difference (GD)
            standings[home]["gs"] += hs
            standings[home]["gd"] += (hs - as_)
            standings[away]["gs"] += as_
            standings[away]["gd"] += (as_ - hs)
            
            # Points
            if hs > as_:
                standings[home]["points"] += 3
            elif as_ > hs:
                standings[away]["points"] += 3
            else:
                standings[home]["points"] += 1
                standings[away]["points"] += 1
                
    # Sort standings: Points DESC, Goal Difference DESC, Goals Scored DESC, Name ASC
    sorted_standings = sorted(
        standings.values(),
        key=lambda x: (-x["points"], -x["gd"], -x["gs"], x["name"])
    )
    
    # If all matches completed, update corresponding Round of 32 slots!
    if all_completed and len(sorted_standings) >= 2:
        winner = sorted_standings[0]["name"]
        runner_up = sorted_standings[1]["name"]
        
        # Look for Round of 32 matches that depend on this group
        winner_placeholder = f"Winner Group {group_name}"
        runner_up_placeholder = f"Runner-up Group {group_name}"
        
        # Find matches that have this home_placeholder or away_placeholder
        home_winner_matches = db.query(models.Match).filter(
            models.Match.home_placeholder == winner_placeholder
        ).all()
        for m in home_winner_matches:
            m.home_team = winner
            
        away_winner_matches = db.query(models.Match).filter(
            models.Match.away_placeholder == winner_placeholder
        ).all()
        for m in away_winner_matches:
            m.away_team = winner
            
        home_runner_up_matches = db.query(models.Match).filter(
            models.Match.home_placeholder == runner_up_placeholder
        ).all()
        for m in home_runner_up_matches:
            m.home_team = runner_up
            
        away_runner_up_matches = db.query(models.Match).filter(
            models.Match.away_placeholder == runner_up_placeholder
        ).all()
        for m in away_runner_up_matches:
            m.away_team = runner_up

        db.commit()

def check_and_advance_knockout(db: Session, completed_match: models.Match):
    """Advance the winner of a completed knockout match to the next round."""
    match_id = completed_match.id
    
    # Determine the winning team and losing team
    if completed_match.home_score > completed_match.away_score:
        winner = completed_match.home_team
        loser = completed_match.away_team
    elif completed_match.away_score > completed_match.home_score:
        winner = completed_match.away_team
        loser = completed_match.home_team
    else:
        # It's a draw, use the winning_team override (e.g., from penalty shootout)
        winner = completed_match.winning_team
        loser = completed_match.home_team if winner == completed_match.away_team else completed_match.away_team
        
    if not winner:
        # Default to home team if not specified to prevent errors
        winner = completed_match.home_team
        loser = completed_match.away_team
        completed_match.winning_team = winner
        db.commit()

    # Progress Winner to next match
    if match_id in KNOCKOUT_PROGRESSION:
        dest_match_id, slot = KNOCKOUT_PROGRESSION[match_id]
        dest_match = db.query(models.Match).filter(models.Match.id == dest_match_id).first()
        if dest_match:
            if slot == "home":
                dest_match.home_team = winner
            else:
                dest_match.away_team = winner
            db.commit()

    elif match_id in SEMIFINAL_PROGRESSION:
        prog = SEMIFINAL_PROGRESSION[match_id]
        
        # 1. Winner goes to Final (104)
        final_match_id, final_slot = prog["winner"]
        final_match = db.query(models.Match).filter(models.Match.id == final_match_id).first()
        if final_match:
            if final_slot == "home":
                final_match.home_team = winner
            else:
                final_match.away_team = winner
                
        # 2. Loser goes to Third Place (103)
        tp_match_id, tp_slot = prog["loser"]
        tp_match = db.query(models.Match).filter(models.Match.id == tp_match_id).first()
        if tp_match:
            if tp_slot == "home":
                tp_match.home_team = loser
            else:
                tp_match.away_team = loser
                
        db.commit()

def score_predictions_for_match(db: Session, match: models.Match):
    """Score all user predictions for a completed match."""
    if match.status != "completed" or match.home_score is None or match.away_score is None:
        return
        
    actual_goals = match.home_score + match.away_score
    predictions = db.query(models.Prediction).filter(models.Prediction.match_id == match.id).all()
    
    for pred in predictions:
        diff = abs(pred.predicted_goals - actual_goals)
        if diff == 0:
            pred.points_earned = 10  # Perfect score
        elif diff == 1:
            pred.points_earned = 5   # Off by 1
        elif diff == 2:
            pred.points_earned = 2   # Off by 2
        else:
            pred.points_earned = 0   # Off by 3 or more
            
    db.commit()
