@echo off
cd /d C:\Users\tkado\Documents\novapress-v2\backend
set PYTHONPATH=C:\Users\tkado\Documents\novapress-v2\backend
echo Running pipeline with 5 sources...
C:\Python313\python.exe scripts\run_fast_pipeline.py
echo.
echo Pipeline finished.
pause
