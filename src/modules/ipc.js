const win = require("../win");
const { app, dialog, ipcMain } = require("electron");

const kill = require("./kill");
const settings = require("./settings");
const is_running = require("./is_running");
const eaEmulator = require("./ea-emulator");

let closePromptOpen = false;
ipcMain.on("exit", async () => {
	const backgroundTray = require("./background-tray");
	if (eaEmulator.isActive()) {
		if (closePromptOpen) return;
		closePromptOpen = true;
		let response;
		try {
			({response} = await dialog.showMessageBox(win(), {
				type: "question",
				title: "EA 模拟器正在运行",
				message: "关闭启动器会停止 EA 模拟器服务。你想直接关闭，还是留在托盘继续运行？",
				buttons: ["直接关闭并停止 EA 服务", "留在托盘继续运行", "取消"],
				defaultId: 1,
				cancelId: 2,
				noLink: true
			}));
		} finally {
			closePromptOpen = false;
		}
		if (response === 1) {
			if (backgroundTray.requestExit()) return;
			return;
		}
		if (response !== 0) return;
		await eaEmulator.stop();
		backgroundTray.allowCloseNow();
	}
	if (settings().originkill) {
		if (await is_running.origin()) {
			await kill.origin();
		}
	}

	app.quit();
})

ipcMain.on("minimize", () => {
	win().minimize();
})

ipcMain.on("relaunch", () => {
	app.relaunch({
		args: process.argv.slice(1)
	})

	app.exit(0);
})
