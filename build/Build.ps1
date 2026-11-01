param(
  [string]$RuntimeDir,
  [string]$OutputRoot = (Join-Path $PSScriptRoot '..\dist')
)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$package = Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$version = $package.version
$node = (Get-Command node -ErrorAction Stop).Source
if (!$RuntimeDir) { $RuntimeDir = Join-Path $sourceRoot 'node_modules\electron\dist' }
$RuntimeDir = [IO.Path]::GetFullPath($RuntimeDir)
$runtimeExe = @('electron.exe', 'TFX-Launcher.exe') | ForEach-Object { Join-Path $RuntimeDir $_ } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$runtimeExe) { throw 'Electron runtime not found. Run npm install, or pass -RuntimeDir with Electron 43.1.1 x64.' }
$oldRunAsNode = $env:ELECTRON_RUN_AS_NODE
try {
  $env:ELECTRON_RUN_AS_NODE = '1'
  $runtimeVersion = (& $runtimeExe -p 'process.versions.electron' | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $runtimeVersion -ne '43.1.1') { throw "Expected Electron 43.1.1, found $runtimeVersion" }
} finally { $env:ELECTRON_RUN_AS_NODE = $oldRunAsNode }
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$appDir = Join-Path $OutputRoot "TFX-Launcher-$version"
$stage = Join-Path $OutputRoot 'app-source'
if ((Test-Path -LiteralPath $appDir) -or (Test-Path -LiteralPath $stage)) { throw 'Output already exists. Select a fresh -OutputRoot.' }
New-Item -ItemType Directory -Path $appDir,$stage | Out-Null
Get-ChildItem -LiteralPath $RuntimeDir -Force | Where-Object { $_.Name -notin @('resources','debug.log','测试说明.txt','修复说明.txt') } | Copy-Item -Destination $appDir -Recurse
$appExe = Join-Path $appDir 'TFX-Launcher.exe'
if (Test-Path -LiteralPath (Join-Path $appDir 'electron.exe')) { Rename-Item -LiteralPath (Join-Path $appDir 'electron.exe') -NewName 'TFX-Launcher.exe' }
New-Item -ItemType Directory -Path (Join-Path $appDir 'resources') | Out-Null
Copy-Item -LiteralPath (Join-Path $sourceRoot 'src') -Destination $stage -Recurse
Copy-Item -LiteralPath (Join-Path $sourceRoot 'package.json') -Destination $stage
# Only production dependencies belong in the shipped application.
$visited = @{}
function Copy-ProductionModule([string]$name) {
  if ($visited.ContainsKey($name)) { return }
  $visited[$name] = $true
  $module = Join-Path $sourceRoot "node_modules\$name"
  if (!(Test-Path -LiteralPath $module)) { throw "Missing production dependency: $name" }
  $destination = Join-Path $stage "node_modules\$name"
  New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
  Copy-Item -LiteralPath $module -Destination $destination -Recurse
  $meta = Get-Content -LiteralPath (Join-Path $module 'package.json') -Encoding UTF8 -Raw | ConvertFrom-Json
  if ($meta.dependencies) { $meta.dependencies.PSObject.Properties.Name | ForEach-Object { Copy-ProductionModule $_ } }
}
$package.dependencies.PSObject.Properties.Name | ForEach-Object { Copy-ProductionModule $_ }
$asarCLI = Join-Path $sourceRoot 'build-tools\asar\node_modules\@electron\asar\bin\asar.mjs'
& $node $asarCLI pack $stage (Join-Path $appDir 'resources\app.asar') --unpack-dir 'src/tools'
if ($LASTEXITCODE -ne 0) { throw 'ASAR packaging failed.' }
& (Join-Path $sourceRoot 'build-tools\rcedit-x64.exe') $appExe --set-file-version "$version.0" --set-product-version "$version.0" --set-version-string ProductName 'TFX Launcher' --set-version-string FileDescription 'TFX Launcher' --set-icon (Join-Path $sourceRoot 'src\assets\icons\icon.ico')
if ($LASTEXITCODE -ne 0) { throw 'Executable version update failed.' }
# Explicit owned-file manifest: uninstall does not recursively delete user-added files.
$manifest = @()
Get-ChildItem -LiteralPath $appDir -File -Recurse | Sort-Object FullName | ForEach-Object {
  $relative = $_.FullName.Substring($appDir.Length + 1).Replace('$','$$')
  $manifest += 'Delete "$INSTDIR\' + $relative + '"'
}
Get-ChildItem -LiteralPath $appDir -Directory -Recurse | Sort-Object { $_.FullName.Length } -Descending | ForEach-Object {
  $relative = $_.FullName.Substring($appDir.Length + 1).Replace('$','$$')
  $manifest += 'RMDir "$INSTDIR\' + $relative + '"'
}
$manifestPath = Join-Path $OutputRoot 'uninstall-files.nsh'
[IO.File]::WriteAllLines($manifestPath,$manifest,[Text.UTF8Encoding]::new($true))
$setup = Join-Path $OutputRoot "TFX-Launcher-$version-Setup.exe"
& (Join-Path $sourceRoot 'build-tools\nsis\Bin\makensis.exe') /V3 /INPUTCHARSET UTF8 "/DAPP_DIR=$appDir" "/DOUT_FILE=$setup" "/DVERSION=$version" "/DUNINSTALL_MANIFEST=$manifestPath" (Join-Path $PSScriptRoot 'Installer.nsi')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
Get-Item -LiteralPath $setup | Select-Object FullName,Length
Get-FileHash -LiteralPath $setup -Algorithm SHA256
