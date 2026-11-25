use crate::{process, settings};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};
use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetClassNameW, GetWindowThreadProcessId, ShowWindow, SW_HIDE,
};

const CN_MASTER: &str = "https://nscn.wolf109909.top";
const GLOBAL_MASTER: &str = "https://northstar.tf";
const CORE_MOD_DIRS: &[&str] = &[
    "R2Northstar/mods/Northstar.Client",
    "R2Northstar/mods/Northstar.Custom",
    "R2Northstar/mods/Northstar.CustomServers",
];

fn data_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    let d_root = PathBuf::from(r"D:\TFX-Launcher-Data\northstar-clients");
    if d_root.is_dir() {
        roots.push(d_root);
    }
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        let local_base = PathBuf::from(local);
        for name in &["TFX Launcher", "tfx-launcher", "TFX-Launcher"] {
            let p = local_base.join(name).join("northstar-clients");
            if p.is_dir() {
                roots.push(p);
            }
        }
    }
    roots
}

/// Detects whether `root` currently has `cn` or `global` Northstar binaries installed on disk.
pub fn detect_installed_channel(root: &Path) -> Option<(&'static str, String)> {
    let has_root_ns = root.join("Northstar.dll").is_file();
    let has_root_launcher = root.join("launcher.dll").is_file();
    let has_profile_ns = root.join("R2Northstar").join("Northstar.dll").is_file();
    let mod_ver = fs::read_to_string(
        root.join("R2Northstar")
            .join("mods")
            .join("Northstar.Client")
            .join("mod.json"),
    )
    .ok()
    .and_then(|s| serde_json::from_str::<Value>(&s).ok())
    .and_then(|v| v.get("Version").and_then(|x| x.as_str()).map(|x| x.to_string()))
    .unwrap_or_default();

    if has_root_ns && has_root_launcher && !has_profile_ns {
        Some(("cn", if mod_ver.is_empty() { "1.17.7".into() } else { mod_ver }))
    } else if has_profile_ns && !has_root_ns {
        Some(("global", if mod_ver.is_empty() { "1.31.13".into() } else { mod_ver }))
    } else if !mod_ver.is_empty() {
        let ch = if mod_ver.starts_with("1.17") || mod_ver.starts_with("1.18") || mod_ver.starts_with("1.19") {
            "cn"
        } else {
            "global"
        };
        Some((ch, mod_ver))
    } else {
        None
    }
}

/// Finds a valid cached Northstar distribution bundle (`manifest.json` + `payload/`) for `region`.
fn find_bundle_for_channel(region: &str) -> Option<(PathBuf, Value)> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    for data_root in data_roots() {
        // 1. Prefer user's channel-cache snapshots under transactions/*/*/channel-cache/<region>
        if let Ok(tx_roots) = fs::read_dir(data_root.join("transactions")) {
            for r in tx_roots.flatten() {
                if let Ok(profiles) = fs::read_dir(r.path()) {
                    for p in profiles.flatten() {
                        let c = p.path().join("channel-cache").join(region);
                        if c.join("manifest.json").is_file() && c.join("payload").is_dir() {
                            candidates.push(c);
                        }
                    }
                }
            }
        }
        // 2. Cached updates pointer bundles/updates/<region>.json
        let upd_ptr = data_root.join("bundles").join("updates").join(format!("{region}.json"));
        if let Ok(raw) = fs::read_to_string(&upd_ptr) {
            if let Ok(v) = serde_json::from_str::<Value>(&raw) {
                if let Some(dir) = v.get("directory").and_then(|d| d.as_str()) {
                    let c = data_root.join("bundles").join("updates").join(dir);
                    if c.join("manifest.json").is_file() && c.join("payload").is_dir() {
                        candidates.push(c);
                    }
                }
            }
        }
        // 3. Bundled distributions under bundles/bundled/<region>-*
        if let Ok(entries) = fs::read_dir(data_root.join("bundles").join("bundled")) {
            let prefix = format!("{region}-");
            for e in entries.flatten() {
                let name = e.file_name().to_string_lossy().into_owned();
                if name.starts_with(&prefix) && e.path().join("manifest.json").is_file() && e.path().join("payload").is_dir() {
                    candidates.push(e.path());
                }
            }
        }
    }

    for dir in candidates {
        if let Ok(raw) = fs::read_to_string(dir.join("manifest.json")) {
            if let Ok(manifest) = serde_json::from_str::<Value>(&raw) {
                if manifest.get("channel").and_then(|v| v.as_str()) == Some(region)
                    && manifest.get("files").and_then(|v| v.as_array()).map(|a| !a.is_empty()).unwrap_or(false)
                {
                    return Some((dir, manifest));
                }
            }
        }
    }
    None
}

