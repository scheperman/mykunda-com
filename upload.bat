@echo off
setlocal enabledelayedexpansion
title MyKunda - bouwen, uploaden en vastleggen

rem ============================================================
rem  MyKunda: de hele leverroute in een keer.
rem
rem  Draait build.mjs, laat eerst ZIEN wat er naar de server zou gaan,
rem  verstuurt, leegt de Cloudflare-cache en legt de bron vast in git
rem  (add, commit, push). Stap 1 tot en met 5 uit CLAUDE.md.
rem
rem  Een commitbericht mag als argument mee - dan loopt hij van begin
rem  tot eind door zonder toetsaanslag:
rem
rem      upload.bat "Areapaginas: kaartcoordinaten gecorrigeerd"
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
rem          04-09-2026: mykunda-sftp werd even geweigerd (verouderd
rem          wachtwoord); hersteld door hostnaam en wachtwoord van
rem          gamgrowth-sftp over te nemen (zelfde server, zelfde
rem          gebruiker ycjoswsp). Weigert hij ooit weer, dan werkt
rem          gamgrowth-sftp hier ook - EXTERN blijft de MyKunda-map.
rem          05-09-2026: mykunda-sftp weigerde weer (Password authentication
rem          failed voor ycjoswsp), net als op 04-09. gamgrowth-sftp komt op
rem          dezelfde server bij dezelfde gebruiker uit en werkt wel; nagemeten
rem          met een stat op de MyKunda-index.html. Daarom staat die hier nu.
rem          EXTERN blijft de MyKunda-map - het script controleert dat zelf.
rem          Repareer je ooit het wachtwoord van mykunda-sftp, zet die naam dan
rem          gerust terug; allebei werken ze.
set "SESSIE=gamgrowth-sftp"
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

rem --- De uitslag per stap -------------------------------------
rem  Elke stap zet hieronder zijn eigen regel, en aan het eind worden
rem  ze alle vier getoond met een oordeel eronder.
rem
rem  Waarom dit er is: tot 27-08-2026 eindigde dit script bij elke
rem  afloop hetzelfde - geslaagd, niets te doen, of halverwege
rem  gestopt. Alles liep uit op dezelfde aftelklok en dezelfde
rem  exitcode 0. Je kon dus aan het einde niet zien of het gelukt
rem  was, en een mislukte push zag er precies zo uit als een goede.
rem  Een venster dat sluit is geen bevestiging.
set "ST_BOUW=niet gedraaid"
set "ST_UPLOAD=niet gedraaid"
set "ST_CACHE=niet gedraaid"
set "ST_INDEX=niet gedraaid"
set "ST_GIT=niet gedraaid"
set "PROBLEEM="

rem  Zelftest van het slot. Toont het uitslagblok met verzonnen
rem  waarden en stopt daarna: er wordt niets gebouwd, niets geupload
rem  en niets vastgelegd. Bewust hier en niet in een los testbestand,
rem  want een kopie van dit blok zou na de eerste wijziging hiernaast
rem  gaan lopen en dan slagen terwijl het echte slot stuk is.
rem      upload.bat --zelftest        zoals een geslaagde run eindigt
rem      upload.bat --zelftest fout   zoals een mislukte run eindigt
if /i "%~1"=="--zelftest" (
  set "ST_BOUW=ok"
  set "ST_UPLOAD=ok"
  set "ST_CACHE=ok"
  set "ST_INDEX=ok - aangemeld bij IndexNow"
  set "ST_GIT=ok - vastgelegd en gepusht"
  if /i "%~2"=="fout" set "ST_CACHE=MOET MET DE HAND - zie hierboven"
  if /i "%~2"=="fout" set "ST_INDEX=MISLUKT - antwoordcode 403"
  if /i "%~2"=="fout" set "ST_GIT=MISLUKT - push geweigerd, commit staat lokaal klaar"
  if /i "%~2"=="fout" set "PROBLEEM=1"
  goto :einde
)

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
echo == 1/5  Bouwen ================================================
call node build.mjs
if errorlevel 1 (
  set "ST_BOUW=MISLUKT - build.mjs gaf een fout"
  echo.
  echo   De bouw is misgegaan. Er is niets geupload.
  goto :fout
)
if not exist "%LOKAAL%\index.html" (
  set "ST_BOUW=MISLUKT - deploy\index.html ontbreekt"
  echo.
  echo   deploy\index.html ontbreekt. Er is niets geupload.
  goto :fout
)
set "ST_BOUW=ok"

