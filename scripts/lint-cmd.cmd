@echo off
setlocal ENABLEEXTENSIONS
cd /d D:\projects\vibe
if not exist logs mkdir logs
rem Lint and redirect all output to logs\lint.txt
 bunx eslint . --ext .js > logs\lint.txt 2>&1
echo EXITCODE=%ERRORLEVEL%> logs\lint.exit
exit /b 0


