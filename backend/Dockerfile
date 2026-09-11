# Backend Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories for data and models
RUN mkdir -p data models/saved_models

# Generate synthetic data and train models if not already present
RUN if [ ! -f data/student_data.csv ]; then \
        cd data && python generate_synthetic_data.py; \
    fi && \
    if [ ! -f models/saved_models/random_forest_model.pkl ]; then \
        cd models && python train_models.py; \
    fi

# Expose port
EXPOSE 5000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV MODEL_DIR=/app/models/saved_models
ENV FLASK_APP=app/app.py

# Health check (using curl instead of requests)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run with gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "120", "app.app:app"]
