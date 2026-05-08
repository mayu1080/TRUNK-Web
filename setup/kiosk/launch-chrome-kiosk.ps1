param(
  # 例: https://example.com または file:///C:/path/to/index.html
  [Parameter(Mandatory = $true)]
  [string] $Url
)

$chromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
)

$chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) {
  throw "Chrome が見つかりません。インストール後に再実行してください。"
}

Start-Process -FilePath $chrome -ArgumentList @(
  "--kiosk",
  "--incognito",
  "--disable-pinch",
  "--overscroll-history-navigation=0",
  $Url
)

