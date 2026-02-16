@echo off
REM ============================================
REM Start FileNexus Backend (Manual / Interactive)
REM Output is shown directly in this window
REM ============================================

title FileNexus Backend Server

powershell -ExecutionPolicy Bypass -NoProfile -Command ^
  "conda activate flask; $env:PYTHONPATH='.'; Set-Location 'c:\Users\sftp\Desktop\filestation_final'; python backend/app.py"

pause
