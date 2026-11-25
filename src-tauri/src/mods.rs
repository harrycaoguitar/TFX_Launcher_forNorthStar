use crate::settings;
use serde::Serialize;
use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

const CORE_MODS: &[&str] = &[
    "Northstar.Client",
    "Northstar.Custom",
    "Northstar.CustomServers",
    "VanillaPlus",
];

#[derive(Debug, Clone, Serialize)]
pub struct ModItem {
    pub name: String,
    pub manifest_name: Option<String>,
    pub author: String,
    pub description: String,
    pub version: String,
    #[serde(rename = "stateVersion")]
    pub state_version: String,
    pub required: bool,
    pub disabled: bool,
    #[serde(rename = "stateControl")]
    pub state_control: bool,
    pub folder_name: String,
    pub folder_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModLibrary {
    pub all: Vec<ModItem>,
    pub enabled: Vec<ModItem>,
    pub disabled: Vec<ModItem>,
}

fn active_profile_dir() -> Option<PathBuf> {
    let conf = settings::load();
    let server = conf
        .get("modProfileServer")
        .and_then(|v| v.as_str())
        .unwrap_or("cn");
    let region = if server == "global" { "global" } else { "cn" };
    let root_str = settings::resolve_game_root(&conf, region);
    if root_str.is_empty() {
        return None;
    }
    let root = PathBuf::from(&root_str);
    if !root.exists() {
        return None;
    }
    let profile = settings::resolve_profile_dir(&root, &conf, server == "official");
    if profile.is_dir() {
        Some(profile)
    } else {
        None
    }
}

fn read_json_lenient(path: &Path) -> Option<Value> {
    let raw = fs::read_to_string(path).ok()?;
    let stripped = raw.trim_start_matches('\u{feff}');
    serde_json::from_str(stripped).ok()
}

fn is_enabled_in_doc(doc: &Value, name: &str, version: &str) -> bool {
    let obj = match doc.as_object() {
        Some(o) => o,
        None => return true,
    };
    let versioned = obj.get("Version").and_then(|v| v.as_u64()).is_some();
    match obj.get(name) {
        Some(Value::Bool(b)) => *b,
        Some(Value::Object(versions)) if versioned => {
            if let Some(Value::Bool(b)) = versions.get(version) {
                *b
            } else {
                versions.values().next().and_then(|v| v.as_bool()).unwrap_or(true)
            }
        }
        _ => true,
    }
}

fn scan_mods_in_dir(dir: &Path, enabled_doc: &Value, out: &mut Vec<ModItem>, pkg_author: Option<&str>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let mod_json = match read_json_lenient(&path.join("mod.json")) {
            Some(v) => v,
            None => continue,
        };
        let name = mod_json
            .get("Name")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .trim()
            .to_string();
        let version = mod_json
            .get("Version")
            .and_then(|v| v.as_str())
            .unwrap_or("1.0.0")
            .trim()
            .to_string();
        let description = mod_json
            .get("Description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        let author = pkg_author
            .map(|s| s.to_string())
            .or_else(|| {
                fs::read_to_string(path.join("thunderstore_author.txt"))
                    .ok()
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
            })
            .or_else(|| {
                mod_json
                    .get("Author")
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
            })
            .unwrap_or_default();
        let manifest_name = read_json_lenient(&path.join("manifest.json"))
            .and_then(|m| m.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()));
        let required = CORE_MODS.contains(&name.as_str())
            || mod_json
                .get("RequiredOnClient")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
                && CORE_MODS.iter().any(|c| name.eq_ignore_ascii_case(c));
        let disabled = !required && !is_enabled_in_doc(enabled_doc, &name, &version);
        let folder_name = path
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default();

        out.push(ModItem {
            name,
            manifest_name,
            author,
            description,
            version: version.clone(),
            state_version: version,
            required,
            disabled,
            state_control: !required,
            folder_name,
            folder_path: path.to_string_lossy().into_owned(),
        });
    }
}

