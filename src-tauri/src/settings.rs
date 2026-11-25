use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

/// Reads the exact same `%APPDATA%\fold.json` used by TFX Launcher 2.0 so users
/// seamlessly keep their game directories, theme, language, and preferences.
pub fn fold_json_path() -> Result<PathBuf, String> {
    let appdata = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "APPDATA environment variable not set".to_string())?;
    fs::create_dir_all(&appdata).map_err(|e| format!("Failed to create APPDATA dir: {e}"))?;
    Ok(appdata.join("fold.json"))
}

pub fn default_settings() -> Value {
    json!({
        "gamepath": "",
        "globalGamepath": "",
        "chinaSourceGamepath": "",
        "chinaInstallTarget": "",
        "prototypeTheme": "airwave",
        "theme": "aurora",
        "uiLanguage": "zh-CN",
        "modSort": "added",
        "exitAfterLaunch": false,
        "northstarRegion": "cn",
        "modProfileServer": "cn",
        "vanillaModsEnabled": false,
        "independentServerMods": false,
        "nsupdate": true,
        "originkill": false,
        "eaEmulator": false,
        "nsargs": "-multiple",
        "excludes": ["ns_startup_args.txt", "ns_startup_args_dedi.txt"]
    })
}

pub fn is_valid_game_dir(dir: &Path) -> bool {
    dir.join("Titanfall2.exe").is_file() && dir.join("r2").is_dir()
}

/// Fast, zero-PowerShell Steam / common path detector for Titanfall 2.
pub fn detect_titanfall2_path() -> Option<String> {
    let mut candidates: Vec<PathBuf> = vec![
        PathBuf::from(r"C:\Program Files (x86)\Steam\steamapps\common\Titanfall2"),
        PathBuf::from(r"C:\Program Files\EA Games\Titanfall2"),
        PathBuf::from(r"D:\Steam\steamapps\common\Titanfall2"),
        PathBuf::from(r"D:\SteamLibrary\steamapps\common\Titanfall2"),
        PathBuf::from(r"E:\SteamLibrary\steamapps\common\Titanfall2"),
        PathBuf::from(r"F:\SteamLibrary\steamapps\common\Titanfall2"),
        PathBuf::from(r"D:\Games\Titanfall2"),
    ];

    // Also parse Steam's libraryfolders.vdf if present.
    for vdf in &[
        r"C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf",
        r"D:\Steam\steamapps\libraryfolders.vdf",
    ] {
        if let Ok(content) = fs::read_to_string(vdf) {
            for line in content.lines() {
                let trimmed = line.trim();
                if let Some(rest) = trimmed.strip_prefix("\"path\"") {
                    let raw = rest.trim().trim_matches('"').replace("\\\\", "\\");
                    if !raw.is_empty() {
                        candidates.push(PathBuf::from(raw).join(r"steamapps\common\Titanfall2"));
                    }
                }
            }
        }
    }

    for dir in candidates {
        if is_valid_game_dir(&dir) {
            return Some(dir.to_string_lossy().into_owned());
        }
    }
    None
}

pub fn load() -> Value {
    let mut merged = default_settings();
    if let Ok(path) = fold_json_path() {
        if let Ok(raw) = fs::read_to_string(&path) {
            if let Ok(Value::Object(saved)) = serde_json::from_str::<Value>(&raw) {
                if let Some(base) = merged.as_object_mut() {
                    for (k, v) in saved {
                        base.insert(k, v);
                    }
                }
            }
        }
    }
    // Auto-fill gamepath if empty and Titanfall 2 is found on disk.
    let empty_game = merged
        .get("gamepath")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().is_empty())
        .unwrap_or(true);
    if empty_game {
        if let Some(found) = detect_titanfall2_path() {
            if let Some(obj) = merged.as_object_mut() {
                obj.insert("gamepath".to_string(), Value::String(found));
            }
        }
    }
    merged
}

pub fn save(patch: &Value) -> Result<Value, String> {
    let path = fold_json_path()?;
    let mut current = load();
    if let (Some(base), Some(obj)) = (current.as_object_mut(), patch.as_object()) {
        for (k, v) in obj {
            base.insert(k.clone(), v.clone());
        }
    }
    let body = serde_json::to_string(&current).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tfx3.tmp");
    fs::write(&tmp, &body).map_err(|e| format!("Failed writing temp settings: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("Failed committing fold.json: {e}"))?;
    Ok(current)
}

pub fn restore_defaults() -> Result<Value, String> {
    let current = load();
    let mut next = default_settings();
    // Preserve configured game paths when resetting UI preferences.
    if let (Some(dst), Some(src)) = (next.as_object_mut(), current.as_object()) {
        for key in &["gamepath", "globalGamepath", "chinaSourceGamepath", "chinaInstallTarget"] {
            if let Some(v) = src.get(*key) {
                dst.insert((*key).to_string(), v.clone());
            }
        }
    }
    save(&next)
}

pub fn resolve_game_root(conf: &Value, region: &str) -> String {
    if region == "global" {
        return conf
            .get("globalGamepath")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
    }
    conf.get("gamepath")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string()
}

pub fn resolve_profile_dir(root: &Path, conf: &Value, official: bool) -> PathBuf {
    if official {
        return root.join("R2Titanfall");
    }
    let nsargs = conf
        .get("nsargs")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let tokens: Vec<&str> = nsargs.split_whitespace().collect();
    for (i, tok) in tokens.iter().enumerate() {
        if let Some(val) = tok.strip_prefix("-profile=") {
            let clean = val.trim_matches('"');
            if !clean.is_empty() {
                return root.join(clean);
            }
        } else if *tok == "-profile" {
            if let Some(next) = tokens.get(i + 1) {
                let clean = next.trim_matches('"');
                if !clean.is_empty() {
                    return root.join(clean);
                }
            }
        }
    }
    root.join("R2Northstar")
}
