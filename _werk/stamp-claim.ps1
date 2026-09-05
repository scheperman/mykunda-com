Set-Location -LiteralPath 'C:\Users\User\MyKunda\project'
$p = 'claim.html'
$c = Get-Content $p -Raw
$v = '171274747967054'
$c = $c -replace 'styles\.min\.css"',              ('styles.min.css?v=' + $v + '"')
$c = $c -replace 'vendor/supabase-js-2\.umd\.js"', ('vendor/supabase-js-2.umd.js?v=' + $v + '"')
$c = $c -replace 'src="supabase\.js"',             ('src="supabase.js?v=' + $v + '"')
$c = $c -replace 'src="app\.min\.js"',             ('src="app.min.js?v=' + $v + '"')
Set-Content -LiteralPath $p -Value $c -NoNewline -Encoding UTF8
([regex]::Matches($c,'\?v=\d+')).Count.ToString() + ' verwijzingen gestempeld'
