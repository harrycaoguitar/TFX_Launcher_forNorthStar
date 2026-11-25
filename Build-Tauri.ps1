param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot 'dist'),
  [string]$ToolsRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) 'TFX-Launcher')
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$version = '2.0.0'
$fileVersion = '2.0.0.0'

$relDir = Join-Path $root 'src-tauri\target\release'
$bin = Join-Path $relDir 'tfx-launcher-tauri.exe'
$wv2 = Join-Path $relDir 'WebView2Loader.dll'
if (!(Test-Path -LiteralPath $bin)) { throw "Missing release binary: $bin (run 'cargo build --release' inside src-tauri first)" }
if (!(Test-Path -LiteralPath $wv2)) { throw "Missing WebView2Loader.dll: $wv2" }

$rcedit = Join-Path $ToolsRoot 'build-tools\rcedit-x64.exe'
if (!(Test-Path -LiteralPath $rcedit)) {
  $cmd = Get-Command rcedit-x64.exe, rcedit.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cmd) { $rcedit = $cmd.Source } else { throw "Missing rcedit-x64.exe. Provide -ToolsRoot or add rcedit to PATH." }
}

$makensis = Join-Path $ToolsRoot 'build-tools\nsis\Bin\makensis.exe'
if (!(Test-Path -LiteralPath $makensis)) {
  $cmd = Get-Command makensis.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cmd) { $makensis = $cmd.Source } else { throw "Missing makensis.exe. Provide -ToolsRoot or install NSIS." }
}

$nsiScript = Join-Path $root 'build\Installer.nsi'
if (!(Test-Path -LiteralPath $nsiScript)) {
  $nsiScript = Join-Path $ToolsRoot 'build\Installer.nsi'
}
if (!(Test-Path -LiteralPath $nsiScript)) { throw "Missing Installer.nsi" }

if (Test-Path -LiteralPath $OutputRoot) { Remove-Item -LiteralPath $OutputRoot -Recurse -Force }
$appDir = Join-Path $OutputRoot "TFX-Launcher-$version"
New-Item -ItemType Directory -Force -Path $appDir | Out-Null

$appExe = Join-Path $appDir 'TFX-Launcher.exe'
Copy-Item -LiteralPath $bin -Destination $appExe -Force
Copy-Item -LiteralPath $wv2 -Destination (Join-Path $appDir 'WebView2Loader.dll') -Force
Copy-Item -LiteralPath (Join-Path $root 'LICENSE') -Destination $appDir -Force
Copy-Item -LiteralPath (Join-Path $root 'THIRD_PARTY_NOTICES.md') -Destination $appDir -Force

# Stamp Windows executable version & icon metadata
& $rcedit $appExe `
  --set-file-version $fileVersion `
  --set-product-version $fileVersion `
  --set-version-string ProductName 'TFX Launcher' `
  --set-version-string FileDescription "TFX Launcher $version" `
  --set-version-string FileVersion $version `
  --set-version-string ProductVersion $version `
  --set-icon (Join-Path $root 'src-tauri\icons\icon.ico')
if ($LASTEXITCODE -ne 0) { throw 'rcedit failed.' }

# Build explicit owned-file uninstall manifest
$manifest = @()
Get-ChildItem -LiteralPath $appDir -File -Recurse | Sort-Object FullName | ForEach-Object {
  $relative = $_.FullName.Substring($appDir.Length + 1).Replace('$', '$$')
  $manifest += 'Delete "$INSTDIR\' + $relative + '"'
}
Get-ChildItem -LiteralPath $appDir -Directory -Recurse | Sort-Object { $_.FullName.Length } -Descending | ForEach-Object {
  $relative = $_.FullName.Substring($appDir.Length + 1).Replace('$', '$$')
  $manifest += 'RMDir "$INSTDIR\' + $relative + '"'
}
$manifestPath = Join-Path $OutputRoot 'uninstall-files.nsh'
[IO.File]::WriteAllLines($manifestPath, $manifest, [Text.UTF8Encoding]::new($true))

# Compile branded 5-language NSIS Setup installer
$setup = Join-Path $OutputRoot "TFX-Launcher-$version-Setup.exe"
& $makensis /V3 /INPUTCHARSET UTF8 `
  "/DAPP_DIR=$appDir" `
  "/DOUT_FILE=$setup" `
  "/DVERSION=$version" `
  "/DFILEVERSION=$fileVersion" `
  "/DUNINSTALL_MANIFEST=$manifestPath" `
  $nsiScript
if ($LASTEXITCODE -ne 0) { throw 'NSIS installer compilation failed.' }

Get-Item -LiteralPath $appExe, $setup | Select-Object FullName, Length
Get-FileHash -LiteralPath $setup -Algorithm SHA256
