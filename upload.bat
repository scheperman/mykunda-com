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
rem  Hetzelfde geldt voor het Cloudflare-token van stap 4: dat staat
rem  in je gebruikersmap, niet hier. Daarom mag dit bestand gewoon
rem  in de repo staan.
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
rem EXTERN = de map op de server waar mykunda.com staat.
rem
rem          LET OP. Je logt in op de vhost van gamgrowth.com, en de
rem          map httpdocs daar is de webroot van DIE site. MyKunda
rem          staat in een eigen map ernaast. Vul hier dus nooit
rem          /httpdocs in - dan zet je MyKunda over GamGrowth heen.
rem
rem          Het script controleert dit ook zelf: het kijkt eerst of
rem          er in deze map een index.html staat en stopt anders.
set "SESSIE=mykunda-sftp"
set "EXTERN=/var/www/vhosts/gamgrowth.com/mykunda.com"
rem CF_ZONE = de Zone ID van mykunda.com bij Cloudflare. Dat is een
rem          identificatie en geen geheim, dus die mag hier staan.
rem          Het bijbehorende token staat bewust NIET in dit bestand.
set "CF_ZONE=9bcef0f88fccc1407adafd421a4ec299"
rem -------------------------------------------------------------

cd /d "%~dp0"
set "LOKAAL=%~dp0deploy"
set "LOG=%TEMP%\winscp-mykunda.log"
set "SCRIPT=%TEMP%\winscp-mykunda-script.txt"
set "VOORBEELD=%TEMP%\winscp-mykunda-voorbeeld.txt"

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
echo == 1/4  Bouwen ================================================
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
echo == 2/4  Wat zou er naar de server gaan? =======================
rem  De stat-regel is het vangnet: staat er geen index.html in de
rem  opgegeven map, dan is het de verkeerde map en stopt WinSCP hier -
rem  voordat er ook maar iets verstuurd is.
> "%SCRIPT%" echo option batch abort
>>"%SCRIPT%" echo option confirm off
>>"%SCRIPT%" echo open "%SESSIE%"
>>"%SCRIPT%" echo stat "%EXTERN%/index.html"
>>"%SCRIPT%" echo synchronize remote -criteria=time,size -preview "%LOKAAL%" "%EXTERN%"
>>"%SCRIPT%" echo close
>>"%SCRIPT%" echo exit
rem  De uitvoer gaat eerst naar een bestand en dan pas naar het scherm, zodat
rem  het script zelf kan zien of er iets te doen viel.
"%WINSCP%" /log="%LOG%" /loglevel=0 /script="%SCRIPT%" > "%VOORBEELD%" 2>&1
set "RC=%errorlevel%"
type "%VOORBEELD%"
if not "%RC%"=="0" (
  echo.
  echo   WinSCP kwam er niet uit. Logboek: %LOG%
  echo   Twee dingen om na te lopen:
  echo     - de sessienaam: !SESSIE!
  echo     - de servermap : !EXTERN!
  echo   Die map moet de webroot van mykunda.com zijn, dus met index.html
  echo   erin. Niet de httpdocs van gamgrowth.com.
  goto :fout
)

rem  Viel er niets te synchroniseren, dan is uploaden zinloos en het legen van de
rem  Cloudflare-cache schadelijk: die maakt de site tijdelijk trager omdat alles
rem  opnieuw bij de server gehaald moet worden. Dus stoppen we hier.
rem  Wordt de regel ooit niet herkend - een andere taalversie van WinSCP - dan
rem  gaat het script gewoon door zoals vroeger. Dat is de veilige kant.
findstr /i /c:"Niets te synchroniseren" /c:"Nothing to synchronize" "%VOORBEELD%" >nul
if not errorlevel 1 goto :nietstedoen

rem  Er wordt niets meer gevraagd: is er iets te synchroniseren, dan gaat het weg.
rem  Wil je toch weer een moment om af te breken, zet dan deze twee regels terug:
rem      choice /c jn /n /t 5 /d j /m "  Naar de server sturen? Ja, tenzij je binnen 5 seconden n indrukt: "
rem      if errorlevel 2 goto :einde
rem  De lijst hierboven blijft hoe dan ook je controle achteraf: sinds de stempel
rem  uit de inhoud komt, staat daar alleen nog in wat je zelf hebt gewijzigd.

