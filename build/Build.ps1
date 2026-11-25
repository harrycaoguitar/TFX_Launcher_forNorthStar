param(
  [string]$RuntimeDir,
  [string]$OutputRoot = (Join-Path $PSScriptRoot '..\dist'),
  [switch]$Portable
)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$package = Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$version = $package.version
$versionMatch = [regex]::Match($version, '^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$')
if (!$versionMatch.Success) { throw "Invalid semantic version: $version" }
$fileVersion = "{0}.{1}.{2}.0" -f $versionMatch.Groups['major'].Value,$versionMatch.Groups['minor'].Value,$versionMatch.Groups['patch'].Value
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
$runtimeFiles = @('chrome_100_percent.pak','chrome_200_percent.pak','d3dcompiler_47.dll','ffmpeg.dll','icudtl.dat','libEGL.dll','libGLESv2.dll','LICENSE.electron.txt','LICENSES.chromium.html','resources.pak','snapshot_blob.bin','v8_context_snapshot.bin')
foreach ($file in $runtimeFiles) { Copy-Item -LiteralPath (Join-Path $RuntimeDir $file) -Destination $appDir }
Copy-Item -LiteralPath $runtimeExe -Destination (Join-Path $appDir 'TFX-Launcher.exe')
$localesDir = Join-Path $appDir 'locales'
New-Item -ItemType Directory -Path $localesDir | Out-Null
foreach ($locale in @('en-US','zh-CN','zh-TW','de','fr')) {
  Copy-Item -LiteralPath (Join-Path $RuntimeDir "locales\$locale.pak") -Destination $localesDir
}
$appExe = Join-Path $appDir 'TFX-Launcher.exe'
New-Item -ItemType Directory -Path (Join-Path $appDir 'resources') | Out-Null
$builder = Get-Content -LiteralPath (Join-Path $sourceRoot 'build.config.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$exclude = @($builder.files | Where-Object { $_.StartsWith('!src/') } | ForEach-Object { $_.Substring(1).Replace('/**/*','/*').Replace('**','*') })
$activeLegacyJs = @('src/app/js/locales.js','src/app/js/feature-copy.js','src/app/js/official-errors.js','src/app/js/i18n.js')
Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'src') -File -Recurse | ForEach-Object {
  $relative = $_.FullName.Substring($sourceRoot.Length + 1).Replace('\','/')
  $deadLegacyJs = $relative.StartsWith('src/app/js/') -and ($activeLegacyJs -notcontains $relative)
  if (!$deadLegacyJs -and !($exclude | Where-Object { $relative -like $_ })) {
    $destination = Join-Path $stage $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $destination
  }
}
foreach ($file in @('package.json','LICENSE','THIRD_PARTY_NOTICES.md')) {
  Copy-Item -LiteralPath (Join-Path $sourceRoot $file) -Destination $stage
}
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
& (Join-Path $sourceRoot 'build-tools\rcedit-x64.exe') $appExe --set-file-version "$fileVersion" --set-product-version "$fileVersion" --set-version-string ProductName 'TFX Launcher' --set-version-string FileDescription "TFX Launcher $version" --set-version-string FileVersion "$version" --set-version-string ProductVersion "$version" --set-icon (Join-Path $sourceRoot 'src\assets\icons\icon.ico')
if ($LASTEXITCODE -ne 0) { throw 'Executable version update failed.' }
if ($Portable) {
  $zip = Join-Path $OutputRoot "TFX-Launcher-$version-Portable.zip"
  $archiveTool = Join-Path $sourceRoot 'src\tools\vtf\7z.exe'
  $compact = Join-Path $OutputRoot "TFX-Launcher-$version-Portable.7z"
  Push-Location -LiteralPath $OutputRoot
  try {
    & $archiveTool a -tzip -mx=7 -mmt=2 -bd -bso0 $zip (Split-Path -Leaf $appDir)
    if ($LASTEXITCODE -ne 0) { throw 'Portable ZIP creation failed.' }
    & $archiveTool a -t7z -mx=7 -mmt=2 -bd -bso0 $compact (Split-Path -Leaf $appDir)
    if ($LASTEXITCODE -ne 0) { throw 'Compact portable archive creation failed.' }
    foreach ($artifact in @($zip,$compact)) {
      & $archiveTool t -bd -bso0 $artifact
      if ($LASTEXITCODE -ne 0) { throw "Archive verification failed: $artifact" }
    }
  } finally { Pop-Location }
  Get-Item -LiteralPath $zip,$compact | Select-Object FullName,Length
  return
}
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
& (Join-Path $sourceRoot 'build-tools\nsis\Bin\makensis.exe') /V3 /INPUTCHARSET UTF8 "/DAPP_DIR=$appDir" "/DOUT_FILE=$setup" "/DVERSION=$version" "/DFILEVERSION=$fileVersion" "/DUNINSTALL_MANIFEST=$manifestPath" (Join-Path $PSScriptRoot 'Installer.nsi')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
Get-Item -LiteralPath $setup | Select-Object FullName,Length
Get-FileHash -LiteralPath $setup -Algorithm SHA256
