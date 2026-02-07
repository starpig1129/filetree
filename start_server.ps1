# Start FileNexus Backend (Direct HTTPS Mode)
Write-Host "Starting FileNexus Backend (HTTPS)..." -ForegroundColor Green
Write-Host "Ensure Port 5168 is forwarded on your router to this machine." -ForegroundColor Yellow

$env:PYTHONPATH="."
python backend/app.py
