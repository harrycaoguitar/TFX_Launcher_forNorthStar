use crate::{catalog, launch, mods, process, settings};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

fn emit_progress(app: &AppHandle, channel: &str, name: &str, phase: &str, percent: u32) {
    let _ = app.emit(
        channel,
        json!({ "phase": phase, "percent": percent, "sourceName": name }),
    );
    let _ = app.emit(
        "skin-import-progress",
        json!({ "stage": "installing", "sourceName": name, "phase": phase, "percent": percent }),
    );
}

fn find_vanillaplus_in_profile(profile: &Path) -> bool {
    let direct = profile.join("mods").join("NP.VanillaPlus").join("mod.json");
    if direct.is_file() {
        return true;
    }
    if let Ok(pkgs) = fs::read_dir(profile.join("packages")) {
        for p in pkgs.flatten() {
            let name = p.file_name().to_string_lossy().to_ascii_lowercase();
            if name.contains("vanillaplus") {
                if p.path().join("mods").join("NP.VanillaPlus").join("mod.json").is_file()
                    || p.path().join("mod.json").is_file()
                    || p.path().join("manifest.json").is_file()
                {
                    return true;
                }
            }
        }
    }
    false
}

pub fn is_vanilla_plus_installed(root: &Path) -> bool {
    let profile = root.join("R2Titanfall");
    root.join("Titanfall2.exe").is_file()
        && profile.join("Northstar.dll").is_file()
        && root.join("bin").join("x64_retail").join("wsock32.dll").is_file()
        && find_vanillaplus_in_profile(&profile)
}

async fn download_bytes(url: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .user_agent("TFX/2.0.0 installer")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("网络下载失败：{e}"))?;
    if !resp.status().is_success() {
        return Err(format!("下载失败：HTTP {}", resp.status()));
    }
    resp.bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("读取下载内容失败：{e}"))
}

async fn fetch_github_zip_asset(repo: &str) -> Result<(String, String), String> {
    let api = format!("https://api.github.com/repos/{repo}/releases/latest");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("TFX/2.0.0 updater")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(&api)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("无法连接 GitHub Releases ({repo})：{e}"))?;
    if !resp.status().is_success() {
        return Err(format!("GitHub Releases 返回 HTTP {}", resp.status()));
    }
    let release: Value = resp.json().await.map_err(|e| e.to_string())?;
    let tag = release
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("latest")
        .trim_start_matches('v')
        .to_string();
    let assets = release
        .get("assets")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "未找到可下载的发布附件".to_string())?;
    let zip_url = assets
        .iter()
        .filter_map(|a| {
            let name = a.get("name").and_then(|v| v.as_str())?.to_ascii_lowercase();
            let url = a.get("browser_download_url").and_then(|v| v.as_str())?;
            if name.ends_with(".zip") && !name.contains("source") {
                Some(url.to_string())
            } else {
                None
            }
        })
        .next()
        .ok_or_else(|| format!("在 {repo} 最新发布中未找到 .zip 安装包"))?;
    Ok((tag, zip_url))
}