/// Flattens a versioned `enabledmods.json` (`{"Version":1,"Mod":{"1.0":true}}`) to flat `{"Mod":true}`
/// when switching to CN 1.17.7, preserving all user enable/disable choices.
fn flatten_enabled_mods_for_cn(profile: &Path) {
    let path = profile.join("enabledmods.json");
    let Ok(raw) = fs::read_to_string(&path) else { return; };
    let Ok(Value::Object(obj)) = serde_json::from_str::<Value>(raw.trim_start_matches('\u{feff}')) else { return; };
    if !obj.contains_key("Version") {
        return;
    }
    let mut flat = serde_json::Map::new();
    for (k, v) in obj {
        if k == "Version" {
            continue;
        }
        match v {
            Value::Bool(b) => {
                flat.insert(k, Value::Bool(b));
            }
            Value::Object(ver_map) => {
                let on = ver_map.values().any(|x| x.as_bool() == Some(true));
                flat.insert(k, Value::Bool(on));
            }
            _ => {}
        }
    }
    if let Ok(body) = serde_json::to_string_pretty(&Value::Object(flat)) {
        let tmp = path.with_extension("json.tmp");
        if fs::write(&tmp, body).is_ok() {
            let _ = fs::rename(&tmp, &path);
        }
    }
}

/// Switches the installed Northstar core files in `root` to `target_region` (`cn` or `global`)
/// using the validated local bundle cache. Touches ONLY official Northstar loader & core mod files;
/// never modifies user Mods or DDS/VTF skins.
pub fn ensure_channel_installed(root: &Path, target_region: &str) -> Result<bool, String> {
    let reg = if target_region == "global" { "global" } else { "cn" };
    if let Some((active, _)) = detect_installed_channel(root) {
        if active == reg {
            return Ok(false);
        }
    }
    let Some((bundle_dir, manifest)) = find_bundle_for_channel(reg) else {
        return Err(format!(
            "当前游戏目录安装的是另一区服的北极星内核，且未在本地缓存中找到 {reg} 发行版文件。请先用 2.0 切换一次或安装对应区服客户端。"
        ));
    };

    let payload_dir = bundle_dir.join("payload");
    let files = manifest
        .get("files")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "北极星客户端清单缺少文件列表".to_string())?;

    // 1. Remove conflicting loader binaries from the opposite channel only.
    if reg == "cn" {
        let _ = fs::remove_file(root.join("R2Northstar").join("Northstar.dll"));
    } else {
        let _ = fs::remove_file(root.join("Northstar.dll"));
        let _ = fs::remove_file(root.join("launcher.dll"));
    }

    // 2. Replace ONLY the 3 official Northstar core mod folders (never touch user mods!).
    for core_rel in CORE_MOD_DIRS {
        let target_dir = root.join(core_rel);
        if target_dir.is_dir() {
            let _ = fs::remove_dir_all(&target_dir);
        }
    }

    // 3. Copy all official distribution files from payload -> root.
    for entry in files {
        let Some(rel) = entry.get("path").and_then(|v| v.as_str()) else {
            continue;
        };
        if rel.contains("..") || rel.starts_with('/') || rel.starts_with('\\') {
            continue;
        }
        let src = payload_dir.join(rel);
        let dst = root.join(rel);
        if !src.is_file() {
            return Err(format!("北极星缓存文件缺失：{rel}"));
        }
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败 {rel}：{e}"))?;
        }
        fs::copy(&src, &dst).map_err(|e| format!("写入北极星文件失败 {rel}：{e}"))?;
    }

    if reg == "cn" {
        flatten_enabled_mods_for_cn(&root.join("R2Northstar"));
    }

    Ok(true)
}

