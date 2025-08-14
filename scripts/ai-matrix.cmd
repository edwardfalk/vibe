@echo off
setlocal ENABLEEXTENSIONS
cd /d D:\projects\vibe
chcp 65001 > NUL
if not exist logs mkdir logs

echo Running AI chat terminal matrix... > logs\ai-matrix.txt

call :run "A_bun_run_lint_stream" bun run lint
call :run "B_cmdC_bun_run_lint_stream" cmd /C "bun run lint"
call :run "C_redirect_only" cmd /C "bun run lint > logs\lint_r.txt 2>&1"
call :run "D_redirect_with_exit" cmd /V:ON /C "bun run lint > logs\lint_rx.txt 2>&1 & echo EXITCODE=!ERRORLEVEL! > logs\lint_rx.exit"
call :run "E_redirect_and_type_silent" cmd /C "bun run lint > logs\lint_rt.txt 2>&1 & type logs\lint_rt.txt > NUL"
call :run "F_ver" cmd /C ver

echo Done. See logs\* and logs\*_*.meta >> logs\ai-matrix.txt
goto :eof

:run
set "CASE=%~1"
shift
set "CMD=%*"
set "CASEFILE=logs\%CASE%.meta"
echo CASE=%CASE%> "%CASEFILE%"
echo CMD=%CMD%>> "%CASEFILE%"
%CMD%
set "EC=%ERRORLEVEL%"
echo EXITCODE=%EC%>> "%CASEFILE%"
exit /b 0


