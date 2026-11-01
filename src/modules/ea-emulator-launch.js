"use strict";

const path = require("path");

function resolve({enabled, gameVersion, ...plan}) {
	if (!enabled) return plan;
	if (gameVersion !== "northstar") return plan;
	const args = [...(plan.args || [])];
	if (!args.some(argument => /^-northstar(?:=|$)/i.test(argument))) args.push("-northstar");
	if (!args.some(argument => /^-noOriginStartup(?:=|$)/i.test(argument))) args.push("-noOriginStartup");
	return {...plan, executable:path.join(plan.root, "Titanfall2.exe"), args};
}

module.exports = {resolve};
