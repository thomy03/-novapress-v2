@echo off
cd /d C:\Users\tkado\Documents\novapress-v2\backend
set PYTHONPATH=C:\Users\tkado\Documents\novapress-v2\backend
echo Starting clustering test...
C:\Python313\python.exe scripts\test_clustering.py 2>&1
echo Done with exit code %ERRORLEVEL%
