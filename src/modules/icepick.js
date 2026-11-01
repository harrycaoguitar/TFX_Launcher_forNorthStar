"use strict";

// Integration for the external Titanfall 2 Icepick campaign-mod launcher.
// Icepick still performs the TTF2SDK injection; TFX provides discovery, the
// campaign-mod section, mod enable/disable/import and a one-click launcher.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {execFile} = require("child_process");
const {pathToFileURL} = require("url");
const {app, dialog, ipcMain, shell} = require("electron");
const settings = require("./settings");
const findgame = require("./findgame");

let jsonrepair = null;
try {
	const module = require("jsonrepair");
	jsonrepair = typeof module === "function" ? module : module.jsonrepair;
} catch (_) {}

const EXE_NAME = "Titanfall-2-Icepick.exe";
const SDK_NAME = "TTF2SDK.dll";
const MODS_DIR = path.join("data", "mods");
const SAVES_DIR = path.join("data", "saves");
const SITE = "https://titanfallmods.com";

function fail(code, message) { return Object.assign(Error(message), {code}); }
function isFile(filename) { try { return fs.statSync(filename).isFile(); } catch (_) { return false; } }
function isDirectory(directory) { try { return fs.statSync(directory).isDirectory(); } catch (_) { return false; } }
function inside(base, candidate) {
	const relative = path.relative(base, candidate);
	return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

function candidates() {
	const roots = [
		settings().icepickPath,
		"D:\\icepick",
		"C:\\icepick",
		process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "icepick"),
		process.env.APPDATA && path.join(process.env.APPDATA, "icepick"),
		process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Icepick"),
		process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Icepick")
	];
	return roots.filter(value => typeof value === "string" && path.isAbsolute(value)).map(value => path.normalize(value));
}

function validDirectory(directory) {
	return isDirectory(directory) && isFile(path.join(directory, EXE_NAME));
}

function resolveDirectory() {
	for (const directory of candidates()) if (validDirectory(directory)) return directory;
	return "";
}

function readDefinition(modDirectory) {
	const filename = path.join(modDirectory, "mod.json");
	try {
		const text = fs.readFileSync(filename, "utf8").replace(/^\uFEFF/u, "");
		let value;
		try { value = JSON.parse(text); }
		catch (_) { if (!jsonrepair) return null; value = JSON.parse(jsonrepair(text)); }
		if (!value || typeof value !== "object") return null;
		return value;
	} catch (_) {
		return null;
	}
}

function authorsOf(value) {
	if (Array.isArray(value)) return value.filter(item => typeof item === "string" && item.trim()).map(item => item.trim());
	if (typeof value === "string" && value.trim()) return [value.trim()];
	return [];
}

const translations = {
	"Icepick.Framework": {name:"Icepick 框架", description:"Icepick 的核心框架，提供沙盒、工具枪、生成菜单和战役 Mod 支持。"},
	"Wilko.CustomGauntlets": {name:"自定义跑酷 / 靶场", description:"允许你创建、保存和竞速自己的自定义跑酷路线。"}
};

function localizedMod(entryName, definition) {
	if (translations[entryName]) return translations[entryName];
	return null;
}

function listMods(directory) {
	const modsDirectory = path.join(directory, MODS_DIR);
	if (!isDirectory(modsDirectory)) return [];
	const mods = [];
	for (const entry of fs.readdirSync(modsDirectory, {withFileTypes:true})) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
		const modDirectory = path.join(modsDirectory, entry.name);
		const definition = readDefinition(modDirectory);
		const image = path.join(modDirectory, "mod.png");
		const enabled = !fs.existsSync(path.join(modDirectory, "disabled"));
		const localized = localizedMod(entry.name, definition);
		const catalogAuthors = localized && typeof localized.author === "string" && localized.author && localized.author !== "Unknown" ? [localized.author] : [];
		mods.push({
			id: entry.name,
			directory: modDirectory,
			name: (localized && localized.name) || (definition && typeof definition.Name === "string" && definition.Name.trim()) || entry.name,
			description: (localized && localized.description) || (definition && typeof definition.Description === "string" ? definition.Description : ""),
			version: definition && typeof definition.Version === "string" ? definition.Version : "",
			authors: authorsOf(definition?.Authors).length ? authorsOf(definition?.Authors) : catalogAuthors,
			enabled,
			valid: Boolean(definition),
			imageUrl: isFile(image) ? pathToFileURL(image).href : "",
			core: entry.name === "Icepick.Framework"
		});
	}
	return mods.sort((left, right) => left.name.localeCompare(right.name, undefined, {sensitivity:"base"}));
}

function gameInfo() {
	const folder = settings().gamepath || "";
	const valid = folder ? findgame.validateGamePath(folder) : false;
	return {folder: valid || folder, executable: valid ? path.join(valid, "Titanfall2.exe") : "", valid: Boolean(valid)};
}

