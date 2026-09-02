$ErrorActionPreference = 'Stop'
$sw = (Invoke-WebRequest -UseBasicParsing "https://mykunda.com/sw.js?cb=$(Get-Random)" -TimeoutSec 30).Content
Write-Output ("sw.js versie: " + [regex]::Match($sw, 'mk-v\d+').Value)
foreach ($p in @('pipeline','essau','kololi','barra','bansang')) {
  $h = (Invoke-WebRequest -UseBasicParsing "https://mykunda.com/$p.html?cb=$(Get-Random)" -TimeoutSec 30).Content
  $m = [regex]::Match($h, 'var scores=(\[.*?\]);')
  Write-Output ("--- " + $p)
  if ($m.Success) {
    foreach ($r in [regex]::Matches($m.Groups[1].Value, '\["([^"]+)",(null|\d+),"([^"]*)"\]')) {
      Write-Output ("    " + $r.Groups[1].Value.PadRight(20) + $r.Groups[2].Value.PadLeft(5) + "  " + $r.Groups[3].Value)
    }
  } else { Write-Output "    GEEN scores gevonden" }
}
