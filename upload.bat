@echo off
setlocal enabledelayedexpansion
title MyKunda - bouwen en uploaden

rem ============================================================
rem  MyKunda: bouwen en uploaden in een keer.
rem
rem  Draait build.mjs, laat daarna eerst ZIEN wat er naar de server
rem  zou gaan, en verstuurt pas na jouw bevestiging.
rem
rem  Er staat hier geen wachtwoord in. WinSCP bewaart de verbinding
rem  onder de naam hieronder; dit bestand verwijst er alleen naar.
rem  Daarom mag het gewoon in de repo staan.
rem
rem  EENMALIG VOORAF: verbind een keer met de hand in WinSCP zelf en
rem  sla de verbinding op onder de naam hieronder. Dat is niet alleen
rem  voor het wachtwoord: bij de eerste SFTP-verbinding vraagt WinSCP
rem  of je de vingerafdruk van de server vertrouwt. Dit script draait
rem  zonder toezicht en beantwoordt zo'n vraag automatisch met nee,
rem  dus die vraag moet al een keer beantwoord zijn.
rem ============================================================

rem --- Instellen: eenmalig aanpassen ---------------------------
rem SESSIE = de naam waaronder je de verbinding in WinSCP hebt
rem          opgeslagen (Session > Sites > Save as...).
rem EXTERN = de map op de server waar de site staat. Bij Plesk is
rem          dat meestal /httpdocs. Klopt hij niet, dan stopt
rem          WinSCP met een foutmelding en zie je het meteen.
set "SESSIE=mykunda"
set "EXTERN=/httpdocs"
rem -------------------------------------------------------------

cd /d "%~dp0"
set "LOKAAL=%~dp0deploy"
set "LOG=%TEMP%\winscp-mykunda.log"
set "SCRIPT=%TEMP%\winscp-mykunda-script.txt"

rem --- WinSCP opzoeken -----------------------------------------
rem  Twee dingen om te weten. Ten eerste: een pad met (x86) erin mag
rem  nooit rechtstreeks binnen de haakjes van een if-blok staan, want
rem  de sluithaak breekt dat blok af - vandaar de !uitroeptekens! in de
rem  foutmelding hieronder. Ten tweede: %ProgramFiles(x86)% bestaat niet
rem  in elke omgeving, dus we zoeken ook op de schijf zelf.
set "WINSCP="
set "PAD1=%SystemDrive%\Program Files (x86)\WinSCP\WinSCP.com"
set "PAD2=%SystemDrive%\Program Files\WinSCP\WinSCP.com"
set "PAD3=%LOCALAPPDATA%\Programs\WinSCP\WinSCP.com"
if exist "%PAD1%" set "WINSCP=%PAD1%"
if not defined WINSCP if exist "%PAD2%" set "WINSCP=%PAD2%"
if not defined WINSCP if exist "%PAD3%" set "WINSCP=%PAD3%"
if not defined WINSCP for /f "delims=" %%W in ('where winscp.com 2^>nul') do set "WINSCP=%%W"
if not defined WINSCP (
  echo.
  echo   WinSCP niet gevonden. Gezocht op:
  echo     !PAD1!
  echo     !PAD2!
  echo     !PAD3!
  echo   Staat hij ergens anders, vul het pad hierboven handmatig in bij WINSCP.
  goto :fout
)
echo   WinSCP: !WINSCP!

rem --- 1. Bouwen ------------------------------------------------
echo.
echo == 1/3  Bouwen ================================================
call node build.mjs
if errorlevel 1 (
  echo.
  echo   De bouw is misgegaan. Er is niets geupload.
  goto :fout
)
if not exist "%LOKAAL%\index.html" (
  echo.
  echo   deploy\index.html ontbreekt. Er is niets geupload.
  goto :fout
)

rem --- 2. Eerst laten zien wat er zou gaan ----------------------
rem  -criteria=time,size  : alleen wat nieuwer of anders groot is.
rem  geen -delete         : niets op de server wordt weggegooid.
rem  Omdat build.mjs de tijdstempels van images, vendor, logo en
rem  fonts met rust laat, ziet WinSCP die 22 MB als ongewijzigd en
rem  blijft er in de praktijk 4,7 MB uit de root over.
echo.
echo == 2/3  Wat zou er naar de server gaan? =======================
> "%SCRIPT%" echo option batch abort
>>"%SCRIPT%" echo option confirm off
>>"%SCRIPT%" echo open "%SESSIE%"
>>"%SCRIPT%" echo synchronize remote -criteria=time,size -preview "%LOKAAL%" "%EXTERN%"
>>"%SCRIPT%" echo close
>>"%SCRIPT%" echo exit
"%WINSCP%" /log="%LOG%" /loglevel=0 /script="%SCRIPT%"
if errorlevel 1 (
  echo.
  echo   WinSCP kwam er niet uit. Logboek: %LOG%
  echo   Controleer de sessienaam ^(%SESSIE%^) en de servermap ^(%EXTERN%^).
  goto :fout
)

echo.
set "GA="
set /p "GA=Bovenstaande naar de server sturen? (j/n): "
if /i not "!GA!"=="j" (
  echo.
  echo   Afgebroken. Er is niets geupload.
  goto :einde
)

rem --- 3. Echt versturen ----------------------------------------
echo.
echo == 3/3  Uploaden ==============================================
> "%SCRIPT%" echo option batch abort
>>"%SCRIPT%" echo option confirm off
>>"%SCRIPT%" echo open "%SESSIE%"
>>"%SCRIPT%" echo synchronize remote -criteria=time,size "%LOKAAL%" "%EXTERN%"
>>"%SCRIPT%" echo close
>>"%SCRIPT%" echo exit
"%WINSCP%" /log="%LOG%" /loglevel=0 /script="%SCRIPT%"
if errorlevel 1 (
  echo.
  echo   De upload is halverwege gestopt. Logboek: %LOG%
  echo   Draai dit bestand opnieuw: wat al goed staat wordt overgeslagen.
  goto :fout
)

del "%SCRIPT%" >nul 2>&1
echo.
echo ===============================================================
echo   Geupload.
echo.
echo   Nu nog met de hand, en zonder dit is de upload niet zichtbaar:
echo     Cloudflare - Caching - Configuration - Purge Everything
echo     https://dash.cloudflare.com
echo.
echo   Daarna nakijken in een privevenster.
echo ===============================================================
goto :einde

:fout
echo.
pause
exit /b 1

:einde
echo.
pause
exit /b 0