rem --- 2. Eerst laten zien wat er zou gaan ----------------------
rem  -criteria=time,size  : alleen wat nieuwer of anders groot is.
rem  geen -delete         : niets op de server wordt weggegooid.
rem  Omdat build.mjs de tijdstempels van images, vendor, logo en
rem  fonts met rust laat, ziet WinSCP die 22 MB als ongewijzigd en
rem  blijft er in de praktijk 4,7 MB uit de root over.
echo.
echo == 2/5  Wat zou er naar de server gaan? =======================
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
  set "ST_UPLOAD=MISLUKT - WinSCP kon de servermap niet lezen"
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
echo == 3/5  Uploaden ==============================================
> "%SCRIPT%" echo option batch abort
>>"%SCRIPT%" echo option confirm off
>>"%SCRIPT%" echo open "%SESSIE%"
>>"%SCRIPT%" echo stat "%EXTERN%/index.html"
>>"%SCRIPT%" echo synchronize remote -criteria=time,size "%LOKAAL%" "%EXTERN%"
>>"%SCRIPT%" echo close
>>"%SCRIPT%" echo exit
"%WINSCP%" /log="%LOG%" /loglevel=0 /script="%SCRIPT%"
if errorlevel 1 (
  set "ST_UPLOAD=MISLUKT - halverwege gestopt, opnieuw draaien"
  echo.
  echo   De upload is halverwege gestopt. Logboek: %LOG%
  echo   Draai dit bestand opnieuw: wat al goed staat wordt overgeslagen.
  goto :fout
)

del "%SCRIPT%" >nul 2>&1
set "ST_UPLOAD=ok"
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
echo == 4/5  Cloudflare-cache legen ================================
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
set "ST_CACHE=ok"
call :indexnow
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
call :indexnow
set "ST_CACHE=MOET MET DE HAND - zie hierboven"
set "PROBLEEM=1"
echo.
echo   De cache is niet automatisch geleegd. Doe het met de hand,
echo   anders is de upload niet zichtbaar:
echo     Cloudflare - Caching - Configuration - Purge Everything
echo     https://dash.cloudflare.com
goto :vastleggen

:klaar
echo.
echo ===============================================================
echo   Geupload en cache geleegd.
echo ===============================================================
goto :vastleggen

:nietstedoen
del "%SCRIPT%" "%VOORBEELD%" >nul 2>&1
set "ST_UPLOAD=niets te doen - server stond al gelijk"
set "ST_CACHE=niet nodig"
set "ST_INDEX=niet nodig"
echo.
echo ===============================================================
echo   Niets gewijzigd. Niets geupload, cache ongemoeid gelaten.
echo ===============================================================
goto :vastleggen

rem --- 5. Vastleggen in git -------------------------------------
rem  Staat los van de upload: de server heeft de bestanden, de repo
rem  houdt bij wat er live staat en waarom. Dit blok draait daarom ook
rem  als er niets te uploaden viel - een wijziging in CLAUDE.md of in
rem  een script hoort net zo goed vastgelegd te worden.
rem
rem  Het bericht mag als argument mee, en dan draait het hele script
rem  zonder een enkele toetsaanslag:
rem
rem      upload.bat "Areapaginas: kaartcoordinaten gecorrigeerd"
rem
rem  Zonder argument vraagt hij erom. Dat is bewust het enige moment
rem  waarop dit script nog iets van je wil: een commitbericht is het
rem  enige dat een machine niet kan verzinnen. Enter zonder tekst geeft
rem  een feitelijke standaardregel - datum en aantal bestanden - zodat
rem  een onbeheerde run nooit blijft hangen.
rem
rem  Er wordt niets geforceerd. Weigert de push, dan stopt het hier met
rem  een aanwijzing; de commit staat dan gewoon lokaal klaar.
:vastleggen
echo.
echo == 5/5  Vastleggen in git =====================================
where git.exe >nul 2>&1
if errorlevel 1 (
  set "ST_GIT=overgeslagen - git niet gevonden"
  set "PROBLEEM=1"
  echo   git niet gevonden. Leg het zelf vast:
  echo     git add -A   en dan   git commit   en   git push
  goto :einde
)
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  set "ST_GIT=overgeslagen - dit is geen git-repo"
  echo   Dit is geen git-repo. Overgeslagen.
  goto :einde
)

git add -A
if errorlevel 1 (
  set "ST_GIT=MISLUKT - git add ging mis"
  set "PROBLEEM=1"
  echo   git add is misgegaan. Leg het met de hand vast.
  goto :einde
)

