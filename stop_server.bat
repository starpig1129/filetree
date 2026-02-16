@echo off
REM ============================================
REM Stop FileNexus Backend Server
REM Finds and stops the process on port 5168
REM ============================================

powershell -ExecutionPolicy Bypass -NoProfile -Command ^
  "$conn = Get-NetTCPConnection -LocalPort 5168 -State Listen -ErrorAction SilentlyContinue; ^
   if ($conn) { ^
     $p = $conn.OwningProcess; ^
     Stop-Process -Id $p -Force; ^
     Write-Host ('Stopped FileNexus server (PID: ' + $p + ')') -ForegroundColor Green ^
   } else { ^
     Write-Host 'FileNexus server is not running.' -ForegroundColor Yellow ^
   }"

pause
