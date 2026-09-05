$ErrorActionPreference='Stop'
function Get-Body($u){ (Invoke-WebRequest -Uri $u -UseBasicParsing -Headers @{'Cache-Control'='no-cache'}).Content }
try {
  $js = Get-Body 'https://mykunda.com/advert-parse.js'
  'advert-parse.js  bytes=' + $js.Length + '  MKParse=' + ($js -match 'MKParse') + '  fetch=' + ($js -match 'fetch\(')
} catch { 'advert-parse.js FOUT: ' + $_.Exception.Message }
try {
  $l = Get-Body 'https://mykunda.com/list.html'
  'list.html        bytes=' + $l.Length + '  pasteBox=' + ($l -match 'id="pasteBox"') + '  script=' + ($l -match 'advert-parse\.js\?v=')
  if ($l -match 'advert-parse\.js\?v=(\d+)') { '  stempel=' + $Matches[1] }
} catch { 'list.html FOUT: ' + $_.Exception.Message }
try {
  $a = Get-Body 'https://mykunda.com/admin.html'
  'admin.html       bytes=' + $a.Length + '  intake=' + ($a -match 'data-view="intake"')
} catch { 'admin.html FOUT: ' + $_.Exception.Message }
try {
  $s = Get-Body 'https://mykunda.com/sell.html'
  'sell.html        og=' + ($s -match 'No deposit, no commission') + '  oude belofte=' + ($s -match 'listing management')
} catch { 'sell.html FOUT: ' + $_.Exception.Message }
