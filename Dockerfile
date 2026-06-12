# Use official Python 3.12-slim base image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=5005
# Route the database file to a dedicated data directory for volume mapping
ENV DATABASE_URL=sqlite:////data/predictor.db

# Set working directory
WORKDIR /workspace

# Install system dependencies for potential builds
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create the persistent data directory
RUN mkdir -p /data

# Define the persistent volume mount point
VOLUME ["/data"]

# Expose port 5005
EXPOSE 5005

# Run the FastAPI server on port 5005
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5005"]
