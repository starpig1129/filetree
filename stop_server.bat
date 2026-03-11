@echo off
setlocal
set PORT=5168

REM -------------------------------------------------------------------------
REM 檢查管理員權限
REM -------------------------------------------------------------------------
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!重要!] 請對此檔案點擊右鍵，選擇「以系統管理員身分執行」。
    echo 伺服器作為系統服務執行時，需要管理員權限才能關閉。
    echo.
    pause
    exit /b
)

echo 正在尋找使用連接埠 %PORT% 的程序...
set FOUND=0

REM -------------------------------------------------------------------------
REM 透過 netstat 尋找監聽 5168 的 PID
REM -------------------------------------------------------------------------
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%PORT% ^| findstr LISTENING') do (
    echo 發現伺服器程序 PID: %%a
    taskkill /F /PID %%a
    if %errorLevel% equ 0 (
        echo 成功關閉伺服器。
        set FOUND=1
    ) else (
        echo 關閉失敗，請確認該程序是否仍在執行。
    )
)

if %FOUND%==0 (
    echo 未能發現正在執行的伺服器 (Port %PORT%)。
)

echo.
pause
