$ErrorActionPreference = 'Stop'
try {
  $r = Invoke-WebRequest -UseBasicParsing "https://mykunda.com/sw.js?cb=$(Get-Random)" -TimeoutSec 20
  Write-Output ("http status : " + $r.StatusCode)
  Write-Output ("sw.js versie: " + [regex]::Match($r.Content, 'mk-v\d+').Value)
} catch { Write-Output ("http fout: " + $_.Exception.Message) }
try {
  $t = Test-NetConnection -ComputerName mykunda.com -Port 22 -WarningAction SilentlyContinue
  Write-Output ("sftp poort 22 bereikbaar: " + $t.TcpTestSucceeded)
} catch { Write-Output ("poorttest fout: " + $_.Exception.Message) }
