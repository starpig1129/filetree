# ============================================
# FileNexus Backend - Uninstall Auto-Start Task
# Run this script as Administrator
# ============================================

$ErrorActionPreference = "Stop"

$TaskName = "FileNexus-Backend"

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    # Stop the task if running
    if ($existing.State -eq "Running") {
        Write-Host "Stopping running task '$TaskName'..." -ForegroundColor Yellow
        Stop-ScheduledTask -TaskName $TaskName
    }

    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Task '$TaskName' has been removed." -ForegroundColor Green
} else {
    Write-Host "Task '$TaskName' not found. Nothing to remove." -ForegroundColor Yellow
}
