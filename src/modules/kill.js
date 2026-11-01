const execFile = require("child_process").execFile;
const ipcMain = require("electron").ipcMain;
const running = require("./is_running");
const gameRoots = require("./game-roots");

ipcMain.on("kill-game", (_event, root) => {
	kill.game(root);
})

ipcMain.on("kill-origin", () => {
	kill.origin();
})

// Terminates a Windows process by executable name.
async function kill(process_name) {
	return new Promise(resolve => {
		execFile(
			"taskkill.exe",
			["/IM", process_name, "/F"],
			{windowsHide: true},
			error => resolve(! error)
		);
	})
}

kill.process = kill;

kill.origin = async () => {
	let origin = await kill("Origin.exe");
	let eadesktop = await kill("EADesktop.exe");

	if (origin || eadesktop) {
		return true;
	}

	return false;
}

kill.game = async (root, dependencies = {}) => {
	if (typeof root !== "string" || !root.trim()) return false;
	const snapshot = await (dependencies.snapshot || running.snapshot)();
	const processes = gameRoots.processesForRoot(snapshot, root);
	if (!processes) return false;
	const pids = [...new Set(processes.map(process => Number(process.pid)).filter(pid => Number.isSafeInteger(pid) && pid > 0))];
	const terminate = dependencies.execFile || execFile;
	const results = await Promise.all(pids.map(pid => new Promise(resolve => {
		try {
			terminate("taskkill.exe", ["/PID", String(pid), "/F"], {windowsHide: true}, error => resolve(!error));
		} catch (_) {resolve(false);}
	})));
	return results.some(Boolean);
}

module.exports = kill;
