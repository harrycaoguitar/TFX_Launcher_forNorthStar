use crate::settings;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

fn resolve_tf1_root() -> Option<PathBuf> {
    let conf = settings::load();
    let saved = conf
        .get("r1deltaPath")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if !saved.is_empty() {
        let p = PathBuf::from(saved);
        if p.is_dir() {
            return Some(p);
        }
    }
    for cand in &[
        r"D:\Games\Titanfall",
        r"C:\Program Files (x86)\Steam\steamapps\common\Titanfall",
        r"D:\SteamLibrary\steamapps\common\Titanfall",
    ] {
        let p = PathBuf::from(cand);
        if p.join("Titanfall.exe").is_file() {
            return Some(p);
        }
    }
    None
}

pub fn status() -> Value {
    let root = resolve_tf1_root();
    let root_str = root
        .as_ref()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    let game_installed = root.as_ref().map(|p| p.join("Titanfall.exe").is_file()).unwrap_or(false);
    let core_path = root.as_ref().map(|p| p.join("r1delta"));
    let installed = core_path.as_ref().map(|p| p.is_dir()).unwrap_or(false);
    json!({
        "ok": true,
        "installed": installed,
        "gameInstalled": game_installed,
        "version": if installed { "1.0.0" } else { "" },
        "gamepath": root_str,
        "gamePath": root_str,
        "root": root_str,
        "corepath": core_path.map(|p| p.to_string_lossy().into_owned()).unwrap_or_default()
    })
}

pub fn select_directory() -> Result<Value, String> {
    let picked = rfd::FileDialog::new()
        .set_title("选择 Titanfall 1 游戏目录")
        .pick_folder();
    let Some(dir) = picked else {
        return Ok(json!({ "ok": true, "cancelled": true }));
    };
    settings::save(&json!({ "r1deltaPath": dir.to_string_lossy() }))?;
    Ok(status())
}

pub fn list_addons() -> Value {
    let Some(root) = resolve_tf1_root() else {
        return json!({ "ok": true, "addons": [], "gameInstalled": false, "addonsPath": "" });
    };
    let addons_dir = root.join("r1delta").join("addons");
    let mut addons = Vec::new();
    if let Ok(entries) = fs::read_dir(&addons_dir) {
        for e in entries.flatten() {
            let path = e.path();
            let raw = e.file_name().to_string_lossy().into_owned();
            let disabled = raw.ends_with(".disabled");
            let clean = raw.trim_end_matches(".disabled").to_string();
            let is_dir = path.is_dir();
            let bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            addons.push(json!({
                "id": raw,
                "name": clean,
                "title": clean,
                "type": if is_dir { "folder" } else { "vpk" },
                "kind": if is_dir { "folder" } else { "vpk" },
                "author": "R1Delta",
                "description": "Titanfall 1 Addon",
                "version": "1.0.0",
                "valid": true,
                "enabled": !disabled,
                "bytes": bytes
            }));
        }
    }
    json!({
        "ok": true,
        "addons": addons,
        "gameInstalled": root.join("Titanfall.exe").is_file(),
        "addonsPath": addons_dir.to_string_lossy()
    })
}

pub fn toggle_addon(id: &str) -> Result<Value, String> {
    let root = resolve_tf1_root().ok_or_else(|| "尚未配置泰坦陨落 1 目录".to_string())?;
    let addons_dir = root.join("r1delta").join("addons");
    let current = addons_dir.join(id);
    if !current.exists() {
        return Err("找不到该 Addon".into());
    }
    let next = if let Some(s) = id.strip_suffix(".disabled") {
        s.to_string()
    } else {
        format!("{id}.disabled")
    };
    fs::rename(&current, addons_dir.join(next)).map_err(|e| e.to_string())?;
    Ok(json!({ "ok": true }))
}

pub fn remove_addon(id: &str) -> Result<Value, String> {
    let root = resolve_tf1_root().ok_or_else(|| "尚未配置泰坦陨落 1 目录".to_string())?;
    if id.contains("..") || id.contains('/') || id.contains('\\') {
        return Err("非法路径".into());
    }
    let target = root.join("r1delta").join("addons").join(id);
    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
    } else if target.is_file() {
        fs::remove_file(&target).map_err(|e| e.to_string())?;
    }
    Ok(json!({ "ok": true }))
}

pub fn launch(steam: bool) -> Result<Value, String> {
    if steam {
        Command::new("cmd.exe")
            .args(["/C", "start", "", "steam://rungameid/1454890"])
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(json!({ "ok": true }));
    }
    let root = resolve_tf1_root().ok_or_else(|| "尚未选择泰坦陨落 1 目录".to_string())?;
    let exe = root.join("r1delta.exe");
    let target = if exe.is_file() { exe } else { root.join("Titanfall.exe") };
    if !target.is_file() {
        return Err("未找到 r1delta.exe 或 Titanfall.exe".into());
    }
    Command::new(&target)
        .current_dir(&root)
        .spawn()
        .map_err(|e| format!("启动失败：{e}"))?;
    Ok(json!({ "ok": true }))
}
