use crate::settings;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

fn icepick_mods_dir() -> Option<PathBuf> {
    let conf = settings::load();
    let custom = conf
        .get("icepickPath")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if !custom.is_empty() {
        let p = PathBuf::from(custom);
        if p.join("mods").is_dir() {
            return Some(p.join("mods"));
        }
        if p.is_dir() {
            return Some(p);
        }
    }
    let root = settings::resolve_game_root(&conf, "cn");
    if !root.is_empty() {
        let candidate = PathBuf::from(&root).join("Icepick").join("mods");
        if candidate.is_dir() {
            return Some(candidate);
        }
    }
    None
}

pub fn status() -> Value {
    let Some(mods_dir) = icepick_mods_dir() else {
        return json!({
            "ok": true,
            "status": { "modsDirectory": "", "mods": [] }
        });
    };

    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let raw_name = entry.file_name().to_string_lossy().into_owned();
            let disabled = raw_name.ends_with(".disabled");
            let clean_name = raw_name.trim_end_matches(".disabled").to_string();
            let manifest = fs::read_to_string(path.join("mod.json"))
                .ok()
                .and_then(|s| serde_json::from_str::<Value>(&s).ok());
            let name = manifest
                .as_ref()
                .and_then(|m| m.get("Name").or_else(|| m.get("name")).and_then(|v| v.as_str()))
                .unwrap_or(&clean_name)
                .to_string();
            let description = manifest
                .as_ref()
                .and_then(|m| m.get("Description").or_else(|| m.get("description")).and_then(|v| v.as_str()))
                .unwrap_or("")
                .to_string();
            let version = manifest
                .as_ref()
                .and_then(|m| m.get("Version").or_else(|| m.get("version")).and_then(|v| v.as_str()))
                .unwrap_or("1.0.0")
                .to_string();

            list.push(json!({
                "id": raw_name,
                "name": name,
                "authors": ["Icepick"],
                "description": description,
                "version": version,
                "enabled": !disabled,
                "core": false
            }));
        }
    }

    json!({
        "ok": true,
        "status": {
            "modsDirectory": mods_dir.to_string_lossy(),
            "mods": list
        }
    })
}

pub fn select_directory() -> Result<Value, String> {
    let picked = rfd::FileDialog::new()
        .set_title("选择 Icepick 模组目录")
        .pick_folder();
    let Some(dir) = picked else {
        return Ok(json!({ "ok": true, "cancelled": true }));
    };
    let path_str = dir.to_string_lossy().into_owned();
    settings::save(&json!({ "icepickPath": path_str }))?;
    Ok(status())
}

pub fn toggle(raw_id: &str) -> Result<Value, String> {
    let mods_dir = icepick_mods_dir().ok_or_else(|| "尚未配置 Icepick 目录".to_string())?;
    let current = mods_dir.join(raw_id);
    if !current.is_dir() {
        return Err("找不到指定的 Icepick 模组目录".into());
    }
    let next_name = if let Some(stripped) = raw_id.strip_suffix(".disabled") {
        stripped.to_string()
    } else {
        format!("{raw_id}.disabled")
    };
    fs::rename(&current, mods_dir.join(next_name)).map_err(|e| format!("切换 Icepick 模组失败：{e}"))?;
    Ok(status())
}

pub fn remove(raw_id: &str) -> Result<Value, String> {
    let mods_dir = icepick_mods_dir().ok_or_else(|| "尚未配置 Icepick 目录".to_string())?;
    if raw_id.contains("..") || raw_id.contains('/') || raw_id.contains('\\') {
        return Err("非法的模组路径".into());
    }
    let target = mods_dir.join(raw_id);
    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|e| format!("卸载 Icepick 模组失败：{e}"))?;
    }
    Ok(status())
}
