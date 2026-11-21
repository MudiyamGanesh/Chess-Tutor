FROM python:3.11-slim

# Install Stockfish chess engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    stockfish \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY chess-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY chess-backend/main.py .

ENV HOST=0.0.0.0 \
    PORT=8000 \
    STOCKFISH_PATH=/usr/games/stockfish \
    PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
