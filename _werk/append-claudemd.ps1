$md  = 'C:\Users\User\MyKunda\project\CLAUDE.md'
$src = 'C:\Users\User\MyKunda\project\_werk\claudemd-add-0509b.txt'
try {
  $fs  = [System.IO.File]::Open($md,'Append','Write','ReadWrite')
  $add = [System.IO.File]::ReadAllText($src)
  $b   = [System.Text.Encoding]::UTF8.GetBytes($add)
  $fs.Write($b,0,$b.Length); $fs.Close()
  'TOEGEVOEGD — CLAUDE.md is nu ' + (Get-Content $md).Count + ' regels'
} catch { 'MISLUKT: ' + $_.Exception.Message }