pub fn northstar_client_status(region: &str) -> Value {
    let conf = settings::load();
    let reg = if region == "global" { "global" } else { "cn" };
    let root = settings::resolve_game_root(&conf, reg);
    let root_path = PathBuf::from(&root);
    let detected = if !root.is_empty() && root_path.is_dir() {
        detect_installed_channel(&root_path)
    } else {
        None
    };
    let has_bundle = find_bundle_for_channel(reg);
    let active = detected.as_ref().map(|(c, _)| *c == reg).unwrap_or(false);
    let installed = !root.is_empty()
        && root_path.join("Titanfall2.exe").is_file()
        && (active || has_bundle.is_some() || root_path.join("NorthstarLauncher.exe").is_file());
    let version = if active {
        detected.as_ref().map(|(_, v)| v.clone()).unwrap_or_default()
    } else if let Some((_, m)) = has_bundle {
        m.get("version").and_then(|v| v.as_str()).unwrap_or("").to_string()
    } else if reg == "global" {
        "1.31.13".to_string()
    } else {
        "1.17.7".to_string()
    };

    json!({
        "ok": true,
        "installed": installed,
        "active": active,
        "version": if installed { &version } else { "" },
        "installedVersion": if installed { &version } else { "" },
        "selectedVersion": version,
        "region": reg,
        "root": root
    })
}

pub fn copy_global_loader_for_official(root: &Path) -> bool {
    let profile = root.join("R2Titanfall");
    let dst_bin = root.join("bin").join("x64_retail");
    let _ = fs::create_dir_all(&profile);
    let _ = fs::create_dir_all(&dst_bin);

    // 1. Try cached global bundle first
    if let Some((bundle_dir, _)) = find_bundle_for_channel("global") {
        let payload = bundle_dir.join("payload");
        let src_ns = payload.join("R2Northstar").join("Northstar.dll");
        let src_wsock = payload.join("bin").join("x64_retail").join("wsock32.dll");
        if src_ns.is_file() && src_wsock.is_file() {
            if fs::copy(&src_ns, profile.join("Northstar.dll")).is_ok()
                && fs::copy(&src_wsock, dst_bin.join("wsock32.dll")).is_ok()
            {
                return true;
            }
        }
    }
    // 2. Fallback: already-installed Global R2Northstar/Northstar.dll in game root
    let live_ns = root.join("R2Northstar").join("Northstar.dll");
    let live_wsock = dst_bin.join("wsock32.dll");
    if live_ns.is_file() && live_wsock.is_file() {
        return fs::copy(&live_ns, profile.join("Northstar.dll")).is_ok();
    }
    false
}

pub fn vanilla_client_status() -> Value {
    let conf = settings::load();
    let root = settings::resolve_game_root(&conf, "cn");
    let root_path = PathBuf::from(&root);
    let installed = !root.is_empty() && crate::installer::is_vanilla_plus_installed(&root_path);
    json!({
        "ok": true,
        "installed": installed,
        "verified": installed,
        "version": if installed { "2.5.1" } else { "" },
        "root": root
    })
}

pub fn dds_protection_status() -> Value {
    let conf = settings::load();
    let root = settings::resolve_game_root(&conf, "cn");
    let ready = !root.is_empty() && settings::is_valid_game_dir(&PathBuf::from(&root));
    json!({
        "ok": true,
        "game": { "ready": ready, "path": root },
        "protection": { "enabled": true, "state": if ready { "ready" } else { "missing" }, "originalsReady": ready }
    })
}

