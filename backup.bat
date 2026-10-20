@echo off
setlocal enabledelayedexpansion
set "timestamp=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%"
set "timestamp=%timestamp: =0%"
set "BACKUP_DIR=..\backup_%timestamp%"
echo [MUSIC TECH LAB] バックアップを開始します...
echo バックアップ先: %BACKUP_DIR%
xcopy * "%BACKUP_DIR%" /E /I /Y /H /K
echo [完了] 安全にセーブされました！このウィンドウを閉じてください。
pause
