$md  = 'C:\Users\User\MyKunda\project\CLAUDE.md'
$src = 'C:\Users\User\MyKunda\project\_werk\claudemd-add-0509.txt'
foreach ($share in @('ReadWrite','Read','Write','Delete','None')) {
  try {
    $fs = [System.IO.File]::Open($md,'Append','Write',$share)
    $add = [System.IO.File]::ReadAllText($src)
    $b = [System.Text.Encoding]::UTF8.GetBytes($add)
    $fs.Write($b,0,$b.Length)
    $fs.Close()
    'TOEGEVOEGD met share=' + $share
    exit 0
  } catch {
    'mislukt met share=' + $share + ' : ' + $_.Exception.Message
  }
}