/// Exact 1:1 port of 2.0 `northstar-region.js` & `official-launch.js` launch arguments.
pub fn build_launch_args(raw_nsargs: &str, game_version: &str, region: &str, vanilla_mods: bool) -> Vec<String> {
    let tokens: Vec<String> = raw_nsargs.split_whitespace().map(|s| s.to_string()).collect();
    let mut out = Vec::new();

    if game_version == "northstar" {
        let mut i = 0;
        while i < tokens.len() {
            let lower = tokens[i].to_ascii_lowercase();
            if lower.starts_with("+ns_masterserver_hostname=") {
                i += 1;
                continue;
            }
            if lower == "+ns_masterserver_hostname" {
                i += 1;
                if i < tokens.len() && !tokens[i].starts_with('+') && !tokens[i].starts_with('-') {
                    i += 1;
                }
                continue;
            }
            if lower == "-vanilla"
                || lower.starts_with("-vanilla=")
                || lower == "-norestrictservercommands"
                || lower.starts_with("-norestrictservercommands=")
            {
                i += 1;
                continue;
            }
            out.push(tokens[i].clone());
            i += 1;
        }
        let host = if region == "global" { GLOBAL_MASTER } else { CN_MASTER };
        out.push("+ns_masterserver_hostname".to_string());
        out.push(host.to_string());
        if !out.iter().any(|a| a.eq_ignore_ascii_case("-noallocconsole")) {
            out.push("-noallocconsole".to_string());
        }
        return out;
    }

    // Vanilla (clean or with VanillaPlus mods)
    let mut i = 0;
    while i < tokens.len() {
        let lower = tokens[i].to_ascii_lowercase();
        let is_flag = matches!(
            lower.as_str(),
            "-northstar" | "-vanilla" | "-norestrictservercommands" | "-noallocconsole"
        ) || lower.starts_with("-northstar=")
            || lower.starts_with("-vanilla=")
            || lower.starts_with("-norestrictservercommands=")
            || lower.starts_with("-noallocconsole=");
        if is_flag {
            i += 1;
            continue;
        }
        let is_kv = lower == "-profile"
            || lower.starts_with("-profile=")
            || lower == "-northstardll"
            || lower.starts_with("-northstardll=")
            || lower.starts_with("+ns_");
        if is_kv {
            let has_eq = lower.contains('=');
            i += 1;
            if !has_eq && i < tokens.len() && !tokens[i].starts_with('+') && !tokens[i].starts_with('-') {
                i += 1;
            }
            continue;
        }
        out.push(tokens[i].clone());
        i += 1;
    }

    if vanilla_mods {
        out.push("-northstar".to_string());
        out.push("-vanilla".to_string());
        out.push("-profile=R2Titanfall".to_string());
        out.push("-noallocconsole".to_string());
    }
    out
}

unsafe extern "system" fn hide_console_enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let target_pid = lparam as u32;
    let mut pid: u32 = 0;
    GetWindowThreadProcessId(hwnd, &mut pid);
    if pid == target_pid {
        let mut class_buf = [0u16; 64];
        let len = GetClassNameW(hwnd, class_buf.as_mut_ptr(), class_buf.len() as i32);
        if len > 0 {
            let class_name = String::from_utf16_lossy(&class_buf[..len as usize]);
            if class_name == "ConsoleWindowClass" {
                ShowWindow(hwnd, SW_HIDE);
            }
        }
    }
    1
}

