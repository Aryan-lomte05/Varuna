# Start Gateway Locally
$env:PORT="4000"
$env:API_URL="http://localhost:8000"
$env:JWT_SECRET="dev-secret-keep-it-safe"

Write-Host "📡 Starting FloatChat Gateway on http://localhost:4000" -ForegroundColor Yellow
npm run dev