pub fn scan_library() -> ModLibrary {
    let profile = match active_profile_dir() {
        Some(p) => p,
        None => {
            return ModLibrary {
                all: vec![],
                enabled: vec![],
                disabled: vec![],
            };
        }
    };

    let enabled_doc = read_json_lenient(&profile.join("enabledmods.json")).unwrap_or_else(|| json!({}));
    let mut all = Vec::new();
    scan_mods_in_dir(&profile.join("mods"), &enabled_doc, &mut all, None);

    if let Ok(pkgs) = fs::read_dir(profile.join("packages")) {
        for pkg in pkgs.flatten() {
            let pkg_path = pkg.path();
            if !pkg_path.is_dir() {
                continue;
            }
            let pkg_name = pkg.file_name().to_string_lossy().into_owned();
            let author = pkg_name.split('-').next().filter(|s| !s.is_empty());
            let mods_sub = pkg_path.join("mods");
            if mods_sub.is_dir() {
                scan_mods_in_dir(&mods_sub, &enabled_doc, &mut all, author);
            }
        }
    }

    let enabled = all.iter().filter(|m| !m.disabled).cloned().collect();
    let disabled = all.iter().filter(|m| m.disabled).cloned().collect();
    ModLibrary {
        all,
        enabled,
        disabled,
    }
}

pub fn set_mod_state(selections: &Value) -> Result<ModLibrary, String> {
    let profile = active_profile_dir().ok_or_else(|| "未找到 Northstar 配置目录".to_string())?;
    let state_path = profile.join("enabledmods.json");
    let mut doc = read_json_lenient(&state_path).unwrap_or_else(|| json!({}));
    if !doc.is_object() {
        doc = json!({});
    }
    let versioned = doc.get("Version").and_then(|v| v.as_u64()).is_some();

    let rows: Vec<&Value> = if let Some(arr) = selections.get("selections").and_then(|v| v.as_array()) {
        arr.iter().collect()
    } else if selections.get("names").is_some() {
        vec![selections]
    } else {
        vec![]
    };

    let current_lib = scan_library();
    if let Some(obj) = doc.as_object_mut() {
        for row in rows {
            let enabled = row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
            if let Some(names) = row.get("names").and_then(|v| v.as_array()) {
                for n in names {
                    if let Some(name) = n.as_str() {
                        if CORE_MODS.contains(&name) && !enabled {
                            continue;
                        }
                        if versioned {
                            let ver = current_lib
                                .all
                                .iter()
                                .find(|m| m.name == name)
                                .map(|m| m.state_version.clone())
                                .unwrap_or_else(|| "1.0.0".to_string());
                            let entry = obj
                                .entry(name.to_string())
                                .or_insert_with(|| Value::Object(Map::new()));
                            if let Some(vmap) = entry.as_object_mut() {
                                vmap.insert(ver, Value::Bool(enabled));
                            } else {
                                *entry = json!({ ver: enabled });
                            }
                        } else {
                            obj.insert(name.to_string(), Value::Bool(enabled));
                        }
                    }
                }
            }
        }
    }

    let body = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?;
    let tmp = state_path.with_extension("json.tmp");
    fs::write(&tmp, &body).map_err(|e| format!("写入 enabledmods.json 失败: {e}"))?;
    fs::rename(&tmp, &state_path).map_err(|e| format!("提交 enabledmods.json 失败: {e}"))?;
    Ok(scan_library())
}

pub fn remove_mod(name: &str) -> Result<ModLibrary, String> {
    if CORE_MODS.contains(&name) {
        return Err("北极星核心组件不可卸载。".into());
    }
    let lib = scan_library();
    if name == "allmods" {
        for item in lib.all {
            if !item.required && !item.folder_path.is_empty() {
                let _ = fs::remove_dir_all(&item.folder_path);
            }
        }
        return Ok(scan_library());
    }
    if let Some(item) = lib.all.into_iter().find(|m| m.name == name && !m.required) {
        let target = PathBuf::from(&item.folder_path);
        if target.is_dir() {
            fs::remove_dir_all(&target).map_err(|e| format!("卸载模组失败：{e}"))?;
        }
    }
    Ok(scan_library())
}