/// Installs Northstar CN or Global into `root`. Uses local bundle cache first;
/// if absent on a fresh PC, automatically downloads the latest official release ZIP from GitHub.
pub async fn install_northstar(app: &AppHandle, region: &str) -> Result<Value, String> {
    let reg = if region == "global" { "global" } else { "cn" };
    let conf = settings::load();
    let root_str = settings::resolve_game_root(&conf, reg);
    if root_str.is_empty() {
        return Err("请先选择 Titanfall 2 游戏目录".into());
    }
    let root = PathBuf::from(&root_str);
    if !settings::is_valid_game_dir(&root) {
        return Err("所选目录缺少 Titanfall2.exe 或 r2 目录".into());
    }
    let snap = process::snapshot();
    if process::has_game_running(&snap, Some(&root_str)) {
        return Err("请先退出运行中的 Titanfall 2 / 北极星进程后再安装".into());
    }

    let label = if reg == "global" { "Northstar Global" } else { "Northstar CN" };
    emit_progress(app, "northstar-client-progress", label, "checking", 10);

    // 1. Fast path: local cached bundle
    if launch::ensure_channel_installed(&root, reg).is_ok() {
        emit_progress(app, "northstar-client-progress", label, "complete", 100);
        let lib = mods::scan_library();
        let _ = app.emit("mods", &lib);
        return Ok(json!({ "ok": true, "installed": true, "region": reg, "source": "cache" }));
    }

    // 2. Online path: download latest release zip from GitHub
    let repo = if reg == "global" {
        "R2Northstar/Northstar"
    } else {
        "R2NorthstarCN/R2NorthstarCN_Launcher"
    };
    emit_progress(app, "northstar-client-progress", label, "staging", 25);
    let (ver, zip_url) = fetch_github_zip_asset(repo).await?;
    emit_progress(app, "northstar-client-progress", label, "staging", 45);
    let bytes = download_bytes(&zip_url).await?;
    emit_progress(app, "northstar-client-progress", label, "committing", 80);

    if reg == "cn" {
        let _ = fs::remove_file(root.join("R2Northstar").join("Northstar.dll"));
    } else {
        let _ = fs::remove_file(root.join("Northstar.dll"));
        let _ = fs::remove_file(root.join("launcher.dll"));
    }
    catalog::extract_zip_bytes(&bytes, &root)?;

    emit_progress(app, "northstar-client-progress", label, "complete", 100);
    let lib = mods::scan_library();
    let _ = app.emit("mods", &lib);
    Ok(json!({ "ok": true, "installed": true, "region": reg, "version": ver, "source": "github" }))
}

