# ============================================
# FileNexus Backend - Install Auto-Start Task
# Run this script as Administrator
# ============================================

$ErrorActionPreference = "Stop"

$TaskName = "FileNexus-Backend"
$ProjectDir = "c:\Users\sftp\Desktop\filestation_final"
$BatFile = Join-Path $ProjectDir "start_filenexus.bat"

# Verify the bat file exists
if (-not (Test-Path $BatFile)) {
    Write-Host "ERROR: $BatFile not found." -ForegroundColor Red
    exit 1
}

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing task '$TaskName'..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create trigger: At system startup
$trigger = New-ScheduledTaskTrigger -AtStartup

# Create action: Run the bat file
$action = New-ScheduledTaskAction `
    -Execute $BatFile `
    -WorkingDirectory $ProjectDir

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

# Register the task to run as the current user with highest privileges
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType S4U `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Auto-start FileNexus backend server on system boot" `
    -Force

Write-Host ""
Write-Host "=======================================" -ForegroundColor Green
Write-Host " Task '$TaskName' registered successfully!" -ForegroundColor Green
Write-Host " Trigger: At system startup" -ForegroundColor Cyan
Write-Host " Action:  $BatFile" -ForegroundColor Cyan
Write-Host " Retries: 3 times, 1 min interval" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Verify with: Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Yellow
