const fs = require("fs");
const path = require("path");
const vdf = require("./keyvalues");
const { promisify } = require("util");
const execFile = promisify(require("child_process").execFile);
const console = require("./console");

const APP_ID = "1237970";

// All registry paths are constants. JSON avoids PowerShell's table formatting,
// which can truncate paths or collapse meaningful spaces in folder names.
const REGISTRY_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$games = New-Object System.Collections.Generic.List[string]
$steam = New-Object System.Collections.Generic.List[string]
$gameKeys = @('SOFTWARE\Respawn\Titanfall2', 'SOFTWARE\EA Games\Titanfall 2', 'SOFTWARE\EA Games\Titanfall2', 'SOFTWARE\Origin Games\Titanfall 2', 'SOFTWARE\Origin Games\Titanfall2')
$views = @([Microsoft.Win32.RegistryView]::Registry64, [Microsoft.Win32.RegistryView]::Registry32)
$hives = @([Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryHive]::CurrentUser)
foreach ($hive in $hives) {
    foreach ($view in $views) {
        $base = $null
        try {
            $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
            foreach ($keyPath in $gameKeys) {
                $key = $base.OpenSubKey($keyPath)
                if ($null -ne $key) {
                    try {
                        foreach ($valueName in @('Install Dir', 'InstallDir', 'InstallLocation', 'InstallPath')) {
                            $value = $key.GetValue($valueName)
                            if ($value -is [string] -and $value.Trim()) { $games.Add($value) }
                        }
                    } finally { $key.Dispose() }
                }
            }
            $key = $base.OpenSubKey('SOFTWARE\Valve\Steam')
            if ($null -ne $key) {
                try {
                    foreach ($valueName in @('SteamPath', 'InstallPath')) {
                        $value = $key.GetValue($valueName)
                        if ($value -is [string] -and $value.Trim()) { $steam.Add($value) }
                    }
                } finally { $key.Dispose() }
            }
            $uninstall = $base.OpenSubKey('SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall')
            if ($null -ne $uninstall) {
                try {
                    foreach ($name in $uninstall.GetSubKeyNames()) {
                        $key = $uninstall.OpenSubKey($name)
                        if ($null -eq $key) { continue }
                        try {
                            $displayName = $key.GetValue('DisplayName')
                            if ($displayName -is [string] -and $displayName -match '(?i)^Titanfall(?:®|™)?\s*2(?:\s|$)') {
                                $value = $key.GetValue('InstallLocation')
                                if ($value -is [string] -and $value.Trim()) { $games.Add($value) }
                            }
                        } finally { $key.Dispose() }
                    }
                } finally { $uninstall.Dispose() }
            }
        } catch { } finally { if ($null -ne $base) { $base.Dispose() } }
    }
}
@{ gamePaths = @($games); steamPaths = @($steam) } | ConvertTo-Json -Compress
`;

function normalizeGamePath(value) {
	if (typeof value !== "string") { return ""; }
	let folder = value.trim().replace(/^"([\s\S]*)"$/, "$1");
	if (!folder || folder.includes("\0")) { return ""; }
	folder = folder.replace(/%([^%]+)%/g, (match, name) => {
		const key = Object.keys(process.env).find(key => key.toLowerCase() === name.toLowerCase());
		return key ? process.env[key] : match;
	});
	if (!path.isAbsolute(folder)) { return ""; }
	folder = path.normalize(folder);
	if (path.basename(folder).toLowerCase() === "titanfall2.exe") {
		folder = path.dirname(folder);
	}
	return folder;
}

function validateGamePath(value) {
	const folder = normalizeGamePath(value);
	if (!folder) { return false; }
	try {
		return fs.statSync(path.join(folder, "Titanfall2.exe")).isFile() ? folder : false;
	} catch (_) {
		return false;
	}
}

function uniquePaths(values) {
	const seen = new Set();
	return values.map(normalizeGamePath).filter(folder => {
		if (!folder) { return false; }
		const key = process.platform === "win32" ? folder.toLowerCase() : folder;
		if (seen.has(key)) { return false; }
		seen.add(key);
		return true;
	});
}

function field(object, name) {
	if (!object || typeof object !== "object") { return undefined; }
	const key = Object.keys(object).find(key => key.toLowerCase() === name.toLowerCase());
	return key === undefined ? undefined : object[key];
}

function readVdf(filename) {
	try { return vdf.parse(fs.readFileSync(filename, "utf8")); }
	catch (_) { return false; }
}

// Old Steam VDFs use numeric string entries; current VDFs use objects with path.
function libraryPaths(filename) {
	const libraries = field(readVdf(filename), "libraryfolders");
	if (!libraries || typeof libraries !== "object") { return []; }
	return uniquePaths(Object.keys(libraries).filter(key => /^\d+$/.test(key)).map(key => {
		const value = libraries[key];
		return typeof value === "string" ? value : field(value, "path");
	}));
}

function gameInLibrary(library) {
	const steamapps = path.join(library, "steamapps");
	const manifest = field(readVdf(path.join(steamapps, `appmanifest_${APP_ID}.acf`)), "AppState");
	const installDir = field(manifest, "installdir");
	const appId = field(manifest, "appid");
	if (typeof installDir === "string" && (!appId || String(appId) === APP_ID)) {
		// Steam installdir is a relative path under common, never an arbitrary root.
		const common = path.resolve(steamapps, "common");
		const candidate = path.resolve(common, installDir);
		const relative = path.relative(common, candidate);
		if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
			const valid = validateGamePath(candidate);
			if (valid) { return valid; }
		}
	}
	for (const folderName of ["Titanfall2", "Titanfall 2"]) {
		const valid = validateGamePath(path.join(steamapps, "common", folderName));
		if (valid) { return valid; }
	}
	return false;
}

async function registryPaths() {
	if (process.platform !== "win32") { return { gamePaths: [], steamPaths: [] }; }
	try {
		const encoded = Buffer.from(REGISTRY_SCRIPT, "utf16le").toString("base64");
		const { stdout } = await execFile("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
			windowsHide: true, encoding: "utf8", timeout: 10000, maxBuffer: 1024 * 1024
		});
		const result = JSON.parse(stdout.replace(/^\uFEFF/, "").trim());
		return {
			gamePaths: Array.isArray(result.gamePaths) ? result.gamePaths : [],
			steamPaths: Array.isArray(result.steamPaths) ? result.steamPaths : []
		};
	} catch (error) {
		console.info("Game registry detection unavailable:", error.message);
		return { gamePaths: [], steamPaths: [] };
	}
}

function sameGamePath(left, right) {
	if (typeof left !== "string" || typeof right !== "string" || !left.trim() || !right.trim()) { return false; }
	return path.win32.resolve(left).replace(/[\\/]+$/, "").toLowerCase() === path.win32.resolve(right).replace(/[\\/]+$/, "").toLowerCase();
}

function resolveSelectedGamePath(value) {
	const candidate = normalizeGamePath(value);
	if (!candidate) { return false; }
	const direct = validateGamePath(candidate);
	if (direct) { return direct; }
	const fromLibrary = gameInLibrary(candidate);
	if (fromLibrary) { return fromLibrary; }
	const name = path.basename(candidate).toLowerCase();
	if (name === "steamapps") { return gameInLibrary(path.dirname(candidate)); }
	if (name === "common") { return gameInLibrary(path.dirname(path.dirname(candidate))); }
	return validateGamePath(path.dirname(candidate)) || false;
}

async function findGames(options = {}) {
	const registry = options.registry || await registryPaths();
	const games = [];
	for (const candidate of uniquePaths(registry.gamePaths || [])) {
		const valid = validateGamePath(candidate);
		if (valid) { games.push(valid); }
	}
	const defaultSteamPaths = options.defaultSteamPaths || [
		process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Steam"),
		process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Steam"),
		"C:\\Program Files (x86)\\Steam"
	];
	const roots = uniquePaths([...(registry.steamPaths || []), ...(options.steamPaths || []), ...defaultSteamPaths]);
	const libraries = [...roots];
	for (const root of roots) {
		libraries.push(...libraryPaths(path.join(root, "steamapps", "libraryfolders.vdf")));
		libraries.push(...libraryPaths(path.join(root, "config", "libraryfolders.vdf")));
	}
	for (const library of uniquePaths(libraries)) {
		const valid = gameInLibrary(library);
		if (valid) { games.push(valid); }
	}
	return uniquePaths(games);
}

function selectGlobalGamePath(games, chinaPath) {
	const china = normalizeGamePath(chinaPath);
	for (const candidate of uniquePaths(Array.isArray(games) ? games : [])) {
		if (!china || !sameGamePath(candidate, china)) { return candidate; }
	}
	return false;
}

async function findgame(options = {}) {
	const games = await findGames(options);
	if (games.length) { console.ok("Found game in:", games[0]); return games[0]; }
	return false;
}

module.exports = findgame;
module.exports.normalizeGamePath = normalizeGamePath;
module.exports.validateGamePath = validateGamePath;
module.exports.libraryPaths = libraryPaths;
module.exports.gameInLibrary = gameInLibrary;
module.exports.findGames = findGames;
module.exports.sameGamePath = sameGamePath;
module.exports.resolveSelectedGamePath = resolveSelectedGamePath;
module.exports.selectGlobalGamePath = selectGlobalGamePath;
module.exports.registryPaths = registryPaths;