rem  --quiet geeft 1 zodra er iets klaarstaat, en 0 als er niets is.
git diff --cached --quiet
if not errorlevel 1 (
  set "GEENCOMMIT=1"
  echo   Niets te committen - de bron stond al vast.
  goto :pushen
)

rem  Alleen de aantallen, niet de hele lijst. Bij een herijking van de
rem  gebiedsprijzen staan hier 120 bestanden, en dan schuift de vraag
rem  hieronder van het scherm af - precies zoals op 27-08-2026, toen
rem  alles wel staged raakte maar niets werd vastgelegd omdat de
rem  wachtende prompt niet meer te zien was. De volledige lijst blijft
rem  altijd op te vragen met: git diff --cached --name-status
for /f %%N in ('git diff --cached --name-only ^| find /c /v ""') do set "AANTAL=%%N"
echo.
echo   !AANTAL! bestand^(en^) staan klaar om vast te leggen.
echo.

set "BERICHT=%~1"
if not defined BERICHT (
  echo   ---------------------------------------------------------------
  echo    Dit is het enige moment waarop dit script iets van je wil.
  echo    Typ een commitbericht en druk op Enter, of druk meteen op
  echo    Enter voor een standaardtekst met de datum en het aantal.
  echo   ---------------------------------------------------------------
  set /p "BERICHT=  Commitbericht: "
)
if not defined BERICHT call :standaardbericht
git commit -m "!BERICHT!"
if errorlevel 1 (
  set "ST_GIT=MISLUKT - commit ging mis, niets gepusht"
  set "PROBLEEM=1"
  echo   De commit is misgegaan. Er is niets gepusht.
  goto :einde
)
echo   Vastgelegd.

:pushen
git push
if errorlevel 1 (
  set "ST_GIT=MISLUKT - push geweigerd, commit staat lokaal klaar"
  set "PROBLEEM=1"
  echo.
  echo   De push is niet gelukt. Meestal staat er op GitHub iets nieuwers.
  echo   De commit staat lokaal klaar; haal eerst op en push dan opnieuw:
  echo     git pull --rebase
  echo     git push
  goto :einde
)
if defined GEENCOMMIT (
  set "ST_GIT=ok - stond al vast, niets nieuws te pushen"
) else (
  set "ST_GIT=ok - vastgelegd en gepusht"
)
echo   Gepusht naar origin.
goto :einde

rem  IndexNow: Bing en Yandex meteen op de hoogte stellen van de pagina's die
rem  echt zijn gewijzigd. build.mjs heeft het bericht al klaargezet in
rem  _werk\indexnow.json - met precies de URL's waarvan de lastmod vandaag is
rem  bijgewerkt. Hier gaat het pas weg, NA een geslaagde upload: een URL aanmelden
rem  die nog niet live staat levert een fout op. Geen bestand = niets gewijzigd =
rem  niets te doen. De sleutel is geen geheim; hij hoort juist openbaar in de
rem  webroot te staan, anders weigert IndexNow de aanmelding.
:indexnow
set "ST_INDEX=niets aan te melden"
if not exist "_werk\indexnow.json" goto :eof
where curl.exe >nul 2>&1
if errorlevel 1 (
  set "ST_INDEX=overgeslagen - curl niet gevonden"
  goto :eof
)
set "INCODE="
for /f %%C in ('curl -s -o "%TEMP%\indexnow-mykunda.txt" -w "%%{http_code}" -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json; charset=utf-8" --data-binary "@_werk\indexnow.json"') do set "INCODE=%%C"
set "ST_INDEX=MISLUKT - antwoordcode !INCODE!"
if "!INCODE!"=="200" set "ST_INDEX=ok - aangemeld bij IndexNow"
if "!INCODE!"=="202" set "ST_INDEX=ok - in behandeling bij IndexNow"
if not defined INCODE set "ST_INDEX=MISLUKT - curl gaf geen antwoord"
if not "!INCODE!"=="200" if not "!INCODE!"=="202" set "PROBLEEM=1"
rem  Aangenomen? Dan is de wachtrij leeg. Zo niet, dan blijft het bericht staan en
rem  gaat het bij de volgende upload gewoon opnieuw mee - niets gaat verloren.
if "!INCODE!"=="200" del "_werk\indexnow.json" >nul 2>&1
if "!INCODE!"=="202" del "_werk\indexnow.json" >nul 2>&1
if not "!INCODE!"=="200" if not "!INCODE!"=="202" (
  echo.
  echo   IndexNow weigerde de aanmelding. Antwoord:
  if exist "%TEMP%\indexnow-mykunda.txt" type "%TEMP%\indexnow-mykunda.txt"
  echo.
  echo   Meestal staat het sleutelbestand nog niet op de server:
  echo     https://mykunda.com/1a01e0ded2474955709f9b30fe339e29.txt
)
del "%TEMP%\indexnow-mykunda.txt" >nul 2>&1
goto :eof