/// Automatically downloads & installs VanillaPlus from Thunderstore (`NachosChipeados/VanillaPlus`)
/// into `<gameRoot>/R2Titanfall`, and ensures the Global Northstar loader (`R2Titanfall/Northstar.dll`
/// + `bin/x64_retail/wsock32.dll`) is in place.
pub async fn install_vanilla_plus(app: &AppHandle) -> Result<Value, String> {
    let conf = settings::load();
    let root_str = settings::resolve_game_root(&conf, "cn");
    if root_str.is_empty() {
        return Err("请先在首页选择 Titanfall 2 游戏目录".into());
    }
    let root = PathBuf::from(&root_str);
    if !settings::is_valid_game_dir(&root) {
        return Err("所选目录缺少 Titanfall2.exe 或 r2 目录".into());
    }
    let snap = process::snapshot();
    if process::has_game_running(&snap, Some(&root_str)) {
        return Err("请先退出运行中的 Titanfall 2 后再安装官服 Mod 组件".into());
    }

    let profile = root.join("R2Titanfall");
    fs::create_dir_all(profile.join("packages")).map_err(|e| e.to_string())?;
    fs::create_dir_all(profile.join("mods")).map_err(|e| e.to_string())?;

    emit_progress(app, "vanilla-client-progress", "VanillaPlus", "checking", 10);

    // Step 1: Ensure Global Northstar loader (`R2Titanfall/Northstar.dll` + `bin/x64_retail/wsock32.dll`)
    let need_loader = !profile.join("Northstar.dll").is_file()
        || !root.join("bin").join("x64_retail").join("wsock32.dll").is_file();
    if need_loader {
        emit_progress(app, "vanilla-client-progress", "VanillaPlus · 框架", "staging", 25);
        let copied_local = launch::copy_global_loader_for_official(&root);
        if !copied_local {
            // Download Global Northstar release ZIP from GitHub and extract loader files into R2Titanfall
            let (_ver, zip_url) = fetch_github_zip_asset("R2Northstar/Northstar").await?;
            let bytes = download_bytes(&zip_url).await?;
            let tmp_dir = std::env::temp_dir().join(format!("tfx-global-loader-{}", std::process::id()));
            let _ = fs::remove_dir_all(&tmp_dir);
            catalog::extract_zip_bytes(&bytes, &tmp_dir)?;
            let src_ns_dll = tmp_dir.join("R2Northstar").join("Northstar.dll");
            let src_wsock = tmp_dir.join("bin").join("x64_retail").join("wsock32.dll");
            if src_ns_dll.is_file() {
                fs::copy(&src_ns_dll, profile.join("Northstar.dll")).map_err(|e| e.to_string())?;
            }
            if src_wsock.is_file() {
                let dst_bin = root.join("bin").join("x64_retail");
                fs::create_dir_all(&dst_bin).map_err(|e| e.to_string())?;
                fs::copy(&src_wsock, dst_bin.join("wsock32.dll")).map_err(|e| e.to_string())?;
            }
            let _ = fs::remove_dir_all(&tmp_dir);
        }
    }

    // Step 2: Fetch VanillaPlus latest release directly from Thunderstore
    emit_progress(app, "vanilla-client-progress", "VanillaPlus", "staging", 45);
    let catalog_val = catalog::fetch_thunderstore().await?;
    let packages = catalog_val
        .as_array()
        .ok_or_else(|| "雷霆商店返回格式异常".to_string())?;

    let vp_pkg = packages
        .iter()
        .find(|p| {
            let owner = p.get("owner").and_then(|v| v.as_str()).unwrap_or("");
            let name = p.get("name").and_then(|v| v.as_str()).unwrap_or("");
            name.eq_ignore_ascii_case("VanillaPlus")
                && (owner.eq_ignore_ascii_case("NachosChipeados") || !owner.is_empty())
        })
        .ok_or_else(|| "未在雷霆商店找到 VanillaPlus 模组包".to_string())?;

    let owner = vp_pkg.get("owner").and_then(|v| v.as_str()).unwrap_or("NachosChipeados");
    let latest = vp_pkg
        .get("versions")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .ok_or_else(|| "VanillaPlus 没有可用版本".to_string())?;
    let version = latest.get("version_number").and_then(|v| v.as_str()).unwrap_or("2.5.1");
    let download_url = latest
        .get("download_url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "VanillaPlus 缺少下载地址".to_string())?;

    emit_progress(app, "vanilla-client-progress", "VanillaPlus", "staging", 65);
    let zip_bytes = download_bytes(download_url).await?;

    emit_progress(app, "vanilla-client-progress", "VanillaPlus", "committing", 85);
    let pkg_dest = profile
        .join("packages")
        .join(format!("{owner}-VanillaPlus-{version}"));
    let _ = fs::remove_dir_all(&pkg_dest);
    catalog::extract_zip_bytes(&zip_bytes, &pkg_dest)?;

    // Ensure enabledmods.json enables VanillaPlus and disables Northstar core mods for official play.
    let enabled_path = profile.join("enabledmods.json");
    let mut doc = fs::read_to_string(&enabled_path)
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(s.trim_start_matches('\u{feff}')).ok())
        .filter(|v| v.is_object())
        .unwrap_or_else(|| json!({ "Version": 1 }));
    if let Some(obj) = doc.as_object_mut() {
        obj.insert("Version".into(), json!(1));
        obj.insert("VanillaPlus".into(), json!({ version: true }));
        for core in &["Northstar.Client", "Northstar.Custom", "Northstar.CustomServers"] {
            obj.insert((*core).into(), json!({}));
        }
    }
    if let Ok(body) = serde_json::to_string_pretty(&doc) {
        let tmp = enabled_path.with_extension("json.tmp");
        if fs::write(&tmp, body).is_ok() {
            let _ = fs::rename(&tmp, &enabled_path);
        }
    }

    emit_progress(app, "vanilla-client-progress", "VanillaPlus", "complete", 100);
    let lib = mods::scan_library();
    let _ = app.emit("mods", &lib);

    Ok(json!({
        "ok": true,
        "installed": true,
        "version": version,
        "profile": profile.to_string_lossy(),
        "status": launch::vanilla_client_status()
    }))
}
