FROM python:3.11-slim

WORKDIR /app

# --- CRITICAL FIX: Install ffmpeg ---
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*
# ------------------------------------

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 10000

# Command will be overridden by docker-compose
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]