function status() {
	const directory = resolveDirectory();
	const game = gameInfo();
	if (!directory) return {ok:false, found:false, path:"", candidates:candidates(), game, mods:[]};
	const dataDirectory = path.join(directory, "data");
	const modsDirectory = path.join(dataDirectory, "mods");
	const savesDirectory = path.join(dataDirectory, "saves");
	return {
		ok:true,
		found:true,
		path:directory,
		executable:path.join(directory, EXE_NAME),
		sdk:path.join(directory, SDK_NAME),
		sdkOk:isFile(path.join(directory, SDK_NAME)),
		dataOk:isDirectory(dataDirectory),
		modsDirectory,
		savesDirectory,
		game,
		mods:listMods(directory)
	};
}

async function savePath(directory) {
	if (!validDirectory(directory)) throw fail("ICEPICK_INVALID_DIRECTORY", "所选目录中没有 Titanfall-2-Icepick.exe。");
	const current = settings();
	if (current.icepickPath !== directory) await current.saveAsync({icepickPath:directory});
	return status();
}

async function select(parent) {
	const result = await dialog.showOpenDialog(parent, {
		title:"选择 Icepick 目录（包含 Titanfall-2-Icepick.exe）",
		properties:["openDirectory"]
	});
	if (result.canceled || !result.filePaths?.[0]) return {ok:false, canceled:true, status:status()};
	return {ok:true, status:await savePath(path.normalize(result.filePaths[0]))};
}

function writeRegistry(executable) {
	return new Promise(resolve => {
		if (!executable || !isFile(executable)) { resolve({ok:false, reason:"missing-game"}); return; }
		try {
			execFile("reg.exe", ["add", "HKCU\\Software\\TitanfallIcepick", "/v", "InstallPath", "/t", "REG_SZ", "/d", executable, "/f"], {windowsHide:true, timeout:5000}, error => {
				resolve({ok:!error, reason:error ? "registry" : "written"});
			});
		} catch (_) { resolve({ok:false, reason:"registry"}); }
	});
}

async function launch() {
	const current = status();
	if (!current.ok) throw fail("ICEPICK_NOT_FOUND", "未找到 Icepick。请先选择包含 Titanfall-2-Icepick.exe 的目录。");
	if (!current.sdkOk) throw fail("ICEPICK_SDK_MISSING", "Icepick 目录缺少 TTF2SDK.dll，无法注入战役 Mod。");
	if (!current.game.valid) throw fail("ICEPICK_GAME_MISSING", "请先在设置中选择有效的 Titanfall 2 游戏目录。");
	const registry = await writeRegistry(current.game.executable);
	const saved = settings();
	if (saved.icepickPath !== current.path) {
		try { await saved.saveAsync({icepickPath:current.path}); } catch (_) {}
	}
	return new Promise((resolve, reject) => {
		try {
			const child = require("child_process").spawn(current.executable, [], {cwd:current.path, detached:true, stdio:"ignore", windowsHide:false});
			child.once("error", error => reject(fail("ICEPICK_LAUNCH_FAILED", "无法启动 Icepick：" + error.message)));
			child.once("spawn", () => { child.unref(); resolve({ok:true, pid:child.pid, path:current.path, registry:registry.reason}); });
		} catch (error) {
			reject(fail("ICEPICK_LAUNCH_FAILED", "无法启动 Icepick：" + error.message));
		}
	});
}

