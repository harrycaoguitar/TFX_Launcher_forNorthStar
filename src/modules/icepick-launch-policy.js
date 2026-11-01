"use strict";

function assertCanLaunch({found, sdkOk, gameValid, eaEmulator}) {
	if (eaEmulator) throw Object.assign(Error("使用 Icepick 前，请先关闭内置 EA 模拟器。Icepick 需要通过 Steam、EA App 或 Origin 自行启动游戏。"), {code:"ICEPICK_EA_EMULATOR_CONFLICT"});
	if (!found) throw Object.assign(Error("未找到 Icepick。请先选择包含 Titanfall-2-Icepick.exe 的目录。"), {code:"ICEPICK_NOT_FOUND"});
	if (!sdkOk) throw Object.assign(Error("Icepick 目录缺少 TTF2SDK.dll，无法注入战役 Mod。"), {code:"ICEPICK_SDK_MISSING"});
	if (!gameValid) throw Object.assign(Error("请先在设置中选择有效的 Titanfall 2 游戏目录。"), {code:"ICEPICK_GAME_MISSING"});
	return true;
}

module.exports = {assertCanLaunch};