rem  Feitelijk, niet verzonnen: de datum en wat er daadwerkelijk klaarstaat.
:standaardbericht
for /f %%N in ('git diff --cached --name-only ^| find /c /v ""') do set "AANTAL=%%N"
set "BERICHT=Live gezet op %DATE% - %AANTAL% bestand(en) gewijzigd"
goto :eof

rem ============================================================
rem  Het slot. Elke afloop komt hier langs en krijgt dezelfde vier
rem  regels te zien, zodat je nooit meer hoeft te raden of het goed
rem  ging. De regel is simpel: ging alles goed, dan sluit het venster
rem  vanzelf; ging er iets mis, dan blijft het open tot jij een toets
rem  indrukt. Een venster dat je nooit hebt zien sluiten is geen
rem  bewijs dat het gelukt is.
rem ============================================================

:uitslag
echo.
echo ===============================================================
echo   UITSLAG
echo ---------------------------------------------------------------
echo    1     bouwen             !ST_BOUW!
echo    2-3   uploaden           !ST_UPLOAD!
echo    4     Cloudflare-cache   !ST_CACHE!
echo    4b    IndexNow           !ST_INDEX!
echo    5     git                !ST_GIT!
call :gitstand
echo ===============================================================
goto :eof

rem  Na afloop nog even hardop: staat er echt niets meer lokaal te
rem  wachten? Dit leest de stand uit git zelf en gelooft dus niet de
rem  meldingen hierboven op hun woord.
:gitstand
set "VOOR="
set "STAGED="
for /f "delims=" %%A in ('git rev-list --count @{u}..HEAD 2^>nul') do set "VOOR=%%A"
for /f %%A in ('git diff --cached --name-only 2^>nul ^| find /c /v ""') do set "STAGED=%%A"
if defined VOOR if not "!VOOR!"=="0" (
  echo ---------------------------------------------------------------
  echo    LET OP  !VOOR! commit^(s^) staan nog lokaal en niet op GitHub.
  set "PROBLEEM=1"
)
if defined STAGED if not "!STAGED!"=="0" (
  echo ---------------------------------------------------------------
  echo    LET OP  !STAGED! bestand^(en^) staan klaar maar zijn niet vastgelegd.
  set "PROBLEEM=1"
)
goto :eof

:fout
del "%VOORBEELD%" >nul 2>&1
set "PROBLEEM=1"
call :uitslag
echo.
echo   ER IS IETS MISGEGAAN. Zie de regel met MISLUKT hierboven.
echo   Er is niets geforceerd; opnieuw draaien is veilig.
echo.
pause
exit /b 1

:einde
del "%VOORBEELD%" >nul 2>&1
call :uitslag
if defined PROBLEEM (
  echo.
  echo   NIET ALLES IS GELUKT. Loop de regels hierboven na.
  echo   Er is niets geforceerd; opnieuw draaien is veilig.
  echo.
  pause
  exit /b 1
)
rem  De slotzin wordt uit de stappen zelf opgebouwd. Hij stond hier eerst
rem  als een vaste regel - "Site bijgewerkt, cache geleegd, bron
rem  vastgelegd" - en dat is onwaar zodra er niets te uploaden viel.
rem  Een samenvatting die niet meebeweegt met wat er gebeurd is, is nog
rem  steeds een samenvatting die je niet kunt vertrouwen.
echo.
echo   ALLES GELUKT.
if "!ST_UPLOAD!"=="ok" (
  echo     - de site is bijgewerkt en de Cloudflare-cache is geleegd
) else (
  echo     - er viel niets te uploaden: de server stond al gelijk met deploy
)
if defined GEENCOMMIT (
  echo     - de bron stond al vast, er was niets nieuws te pushen
) else (
  echo     - de bron is vastgelegd en gepusht naar GitHub
)
echo.
rem  timeout werkt niet als de invoer omgeleid is - dan schrijft hij een
rem  Engelse foutregel en stopt meteen. Die melding hoort niet onder een
rem  geslaagde run, dus we vangen hem af en wachten met ping.
timeout /t 10 2>nul
if errorlevel 1 (
  echo   Dit venster sluit over tien seconden.
  ping -n 11 127.0.0.1 >nul 2>&1
)
exit /b 0