rem --- 3. Echt versturen ----------------------------------------
echo.
echo == 3/4  Uploaden ==============================================
> "%SCRIPT%" echo option batch abort
>>"%SCRIPT%" echo option confirm off
>>"%SCRIPT%" echo open "%SESSIE%"
>>"%SCRIPT%" echo stat "%EXTERN%/index.html"
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
echo   Geupload.

rem --- 4. Cloudflare-cache legen --------------------------------
rem  Zonder dit blijft de oude versie zichtbaar: Cloudflare serveert
rem  dan nog uit zijn eigen cache en haalt jouw nieuwe bestanden
rem  niet op.
rem
rem  Het API-token staat bewust niet in dit bestand en niet in de
rem  repo, maar in een bestand in je gebruikersmap:
rem
rem      %USERPROFILE%\.mykunda-cloudflare.cmd
rem
rem  Met daarin exact een regel, aanhalingstekens erbij:
rem
rem      set "CF_TOKEN=hier-jouw-token"
rem
rem  Zie CLAUDE.md voor het aanmaken van dat token. Ontbreekt het
rem  bestand, dan gaat er niets stuk: het script zegt dan gewoon dat
rem  je het met de hand moet doen.
echo.
echo == 4/4  Cloudflare-cache legen ================================
set "CF_TOKEN="
set "CFCONF=%USERPROFILE%\.mykunda-cloudflare.cmd"
if exist "%CFCONF%" call "%CFCONF%"

if not defined CF_TOKEN (
  echo   Geen token gevonden in !CFCONF!
  goto :handmatig
)
if not defined CF_ZONE (
  echo   CF_ZONE is niet ingevuld bovenin dit bestand.
  goto :handmatig
)

where curl.exe >nul 2>&1
if errorlevel 1 (
  echo   curl niet gevonden op deze computer.
  goto :handmatig
)

set "CFOUT=%TEMP%\cf-purge-mykunda.json"
curl -s -o "%CFOUT%" -X POST "https://api.cloudflare.com/client/v4/zones/%CF_ZONE%/purge_cache" -H "Authorization: Bearer %CF_TOKEN%" -H "Content-Type: application/json" -d "{\"purge_everything\":true}"
if errorlevel 1 (
  echo   curl kwam er niet uit. Netwerkprobleem?
  goto :purgefout
)

findstr /r /c:"success.:true" "%CFOUT%" >nul
if errorlevel 1 goto :purgefout

del "%CFOUT%" >nul 2>&1
echo   Cache geleegd. Binnen enkele seconden is de nieuwe versie live.
echo   Nakijken kan in een privevenster.
goto :klaar

:purgefout
echo.
echo   Het legen van de cache is NIET gelukt. Antwoord van Cloudflare:
if exist "%CFOUT%" type "%CFOUT%"
echo.
echo   Meestal is het token verlopen, of heeft het niet het recht
echo   Zone - Cache Purge - Purge op deze zone.
goto :handmatig

:handmatig
echo.
echo   De cache is niet automatisch geleegd. Doe het met de hand,
echo   anders is de upload niet zichtbaar:
echo     Cloudflare - Caching - Configuration - Purge Everything
echo     https://dash.cloudflare.com
goto :klaar

:klaar
echo.
echo ===============================================================
echo   Klaar.
echo ===============================================================
goto :einde

:nietstedoen
del "%SCRIPT%" "%VOORBEELD%" >nul 2>&1
echo.
echo ===============================================================
echo   Niets gewijzigd. Niets geupload, cache ongemoeid gelaten.
echo ===============================================================
goto :einde

:fout
del "%VOORBEELD%" >nul 2>&1
echo.
pause
exit /b 1

:einde
rem  Geen pause: het venster sluit vanzelf. De timeout laat je de uitslag nog
rem  lezen als je dit vanaf een snelkoppeling start, en is met een toets weg.
del "%VOORBEELD%" >nul 2>&1
echo.
timeout /t 8 2>nul
exit /b 0