/// Hides ONLY `ConsoleWindowClass` windows owned by `pid` (never touches the Titanfall 2 game window).
fn spawn_console_hider(pid: u32) {
    std::thread::spawn(move || {
        for _ in 0..35 {
            unsafe {
                EnumWindows(Some(hide_console_enum_proc), pid as LPARAM);
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    });
}

pub fn launch_game(app: &AppHandle, game_version: &str) -> Result<Value, String> {
    let gv = if game_version == "vanilla" { "vanilla" } else { "northstar" };
    let conf = settings::load();
    let region = conf
        .get("northstarRegion")
        .and_then(|v| v.as_str())
        .unwrap_or("cn");
    let vanilla_mods = gv == "vanilla"
        && conf
            .get("vanillaModsEnabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

    let root = settings::resolve_game_root(&conf, if gv == "vanilla" { "cn" } else { region });
    if root.is_empty() {
        let msg = if gv == "northstar" && region == "global" {
            "请先设置国际服独立游戏目录。"
        } else {
            "尚未选择游戏目录，请先在首页选择 Titanfall 2 目录。"
        };
        let _ = app.emit("launch-status", json!({ "state": "failed", "gameVersion": gv, "error": msg }));
        return Err(msg.into());
    }
    let root_path = PathBuf::from(&root);
    if !settings::is_valid_game_dir(&root_path) {
        let msg = "所选目录缺少 Titanfall2.exe 或 r2 资源目录。";
        let _ = app.emit("launch-status", json!({ "state": "failed", "gameVersion": gv, "error": msg }));
        return Err(msg.into());
    }

    let _ = app.emit("launch-status", json!({ "state": "starting", "gameVersion": gv }));

    // Native <2ms Win32 process guard — zero PowerShell!
    let snap = process::snapshot();
    if process::has_game_running(&snap, Some(&root)) {
        let msg = "泰坦陨落 2 或北极星客户端已在运行，请先退出后再启动。";
        let _ = app.emit("launch-status", json!({ "state": "failed", "gameVersion": gv, "error": msg }));
        return Err(msg.into());
    }

    // Automatically swap the installed Northstar distribution (CN 1.17.7 <-> Global 1.31.13)
    // when both share the same Titanfall 2 directory.
    if gv == "northstar" {
        if let Err(err) = ensure_channel_installed(&root_path, region) {
            let _ = app.emit("launch-status", json!({ "state": "failed", "gameVersion": gv, "error": &err }));
            return Err(err);
        }
    }

    let exe_name = if gv == "northstar" { "NorthstarLauncher.exe" } else { "Titanfall2.exe" };
    let exe_path = root_path.join(exe_name);
    if !exe_path.is_file() {
        let msg = format!("缺少 {exe_name}，请检查所选游戏目录或重新安装北极星客户端。");
        let _ = app.emit("launch-status", json!({ "state": "failed", "gameVersion": gv, "error": msg }));
        return Err(msg);
    }

    let raw_nsargs = conf.get("nsargs").and_then(|v| v.as_str()).unwrap_or("");
    let args = build_launch_args(raw_nsargs, gv, region, vanilla_mods);

    // Sync `ns_masterserver_hostname` inside `autoexec_ns_client.cfg` if present.
    if gv == "northstar" {
        let profile = settings::resolve_profile_dir(&root_path, &conf, false);
        let cfg_path = profile
            .join("mods")
            .join("Northstar.Client")
            .join("mod")
            .join("cfg")
            .join("autoexec_ns_client.cfg");
        let target_host = if region == "global" { GLOBAL_MASTER } else { CN_MASTER };
        if let Ok(body) = fs::read_to_string(&cfg_path) {
            let mut found = false;
            let eol = if body.contains("\r\n") { "\r\n" } else { "\n" };
            let mut lines: Vec<String> = body
                .lines()
                .map(|line| {
                    let trimmed = line.trim_start();
                    if trimmed.to_ascii_lowercase().starts_with("ns_masterserver_hostname") {
                        found = true;
                        format!("ns_masterserver_hostname \"{target_host}\"")
                    } else {
                        line.to_string()
                    }
                })
                .collect();
            if !found {
                lines.push(format!("ns_masterserver_hostname \"{target_host}\""));
            }
            let updated = lines.join(eol) + eol;
            if updated != body {
                let tmp = cfg_path.with_extension("cfg.tmp");
                if fs::write(&tmp, &updated).is_ok() {
                    let _ = fs::rename(&tmp, &cfg_path);
                }
            }
        }
    }

    let _ = app.emit("launch-status", json!({ "state": "starting", "gameVersion": gv, "phase": "wait-game" }));

    let child = Command::new(&exe_path)
        .args(&args)
        .current_dir(&root_path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            let msg = format!("拉起 {exe_name} 失败：{e}");
            let _ = app.emit("launch-status", json!({ "state": "failed", "gameVersion": gv, "error": &msg }));
            msg
        })?;

    let pid = child.id();
    if gv == "northstar" || vanilla_mods {
        spawn_console_hider(pid);
    }

    let _ = app.emit("launch-status", json!({ "state": "starting", "gameVersion": gv, "phase": "spawned", "pid": pid }));

    let app_clone = app.clone();
    let gv_owned = gv.to_string();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(1200)).await;
        let _ = app_clone.emit("launch-status", json!({ "state": "confirmed", "gameVersion": gv_owned, "pid": pid }));
    });

    Ok(json!({ "ok": true, "pid": pid, "executable": exe_path.to_string_lossy(), "args": args }))
}
