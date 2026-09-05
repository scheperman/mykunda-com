@echo off
rem Wrapper: geeft het commitbericht netjes door aan upload.bat. Rechtstreeks
rem aanroepen vanuit een andere shell verminkte de aanhalingstekens, waardoor
rem de commit van 05-09-2026 als bericht alleen een " kreeg.
cd /d "%~dp0.."
call upload.bat "Vendor-script in claim.html zonder versiestempel, zoals de andere paginas"
