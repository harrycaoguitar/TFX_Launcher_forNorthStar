const win = require("../win");
const ipcMain = require("electron").ipcMain;

const requests = require("./requests");

const GITEE_HOST = "gitee.com";
const GITHUB_HOST = "api.github.com";

const NORTHSTAR_REPOSITORY = "R2NorthstarCN/R2NorthstarCN_Launcher";
const GLOBAL_REPOSITORY = "R2Northstar/Northstar";

let releases = {
	notes: {},
	latest: {}
}

// returns release notes to renderer
ipcMain.on("get-ns-notes", async () => {
	win().send("ns-notes", await releases.notes.northstar());
})

ipcMain.on("get-vp-notes", async () => {
	win().send("vp-notes", await releases.notes.viper());
})

// Gets release notes from managed Gitee repositories.
async function gitee_releases(repo) {
    let releases = false;

    // attempt to perform the request, while caching it
    try {
        let response = await requests.get(
			GITEE_HOST, `/api/v5/repos/${repo}/releases`,
            "release-notes-" + repo
        );
        releases = JSON.parse(response);
    } catch(err) {
        // request or parsing failed, return `false`
        return false;
    }

    // releases is somehow falsy or not an array, return `false`
    if (!releases || !Array.isArray(releases)) {
        return false;
    }

	return releases.map(release => ({
		name: release.name || release.tag_name,
		body: release.body || "",
		created_at: release.created_at,
		prerelease: Boolean(release.prerelease)
	})).sort((a, b) => {
		return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
	});
}

// Legacy IPC compatibility; launcher updates use the independent app updater.
releases.notes.viper = async () => {
	return [];
}

// returns release notes for Northstar
releases.notes.northstar = async () => {
	return await gitee_releases(NORTHSTAR_REPOSITORY);
}

// Each network has its own client release family; never compare CN and global
// version numbers or let a global check select a CN asset.
function parseVersion(value) {
	if (typeof value !== "string") return null;
	const match = value.trim().match(/^v?(\d+)\.(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/i);
	if (!match) return null;
	const parts = match.slice(1, 5).map(part => Number(part || 0));
	if (!parts.every(Number.isSafeInteger)) return null;
	return {parts, prerelease: match[5] || ""};
}
function compareVersions(left, right) {
	const a = parseVersion(left), b = parseVersion(right);
	if (!a || !b) return null;
	for (let index = 0; index < a.parts.length; index++) {
		if (a.parts[index] !== b.parts[index]) return a.parts[index] < b.parts[index] ? -1 : 1;
	}
	if (a.prerelease === b.prerelease) return 0;
	if (!a.prerelease) return 1;
	if (!b.prerelease) return -1;
	const av = a.prerelease.split("."), bv = b.prerelease.split(".");
	for (let index = 0; index < Math.max(av.length, bv.length); index++) {
		if (av[index] === bv[index]) continue;
		if (av[index] === undefined) return -1;
		if (bv[index] === undefined) return 1;
		const an = /^\d+$/.test(av[index]), bn = /^\d+$/.test(bv[index]);
		if (an && bn) return Number(av[index]) < Number(bv[index]) ? -1 : 1;
		if (an !== bn) return an ? -1 : 1;
		return av[index] < bv[index] ? -1 : 1;
	}
	return 0;
}
function isClientAssetURL(value, tag, assetName, region = "cn") {
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" || !(region === "global" ? ["github.com"] : ["github.com", GITEE_HOST]).includes(url.hostname)
			|| url.port || url.username || url.password || url.search || url.hash) return false;
		const parts = url.pathname.split("/").map(part => decodeURIComponent(part));
		if (parts.length !== 7 || parts.slice(1, 5).join("/") !== (region === "global" ? GLOBAL_REPOSITORY : NORTHSTAR_REPOSITORY) + "/releases/download") return false;
		if (parts[5] !== tag || !parts[6] || parts[6].includes("/") || parts[6].includes("\\")) return false;
		if (assetName && parts[6] !== assetName) return false;
		return /\.zip$/i.test(parts[6]) && !/(?:source|dedicated|dedi|server|linux|symbols|debug)/i.test(parts[6]);
	} catch (_) { return false; }
}
function selectClientRelease(data, source, region = "cn") {
	const parsed = parseVersion(data?.tag_name);
	if (!data || data.draft || data.prerelease || !parsed || parsed.prerelease) throw Object.assign(new Error("No stable client release"), {code: "release"});
	if (!Array.isArray(data.assets)) throw Object.assign(new Error("Release assets missing"), {code: "asset"});
	const host = source === "GitHub" ? "github.com" : GITEE_HOST;
	const asset = data.assets.find(candidate => typeof candidate?.name === "string"
		&& isClientAssetURL(candidate.browser_download_url, data.tag_name, candidate.name, region)
		&& new URL(candidate.browser_download_url).hostname === host);
	if (!asset) throw Object.assign(new Error("No compatible client ZIP in the selected release"), {code: "asset"});
	return {notes: data.body || "", version: data.tag_name, download_link: asset.browser_download_url, source, region, digest: /^sha256:[a-f0-9]{64}$/i.test(asset.digest || "") ? asset.digest.slice(7).toLowerCase() : null};
}
async function fetchLatest(source, force, region = "cn") {
	const github = source === "GitHub";
	const repository = region === "global" ? GLOBAL_REPOSITORY : NORTHSTAR_REPOSITORY;
	let body;
	try {
		body = await requests.get(github ? GITHUB_HOST : GITEE_HOST,
			github ? `/repos/${repository}/releases/latest` : `/api/v5/repos/${repository}/releases/latest`,
			force ? undefined : "latest-client-" + source + "-" + repository, false, 1);
	} catch (cause) { throw Object.assign(new Error(source + " request failed"), {code: "network", cause}); }
	let data;
	try { data = JSON.parse(body); } catch (cause) { throw Object.assign(new Error(source + " returned invalid JSON"), {code: "format", cause}); }
	return selectClientRelease(data, source, region);
}
releases.compareVersions = compareVersions;
releases.isClientAssetURL = isClientAssetURL;

// returns latest release for Viper
releases.latest.viper = async () => {
	return false;
}

// returns latest release for Northstar
releases.latest.northstar = async (options = {}) => {
	const region = options.region === "global" ? "global" : "cn";
	releases.latest.status = {source: "GitHub", error: ""};
	try {
		return await fetchLatest("GitHub", options.force === true, region);
	} catch (error) {
		// A malformed/untrusted release is a failed check. A different mirror
		// cannot turn that response into a trusted or apparently fresh success.
		if (error.code !== "network" || region === "global" || options.githubOnly === true) {
			releases.latest.status = {source: "GitHub", error: error.code || "format"};
			return false;
		}
		try {
			const result = await fetchLatest("Gitee", options.force === true);
			releases.latest.status = {source: "Gitee", error: "", fallback: true};
			return {...result, fallback: true};
		} catch (fallbackError) {
			releases.latest.status = {source: "GitHub / Gitee", error: fallbackError.code || "network"};
			return false;
		}
	}
}

module.exports = releases;
