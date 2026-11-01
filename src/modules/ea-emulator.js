"use strict";

// Coordinates the optional "official game without EA App" path: reads the
// installed game's locale/version, starts the local LSX endpoint and builds the
// environment block normally supplied by EA Desktop.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {execFile} = require("child_process");
const {app} = require("electron");
const {EaLsxServer, CONTENT_ID} = require("./ea-lsx");
const {rtpHandshakeCode} = require("./ea-crypto");
const console = require("./console");

const LSX_PORT = "3216";
const RGP_PORT = "1705";
const STEAM_PROXY_PORT = "1704";
let activeServer = null;

async function stopActive() {
	const server = activeServer;
	activeServer = null;
	if (server) await server.stop();
}
if (app?.on) app.on("will-quit", () => { void stopActive().catch(() => {}); });

function capture(script, timeout = 8000) {
	return new Promise(resolve => {
		try {
			execFile("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {windowsHide:true, timeout, maxBuffer:65536, encoding:"utf8"}, (error, stdout) => {
				resolve(error ? null : String(stdout).replace(/^\uFEFF/u, "").trim());
			});
		} catch (_) { resolve(null); }
	});
}

const LOCALE_SCRIPT = String.raw`
$ErrorActionPreference='SilentlyContinue'
$result=''
foreach($view in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)){
  $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine,$view)
  if($null -eq $base){continue}
  try {
    foreach($keyName in @('SOFTWARE\Respawn\Titanfall2','SOFTWARE\WOW6432Node\Respawn\Titanfall2')){
      $key=$base.OpenSubKey($keyName)
      if($null -eq $key){continue}
      try { $value=$key.GetValue('Locale'); if($value -is [string] -and $value.Trim()){ $result=$value.Trim(); break } } finally { $key.Dispose() }
    }
  } finally { $base.Dispose() }
  if($result){break}
}
if($result){Write-Output $result}else{Write-Output 'en_US'}
`;

// Titanfall 2 and several other EA titles probe this value before deciding to
// hand off to EA Desktop. The original emulator points it at sdiagnhost.exe.
// This is best effort: a non-elevated launcher still launches the game, but may
// see an EA App prompt on first run.
const REGISTRY_SCRIPT = String.raw`
$ErrorActionPreference='SilentlyContinue'
$client=Join-Path $env:SystemRoot 'System32\sdiagnhost.exe'
$written=$false
foreach($hive in @([Microsoft.Win32.Registry]::CurrentUser,[Microsoft.Win32.Registry]::LocalMachine)){
  foreach($keyName in @('SOFTWARE\WOW6432Node\Origin','SOFTWARE\Origin')){
    try {
      $key=$hive.CreateSubKey($keyName,$true)
      if($null -ne $key){
        try { $key.SetValue('ClientPath',$client,[Microsoft.Win32.RegistryValueKind]::String); $written=$true } finally { $key.Dispose() }
      }
    } catch {}
  }
}
if($written){Write-Output 'written'}else{Write-Output 'skipped'}
`;

function readGameVersion(root) {
	try {
		const filename = path.join(root, "__Installer", "installerdata.xml");
		const text = fs.readFileSync(filename, "utf8");
		const match = /<gameVersion\b[^>]*\bversion="([^"]+)"/i.exec(text);
		return match ? match[1] : "1.0.0.0";
	} catch (_) {
		return "1.0.0.0";
	}
}

async function readLocale() {
	const value = await capture(LOCALE_SCRIPT);
	if (!value || !/^[a-z]{2,3}_[A-Z]{2}$/u.test(value)) return "en_US";
	return value;
}

async function ensureRegistry() {
	const value = await capture(REGISTRY_SCRIPT);
	return {ok:value === "written", value:value || "unavailable"};
}

const REGISTRY_READ_SCRIPT = String.raw`
$ErrorActionPreference='SilentlyContinue'
$result=@()
foreach($hive in @([Microsoft.Win32.Registry]::CurrentUser,[Microsoft.Win32.Registry]::LocalMachine)){
  $hiveName=if($hive -eq [Microsoft.Win32.Registry]::CurrentUser){'HKCU'}else{'HKLM'}
  foreach($view in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)){
    $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$view)
    if($null -eq $base){continue}
    try {
      foreach($keyName in @('SOFTWARE\WOW6432Node\Origin','SOFTWARE\Origin')){
        $key=$base.OpenSubKey($keyName)
        if($null -eq $key){continue}
        try {
          $value=$key.GetValue('ClientPath')
          if($value -is [string] -and $value.Trim()){ $result += [pscustomobject]@{hive=$hiveName; view=[string]$view; path=$keyName; value=$value} }
        } finally { $key.Dispose() }
      }
    } finally { $base.Dispose() }
  }
}
ConvertTo-Json -InputObject @($result) -Compress
`;

