$h = (Invoke-WebRequest -UseBasicParsing "https://mykunda.com/barra.html?cb=$(Get-Random)" -TimeoutSec 30).Content
Write-Output ("lengte: " + $h.Length)
foreach ($m in [regex]::Matches($h, 'var scores=[^\r\n]*')) { Write-Output $m.Value }
foreach ($m in [regex]::Matches($h, 'var SG=[^\r\n]*')) { Write-Output $m.Value }
