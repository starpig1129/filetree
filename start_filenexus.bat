@echo off
REM ============================================
REM FileNexus Backend Auto-Start Script
REM Designed for Windows Task Scheduler (AtStartup)
REM Uses PowerShell with conda flask environment
REM ============================================

powershell -ExecutionPolicy Bypass -NoProfile -Command ^
  "conda activate flask; $env:PYTHONPATH='.'; Set-Location 'c:\Users\sftp\Desktop\filestation_final'; python backend/app.py" >> "c:\Users\sftp\Desktop\filestation_final\server.log" 2>&1
