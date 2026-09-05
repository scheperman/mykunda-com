Set-Location -LiteralPath 'C:\Users\User\MyKunda\project'
node _syntaxcheck.mjs 2>&1 | Select-Object -Last 10
'--- deploy\claim.html ---'
if (Test-Path 'deploy\claim.html') {
  $c = Get-Content 'deploy\claim.html' -Raw
  'bytes             = ' + $c.Length
  'noindex           = ' + ($c -match 'noindex, nofollow')
  'header vooraf     = ' + ($c -match 'mk-hdr')
  'footer vooraf     = ' + ($c -match 'mk-ftr')
  'css stempel       = ' + ([regex]::Match($c,'styles\.min\.css\?v=(\d+)').Groups[1].Value)
  'rpc claim_listing = ' + ($c -match 'claim_listing')
} else { 'deploy\claim.html ONTBREEKT' }
'--- deploy\admin.html ---'
$a = Get-Content 'deploy\admin.html' -Raw
'ikConfirm         = ' + ($a -match 'ikConfirm')
'entered_on_behalf = ' + ($a -match 'entered_on_behalf')
'claim_token       = ' + ($a -match 'claim_token')
'oude tekst weg    = ' + (-not ($a -match 'Save intake and open the listing form'))
'--- sitemap ---'
$s = Get-Content 'deploy\sitemap-pages.xml' -Raw -ErrorAction SilentlyContinue
'claim in sitemap  = ' + ($s -match 'claim\.html')
