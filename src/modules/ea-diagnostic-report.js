"use strict";

function describe(data) {
	const enabled = data.emulatorEnabled === true;
	const session = data.account || {};
	const port = data.port || {};
	const registry = data.registry || {};
	const bridge = (registry.values || []).some(item => /(?:^|[\\/])sdiagnhost\.exe$/iu.test(item.value));
	const checks = [
		{id:"service", title:"本地模拟服务", state:enabled ? "ok" : "idle", value:data.emulator?.active ? "运行中" : enabled ? "待命" : "已关闭", detail:data.emulator?.active ? `本地端口 ${port.port}` : "服务会在启动游戏时建立。"},
		{id:"account", title:"账户凭据", state:!session.loggedIn || session.expired ? "warn" : "ok", value:!session.loggedIn ? "尚未登录" : session.expired ? "已过期" : "已缓存", detail:!session.loggedIn ? "连接 EA 账户后再启动原版游戏。" : session.expired ? "点击刷新账户；刷新失败时重新连接。" : "本地凭据未过期；实际授权由游戏启动时验证。"},
		{id:"game", title:"游戏目录", state:data.game?.valid ? "ok" : "warn", value:data.game?.valid ? "已找到" : "未找到", detail:data.game?.valid ? "游戏目录检查通过。" : "在开始游戏页面选择 Titanfall 2 目录。"},
		{id:"registry", title:"游戏启动桥接", state:bridge ? "ok" : "warn", value:bridge ? "已配置" : "待配置", detail:bridge ? "本地启动桥接已配置。" : "点击修复连接，配置本地启动桥接。"},
		{id:"port", title:"LSX 通道", state:port.owner === "other" ? "warn" : port.code && port.code !== "ECONNREFUSED" ? "warn" : "ok", value:port.owner === "tfx" ? "已连接" : port.owner === "other" ? "默认端口被占用" : port.code && port.code !== "ECONNREFUSED" ? "检查失败" : "端口可用", detail:port.owner === "other" ? "启动时会尝试分配其他本地端口，不会结束其他程序。" : port.code && port.code !== "ECONNREFUSED" ? `端口检查返回 ${port.code}。` : `127.0.0.1:${port.port || 3216}`},
		{id:"network", title:"EA 登录连接", state:!data.network ? "idle" : data.network.reachable ? "ok" : "warn", value:!data.network ? "尚未测试" : data.network.reachable ? "可连接" : "连接失败", detail:!data.network ? "点击重新诊断，检查 EA 登录站点连接。" : data.network.reachable ? `EA 登录站点响应 ${data.network.elapsedMs} ms；不代表账户已获授权。` : `无法连接 EA 登录站点（${data.network.code || "未知错误"}），请检查网络。`}
	];
	const issues = checks.filter(item => item.state === "warn").length;
	return {checks, issues, label:!enabled ? "模拟器已关闭" : issues ? `${issues} 项待处理` : "检查通过", state:!enabled ? "idle" : issues ? "warn" : "ok"};
}

function formatReport(data) {
	const view = describe(data);
	return [
		"TFX Launcher / EA 连接诊断",
		`时间：${data.at || "未知"}`,
		`模拟器：${data.emulatorEnabled ? "已启用" : "已关闭"}`,
		`状态：${view.label}`,
		...view.checks.map(item => `${item.title}：${item.value}\n  ${item.detail}`),
		"",
		"报告不包含登录令牌、账户 ID 或凭据文件内容。"
	].join("\n");
}

module.exports = {describe, formatReport};
