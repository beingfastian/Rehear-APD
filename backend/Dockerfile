FROM python:3.11-slim

WORKDIR /app

# System dependencies: gcc for psycopg build, ffmpeg for audio conversion,
# libpq-dev for psycopg3, postgresql-client for health checks
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    postgresql-client \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose FastAPI port
EXPOSE 10000

# Default command (overridden by docker-compose for worker)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]