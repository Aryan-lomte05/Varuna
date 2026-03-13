# Start FastAPI API Locally
$env:APP_ENV="dev"
$env:POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/floatchat"
$env:REDIS_URL="redis://localhost:6379"
$env:QDRANT_URL="http://localhost:6333"
$env:OLLAMA_URL="http://localhost:11434"
$env:OLLAMA_SQL_MODEL="qwen2.5:14b"
$env:OLLAMA_NARRATE_MODEL="llama3:8b"

Write-Host "🌊 Starting FloatChat API on http://localhost:8000" -ForegroundColor Cyan
.\venv\Scripts\python.exe main.py