function resolveMod(directory, id) {
	if (typeof id !== "string" || !id || id === "." || id === ".." || /[\\/:*?"<>|]/u.test(id)) throw fail("ICEPICK_MOD_INVALID", "Mod 名称无效。");
	const modsDirectory = path.join(directory, MODS_DIR);
	const target = path.resolve(modsDirectory, id);
	if (!inside(modsDirectory, target) || !isDirectory(target)) throw fail("ICEPICK_MOD_NOT_FOUND", "未找到该 Mod。");
	return target;
}

async function toggle(id) {
	const directory = resolveDirectory();
	if (!directory) throw fail("ICEPICK_NOT_FOUND", "未找到 Icepick。");
	if (id === "Icepick.Framework") throw fail("ICEPICK_CORE_MOD", "Icepick.Framework 是核心框架，不能禁用。");
	const modDirectory = resolveMod(directory, id);
	const disabled = path.join(modDirectory, "disabled");
	if (fs.existsSync(disabled)) fs.unlinkSync(disabled); else fs.writeFileSync(disabled, "", {flag:"wx"});
	return status();
}

async function remove(id) {
	const directory = resolveDirectory();
	if (!directory) throw fail("ICEPICK_NOT_FOUND", "未找到 Icepick。");
	if (id === "Icepick.Framework") throw fail("ICEPICK_CORE_MOD", "Icepick.Framework 是核心框架，不能从启动器删除。");
	const modDirectory = resolveMod(directory, id);
	fs.rmSync(modDirectory, {recursive:true, force:true});
	return status();
}

function extract(zip, destination) {
	return new Promise((resolve, reject) => {
		const sevenZip = path.join(__dirname, "..", "tools", "vtf", "7z.exe").replace(/app\.asar([\\/])/u, "app.asar.unpacked$1");
		if (!isFile(sevenZip)) { reject(fail("ICEPICK_IMPORT_TOOL_MISSING", "找不到内置解压工具 7z.exe。")); return; }
		execFile(sevenZip, ["x", "-y", "-o" + destination, zip], {windowsHide:true, timeout:120000, maxBuffer:1024 * 1024}, error => {
			if (error) reject(fail("ICEPICK_IMPORT_EXTRACT", "解压 Mod 失败：" + error.message));
			else resolve();
		});
	});
}

function findModSource(root) {
	const queue = [root];
	while (queue.length) {
		const directory = queue.shift();
		if (isFile(path.join(directory, "mod.json"))) return directory;
		let entries = [];
		try { entries = fs.readdirSync(directory, {withFileTypes:true}); } catch (_) { continue; }
		for (const entry of entries) if (entry.isDirectory() && !entry.name.startsWith(".")) queue.push(path.join(directory, entry.name));
	}
	return "";
}

async function installArchive(archive, name, {parent, raw = false, overwrite = false} = {}) {
	const directory = resolveDirectory();
	if (!directory) throw fail("ICEPICK_NOT_FOUND", "未找到 Icepick。");
	const safeName = String(name || path.basename(archive, path.extname(archive))).replace(/[\\/:*?"<>|]/gu, "_").trim();
	if (!safeName || safeName === "." || safeName === "..") throw fail("ICEPICK_IMPORT_INVALID", "Mod 名称无效。");
	const modsDirectory = path.join(directory, MODS_DIR);
	const destination = path.join(modsDirectory, safeName);
	if (fs.existsSync(destination) && !overwrite) {
		const answer = await dialog.showMessageBox(parent, {
			type:"question", buttons:["覆盖","取消"], defaultId:1, cancelId:1,
			title:"Mod 已存在", message:`“${safeName}” 已经存在，是否覆盖？`
		});
		if (answer.response !== 0) return {ok:false, canceled:true, status:status()};
		fs.rmSync(destination, {recursive:true, force:true});
	}
	const temporary = path.join(modsDirectory, ".import-" + crypto.randomUUID());
	try {
		fs.mkdirSync(temporary, {recursive:true});
		await extract(archive, temporary);
		const entries = fs.readdirSync(temporary, {withFileTypes:true});
		const rootHasDefinition = isFile(path.join(temporary, "mod.json"));
		const single = entries.length === 1 && entries[0].isDirectory() ? path.join(temporary, entries[0].name) : "";
		const source = rootHasDefinition ? temporary : findModSource(temporary) || (raw ? single || temporary : "");
		if (!source) throw fail("ICEPICK_IMPORT_INVALID", "ZIP 中没有 mod.json，不是有效的 Icepick Mod。");
		fs.renameSync(source, destination);
		if (fs.existsSync(path.join(destination, "disabled"))) fs.unlinkSync(path.join(destination, "disabled"));
		return {ok:true, status:status(), name:safeName};
	} finally {
		try { fs.rmSync(temporary, {recursive:true, force:true}); } catch (_) {}
	}
}

function validateModDirectory(root) {
	const base = path.resolve(root), stack = [base]; let count = 0, bytes = 0;
	if (!isFile(path.join(base, "mod.json"))) throw fail("ICEPICK_IMPORT_INVALID", "不是有效的 Icepick Mod 文件夹。");
	while (stack.length) {
		const current = stack.pop();
		for (const entry of fs.readdirSync(current, {withFileTypes:true})) {
			const target = path.join(current, entry.name), stat = fs.lstatSync(target);
			if (stat.isSymbolicLink() || !stat.isDirectory() && !stat.isFile()) throw fail("ICEPICK_IMPORT_UNSAFE", "Mod 包含不安全的链接或特殊文件。");
			if (stat.isDirectory()) stack.push(target);
			else { count++; bytes += stat.size; if (count > 20000 || bytes > 2 * 1024 ** 3) throw fail("ICEPICK_IMPORT_LIMIT", "Mod 包超过支持的大小限制。"); }
		}
	}
	return {base, count, bytes};
}

async function installSource(source, name, {parent} = {}) {
	const directory = resolveDirectory();
	if (!directory) throw fail("ICEPICK_NOT_FOUND", "未找到 Icepick。请先选择 Icepick 目录。");
	const checked = validateModDirectory(source), safeName = String(name || path.basename(checked.base)).replace(/[\\/:*?"<>|]/gu, "_").trim();
	if (!safeName || safeName === "." || safeName === "..") throw fail("ICEPICK_IMPORT_INVALID", "Mod 名称无效。");
	const modsDirectory = path.join(directory, MODS_DIR), destination = path.join(modsDirectory, safeName), temporary = path.join(modsDirectory, ".import-" + crypto.randomUUID()), backup = path.join(modsDirectory, ".replace-" + crypto.randomUUID());
	fs.mkdirSync(modsDirectory, {recursive:true});
	let replaced = false, committed = false;
	try {
		fs.cpSync(checked.base, temporary, {recursive:true, dereference:false, errorOnExist:true, force:false});
		validateModDirectory(temporary);
		fs.rmSync(path.join(temporary, "disabled"), {recursive:true, force:true});
		if (fs.existsSync(destination)) {
			const answer = await dialog.showMessageBox(parent, {type:"question", buttons:["覆盖", "取消"], defaultId:1, cancelId:1, title:"Mod 已存在", message:`“${safeName}” 已经存在，是否覆盖？`});
			if (answer.response !== 0) return {ok:false, canceled:true, status:status()};
			fs.renameSync(destination, backup); replaced = true;
		}
		fs.renameSync(temporary, destination);
		committed = true;
		const current = status();
		if (replaced) try { fs.rmSync(backup, {recursive:true, force:true}); } catch (_) {}
		return {ok:true, status:current, name:safeName};
	} catch (error) {
		if (committed && fs.existsSync(destination)) fs.rmSync(destination, {recursive:true, force:true});
		if (replaced && fs.existsSync(backup) && !fs.existsSync(destination)) fs.renameSync(backup, destination);
		throw error;
	} finally {
		try { fs.rmSync(temporary, {recursive:true, force:true}); } catch (_) {}
	}
}

async function importMod(parent) {
	const directory = resolveDirectory();
	if (!directory) throw fail("ICEPICK_NOT_FOUND", "未找到 Icepick。");
	const picked = await dialog.showOpenDialog(parent, {
		title:"选择 Icepick Mod ZIP",
		properties:["openFile"],
		filters:[{name:"Icepick Mod", extensions:["zip"]}]
	});
	if (picked.canceled || !picked.filePaths?.[0]) return {ok:false, canceled:true, status:status()};
	const archive = picked.filePaths[0];
	return installArchive(archive, path.basename(archive, path.extname(archive)), {parent});
}

async function open(kind) {
	const directory = resolveDirectory();
	if (kind === "site") { await shell.openExternal(SITE); return {ok:true}; }
	if (!directory) throw fail("ICEPICK_NOT_FOUND", "未找到 Icepick。");
	const targets = {dir:directory, mods:path.join(directory, MODS_DIR), saves:path.join(directory, SAVES_DIR)};
	const target = targets[kind];
	if (!target) throw fail("ICEPICK_OPEN_INVALID", "无效的打开目标。");
	if (!isDirectory(target)) throw fail("ICEPICK_FOLDER_MISSING", "目录不存在：" + target);
	const error = await shell.openPath(target);
	return error ? {ok:false, error} : {ok:true};
}

function failure(error) {
	return {ok:false, code:error?.code || "ICEPICK_FAILED", error:error?.message || String(error)};
}

function register() {
	ipcMain.handle("icepick-status", () => { try { return {ok:true, status:status()}; } catch (error) { return failure(error); } });
	ipcMain.handle("icepick-select", async () => {
		try {
			const window = require("../win")();
			return await select(window && !window.isDestroyed() ? window : undefined);
		} catch (error) { return failure(error); }
	});
	ipcMain.handle("icepick-launch", async () => { try { return await launch(); } catch (error) { return failure(error); } });
	ipcMain.handle("icepick-toggle", async (_event, id) => { try { return {ok:true, status:await toggle(id)}; } catch (error) { return failure(error); } });
	ipcMain.handle("icepick-remove", async (_event, id) => { try { return {ok:true, status:await remove(id)}; } catch (error) { return failure(error); } });
	ipcMain.handle("icepick-import", async () => {
		try {
			const window = require("../win")();
			return await importMod(window && !window.isDestroyed() ? window : undefined);
		} catch (error) { return failure(error); }
	});
	ipcMain.handle("icepick-open", async (_event, kind) => { try { return await open(kind); } catch (error) { return failure(error); } });
}

module.exports = {register, status, select, launch, toggle, remove, importMod, installArchive, installSource, open, resolveDirectory};