async function readRegistry() {
	const value = await capture(REGISTRY_READ_SCRIPT);
	if (!value) return {ok:false, values:[]};
	try {
		const parsed = JSON.parse(value);
		const values = (Array.isArray(parsed) ? parsed : parsed ? [parsed] : []).filter(item => item && typeof item.value === "string" && item.value);
		return {ok:values.length > 0, hklm:values.some(item => item.hive === "HKLM"), values};
	} catch (_) {
		return {ok:false, hklm:false, values:[]};
	}
}

function isActive() { return Boolean(activeServer); }

function diagnostics() {
	return {
		active:isActive(),
		port:activeServer?.address?.port || LSX_PORT,
		logFile:path.join(app.getPath("appData"), "fold-ea-lsx.log"),
		recent:activeServer?.recent?.slice(-40) || []
	};
}

function buildEnvironment({profile, contentId, locale, port = LSX_PORT}) {
	return {
		EAFreeTrialGame:"false",
		EAAuthCode:"NeedsAFreshAuthCode",
		EALaunchOfflineMode:"false",
		OriginSessionKey:crypto.randomUUID(),
		EAGameLocale:locale,
		EALaunchEnv:"production",
		EALaunchEAID:profile.playerName || "",
		EALicenseToken:"Origin.OFR.50.0000721",
		EAEntitlementSource:"EA",
		EAUseIGOAPI:"1",
		EALaunchUserAuthToken:profile.accessToken,
		EAGenericAuthToken:profile.accessToken,
		EALaunchCode:"unavailable",
		EARtPLaunchCode:rtpHandshakeCode(),
		EALsxPort:String(port),
		EAEgsProxyIpcPort:RGP_PORT,
		EASteamProxyIpcPort:STEAM_PROXY_PORT,
		EAExternalSource:"EA",
		EASecureLaunchTokenTemp:"1001006949032",
		SteamAppId:"",
		ContentId:String(contentId),
		EAConnectionId:String(contentId),
		OPENSSL_ia32cap:"~0x200000200000000",
		EALaunchOwner:"EA",
		EAAccessTokenJWS:profile.accessToken
	};
}

async function start({root, profile, contentId = CONTENT_ID, log = () => {}} = {}) {
	if (!profile?.accessToken) throw Object.assign(Error("EA 模拟器需要先登录 EA 账号。"), {code:"EA_LOGIN_REQUIRED"});
	if (!root) throw Object.assign(Error("未选择有效的游戏目录。"), {code:"GAME_DIRECTORY_INVALID"});
	const [locale, registry] = await Promise.all([readLocale(), ensureRegistry()]);
	if (!registry.ok) console.warn("EA emulator registry hint was not written; the game may still launch with its LAUNCH environment.");
	const gameVersion = readGameVersion(root);
	// Keep a token-free LSX request log so a game-side authentication failure can
	// be traced to the exact request type without exposing auth codes or names.
	const lsxLogFile = path.join(app.getPath("appData"), "fold-ea-lsx.log");
	const writeLog = detail => {
		try {
			if (fs.existsSync(lsxLogFile) && fs.statSync(lsxLogFile).size > 262144) fs.writeFileSync(lsxLogFile, "", {encoding:"utf8", mode:0o600});
			fs.appendFileSync(lsxLogFile, JSON.stringify({at:new Date().toISOString(), ...detail}) + "\n", {encoding:"utf8", mode:0o600});
		} catch (_) {}
		log(detail);
	};
	// A previous game has already exited (launch guards reject while one runs),
	// so an old local endpoint is safe to replace with the current account.
	await stopActive();
	let server = new EaLsxServer({account:profile, contentId, locale, gameVersion, avatarPath:profile.avatarPath || "", log:writeLog});
	try {
		await server.start();
	} catch (error) {
		if (error.code !== "EA_PORT_IN_USE") throw Object.assign(Error("无法启动 EA 模拟器服务，请稍后重试。"), {code:"EA_LSX_START_FAILED", cause:error?.message});
		await server.stop();
		server = new EaLsxServer({account:profile, contentId, locale, gameVersion, avatarPath:profile.avatarPath || "", log:writeLog, port:0});
		try { await server.start(); }
		catch (retryError) { throw Object.assign(Error("无法建立本地连接，请稍后重试。"), {code:"EA_LSX_START_FAILED", cause:retryError?.message}); }
		log({stage:"port-recovered", port:server.address.port});
	}
	let stopped = false;
	activeServer = server;
	log({stage:"started", locale, gameVersion, registry:registry.value});
	return {
		env:buildEnvironment({profile, contentId, locale, port:server.address.port}),
		locale,
		gameVersion,
		registry,
		async stop() {
			if (stopped) return;
			stopped = true;
			if (activeServer === server) activeServer = null;
			await server.stop();
		}
	};
}

module.exports = {start, stop:stopActive, isActive, diagnostics, readGameVersion, readLocale, ensureRegistry, readRegistry, buildEnvironment, LSX_PORT};
