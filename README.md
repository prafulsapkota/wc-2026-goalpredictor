# 🏆 World Cup Goal Predictor

A modern, containerized **FastAPI + SQLite + Jinja2** web application that allows users to predict the total number of goals scored in the **2026 FIFA World Cup** matches. Features an interactive Single Page Application (SPA) dashboard, real-time match synchronization from an external API, auto-progression of knockout bracket matches, a global leader board, and a comprehensive admin console.

---

## 🌟 Features

*   **🔒 Secure JWT Authentication**: Users can register and log in securely. Password hashing is implemented using `bcrypt`.
*   **🔄 Live Match Synchronization**: Automatically syncs matches, kickoff times, status, and final scores for the 2026 World Cup from a live tournament API on application startup and endpoint access.
*   **🎯 Goal Predictions**:
    *   Submit predictions for the home and away team goals.
    *   Predictions are locked **15 minutes** before kickoff.
*   **📊 Goal-based Scoring System**:
    *   **10 Points**: Perfect prediction (total predicted goals matches actual goals exactly).
    *   **5 Points**: Off by 1 goal.
    *   **2 Points**: Off by 2 goals.
    *   **0 Points**: Off by 3 or more goals.
*   **🏆 Global Leaderboard**: Ranks all users dynamically based on:
    1.  *Total Points* (Descending)
    2.  *Number of Exact (10 pts) Predictions* (Descending)
    3.  *Username* (Alphabetical)
*   **🛠️ Admin Panel**: Admins can trigger manual syncs, edit scores manually for any match, and recalculate points for all predictions instantly.
*   **🐳 Dockerized Deployment**: Built-in [Dockerfile](file:///home/prafulsapkota/worldcup/Dockerfile) and [docker-compose.yml](file:///home/prafulsapkota/worldcup/docker-compose.yml) configurations with a persistent SQLite volume.

---

## 📁 Project Structure

```text
worldcup/
├── app/
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── admin.py          # Admin endpoints (match scoring & syncing)
│   │   ├── auth.py           # Authentication routes (login & registration)
│   │   ├── matches.py        # Match list, leaderboard, & prediction submissions
│   │   └── users.py          # User profiles & prediction history
│   ├── static/               # Static frontend resources (CSS, JS, assets)
│   │   ├── css/
│   │   │   └── styles.css
│   │   └── js/
│   │       └── app.js
│   ├── templates/            # HTML templates (Jinja2)
│   │   └── index.html
│   ├── __init__.py
│   ├── config.py             # Environment configurations & database URL
│   ├── crud.py               # Database CRUD helper functions
│   ├── database.py           # SQLAlchemy engine & session setup
│   ├── main.py               # Application entry point & FastAPI instance
│   ├── models.py             # SQLAlchemy models (User, Match, Prediction)
│   ├── schemas.py            # Pydantic schemas for request validation & API response
│   └── tournament.py         # Match syncing logic & bracket progression mappings
├── .dockerignore
├── .env                      # Local environment variables
├── Dockerfile                # Production-ready docker image definition
├── docker-compose.yml        # Docker compose configuration
├── requirements.txt          # Python application dependencies
└── predictor.db              # Local SQLite database file (git-ignored)
```

---

## 🚀 Getting Started

### Method 1: Running Locally (Python & Virtual Environment)

1.  **Clone or navigate** to the project directory:
    ```bash
    cd /home/prafulsapkota/worldcup
    ```

2.  **Create and activate a virtual environment**:
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    ```

3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Set up Environment Variables**:
    Create or edit the local [.env](file:///home/prafulsapkota/worldcup/.env) file:
    ```ini
    DATABASE_URL=sqlite:///./predictor.db
    SECRET_KEY=super_secret_world_cup_predictor_key_123456789
    ```

5.  **Run the FastAPI Server**:
    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port 5005 --reload
    ```

6.  **Access the Application**:
    *   **Dashboard / UI**: [http://localhost:5005](http://localhost:5005)
    *   **Interactive Swagger API Docs**: [http://localhost:5005/docs](http://localhost:5005/docs)
    *   **Alternative ReDoc**: [http://localhost:5005/redoc](http://localhost:5005/redoc)

---

### Method 2: Running with Docker Compose (Recommended)

1.  **Build and start the container**:
    ```bash
    docker-compose up --build -d
    ```

2.  **Check application logs**:
    ```bash
    docker-compose logs -f
    ```

3.  **Access the Application**:
    Open your browser and navigate to [http://localhost:5005](http://localhost:5005).

4.  **Persistent Database**:
    Docker compose maps a named volume `worldcup_data` to `/data` in the container. The database file `predictor.db` will persist even if the container is rebuilt or stopped.

---

## ⚙️ Configuration

The app is configured via standard environment variables:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./predictor.db` | SQLAlchemy connection string. |
| `SECRET_KEY` | `super_secret_world_cup_predictor_key_123456789` | JWT token encryption key. |
| `ALGORITHM` | `HS256` | JWT signature algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 Days) | JWT token lifespan. |

---

## 🏗️ Core Technologies

*   **Backend Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
*   **Database ORM**: [SQLAlchemy](https://www.sqlalchemy.org/)
*   **Database Engine**: SQLite
*   **Frontend**: Plain HTML5, CSS3 (Vanilla CSS), and Vanilla Javascript (SPA setup with state updates)
*   **Containerization**: Docker & Docker Compose
