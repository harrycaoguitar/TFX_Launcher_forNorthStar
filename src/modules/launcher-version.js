"use strict";
const {app} = require("electron");
const packageVersion = require("../../package.json").version;
function current() {
  try {
    const value = app?.getVersion?.();
    if (typeof value === "string" && value.trim()) return value.trim();
  } catch (_) {}
  return packageVersion;
}
module.exports = current;
