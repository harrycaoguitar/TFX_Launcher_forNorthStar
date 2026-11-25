use crate::{catalog, mods, settings};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkinRecord {
    pub id: String,
    pub name: String,
    pub format: String,
    pub weapon_ids: Vec<String>,
    pub current_weapon_ids: Vec<String>,
    pub created_at: String,
    #[serde(default)]
    pub backup_dir: String,
}

#[derive(Debug, Clone)]
struct PendingImport {
    id: String,
    format: String,
    source_path: PathBuf,
    source_name: String,
    weapon_ids: Vec<String>,
}

static PENDING: OnceLock<Mutex<Option<PendingImport>>> = OnceLock::new();

fn arsenal_dir() -> Result<PathBuf, String> {
    let appdata = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "APPDATA 未设置".to_string())?;
    let dir = appdata.join("TFX-Launcher").join("arsenal");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn load_records() -> Vec<SkinRecord> {
    let Ok(dir) = arsenal_dir() else {
        return vec![];
    };
    let path = dir.join("records.json");
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_records(records: &[SkinRecord]) -> Result<(), String> {
    let dir = arsenal_dir()?;
    let path = dir.join("records.json");
    let body = serde_json::to_string_pretty(records).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, body).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

fn default_weapons() -> Value {
    json!([
        {"id":"r97","name":"R-97","category":"smg"},
        {"id":"car","name":"CAR","category":"smg"},
        {"id":"alternator","name":"转换者","category":"smg"},
        {"id":"volt","name":"电能","category":"smg"},
        {"id":"r201","name":"R-201 卡宾枪","category":"rifle"},
        {"id":"r101","name":"R-101 卡宾枪","category":"rifle"},
        {"id":"flatline","name":"VK-47 平行步枪","category":"rifle"},
        {"id":"spitfire","name":"喷火枪","category":"lmg"},
        {"id":"lstar","name":"L-STAR","category":"lmg"},
        {"id":"kraber","name":"克雷贝尔","category":"sniper"},
        {"id":"wingman","name":"小帮手","category":"pistol"}
    ])
}

fn infer_weapons_from_names(names: &[String]) -> Vec<String> {
    let joined = names.join(" ").to_ascii_lowercase();
    let pairs = [
        ("r97", &["r97", "r99", "r-97"][..]),
        ("car", &["car", "car101"][..]),
        ("alternator", &["alternator", "alt"][..]),
        ("volt", &["volt"][..]),
        ("r201", &["r201", "r-201", "rspn101"][..]),
        ("r101", &["r101", "r-101"][..]),
        ("flatline", &["flatline", "v47", "vk47"][..]),
        ("kraber", &["kraber"][..]),
        ("wingman", &["wingman"][..]),
    ];
    let mut found = Vec::new();
    for (id, needles) in pairs {
        if needles.iter().any(|n| joined.contains(n)) {
            found.push(id.to_string());
        }
    }
    if found.is_empty() {
        found.push("r201".to_string());
    }
    found
}

pub fn weapon_library_list() -> Value {
    let records = load_records();
    let mut restore_weapons: Vec<String> = Vec::new();
    let items: Vec<Value> = records
        .iter()
        .map(|r| {
            for w in &r.weapon_ids {
                if !restore_weapons.contains(w) {
                    restore_weapons.push(w.clone());
                }
            }
            json!({
                "id": r.id,
                "name": r.name,
                "format": r.format,
                "weaponIds": r.weapon_ids,
                "currentWeaponIds": r.current_weapon_ids,
                "createdAt": r.created_at,
                "stateRestoreWeaponIds": r.weapon_ids
            })
        })
        .collect();
    json!({
        "ok": true,
        "items": items,
        "weapons": default_weapons(),
        "stateRestoreWeaponIds": restore_weapons,
        "stateOriginalCurrentWeaponIds": []
    })
}

pub fn inspect_path(app: &AppHandle, path: PathBuf) -> Result<Value, String> {
    let source_name = path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "package".into());
    let _ = app.emit(
        "skin-import-progress",
        json!({ "stage": "reading", "sourceName": source_name }),
    );

    let lower = source_name.to_ascii_lowercase();
    let mut files = Vec::new();
    let mut bytes = 0u64;

    if path.is_file() {
        bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        if lower.ends_with(".zip") {
            if let Ok(raw) = fs::read(&path) {
                if let Ok(mut z) = zip::ZipArchive::new(std::io::Cursor::new(raw)) {
                    for i in 0..z.len().min(64) {
                        if let Ok(f) = z.by_index(i) {
                            if !f.is_dir() {
                                files.push(f.name().to_string());
                            }
                        }
                    }
                }
            }
        } else {
            files.push(source_name.clone());
        }
    } else if path.is_dir() {
        if let Ok(entries) = fs::read_dir(&path) {
            for e in entries.flatten().take(64) {
                let p = e.path();
                if p.is_file() {
                    bytes += fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
                    files.push(e.file_name().to_string_lossy().into_owned());
                }
            }
        }
    }

    let joined_files = files.join(" ").to_ascii_lowercase();
    let format = if lower.ends_with(".dds") || joined_files.contains(".dds") {
        "dds"
    } else if lower.ends_with(".vtf") || joined_files.contains(".vtf") {
        "vtf"
    } else if lower.contains("icepick") {
        "icepick"
    } else {
        "mod"
    }
    .to_string();

    let weapon_ids = infer_weapons_from_names(&[source_name.clone(), joined_files]);
    let pkg_id = format!(
        "pkg-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );
    let display_name = source_name
        .trim_end_matches(".zip")
        .trim_end_matches(".dds")
        .trim_end_matches(".vtf")
        .to_string();

    let pending = PendingImport {
        id: pkg_id.clone(),
        format: format.clone(),
        source_path: path,
        source_name: source_name.clone(),
        weapon_ids: weapon_ids.clone(),
    };
    if let Ok(mut guard) = PENDING.get_or_init(|| Mutex::new(None)).lock() {
        *guard = Some(pending);
    }

    let file_objs: Vec<Value> = files.iter().map(|f| json!({ "name": f })).collect();
    let conf = settings::load();
    let game_ready = !settings::resolve_game_root(&conf, "cn").is_empty();

    Ok(json!({
        "ok": true,
        "format": format,
        "sourceName": source_name,
        "state": {
            "selectionRevision": 1,
            "game": { "ready": game_ready },
            "original": { "state": "ready" },
            "skinRepair": { "ready": true },
            "package": {
                "id": pkg_id,
                "name": display_name,
                "bytes": bytes,
                "count": file_objs.len().max(1),
                "files": file_objs,
                "weaponIds": weapon_ids,
                "entries": []
            }
        }
    }))
}

pub fn select_and_inspect(app: &AppHandle, kind: &str) -> Result<Value, String> {
    let picked = if kind == "folder" {
        rfd::FileDialog::new().set_title("选择模组或皮肤文件夹").pick_folder()
    } else {
        rfd::FileDialog::new()
            .set_title("选择模组或皮肤文件")
            .add_filter("TFX Packages", &["zip", "dds", "vtf", "7z", "rar"])
            .pick_file()
    };
    let Some(path) = picked else {
        return Ok(json!({ "ok": true, "cancelled": true }));
    };
    inspect_path(app, path)
}

pub fn clear_selection() -> Value {
    if let Ok(mut guard) = PENDING.get_or_init(|| Mutex::new(None)).lock() {
        *guard = None;
    }
    json!({ "ok": true })
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if from.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            fs::copy(&from, &to).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn install_pending(app: &AppHandle) -> Result<Value, String> {
    let pending = PENDING
        .get_or_init(|| Mutex::new(None))
        .lock()
        .ok()
        .and_then(|g| g.clone())
        .ok_or_else(|| "尚未选择要安装的文件".to_string())?;

    let _ = app.emit(
        "skin-import-progress",
        json!({ "stage": "installing", "sourceName": pending.source_name, "phase": "staging", "percent": 35 }),
    );

    if pending.format == "mod" || pending.format == "icepick" {
        let conf = settings::load();
        let server = conf.get("modProfileServer").and_then(|v| v.as_str()).unwrap_or("cn");
        let region = if server == "global" { "global" } else { "cn" };
        let root_str = settings::resolve_game_root(&conf, region);
        if root_str.is_empty() {
            return Err("请先选择游戏目录后再安装".into());
        }
        let target_base = if pending.format == "icepick" {
            PathBuf::from(&root_str).join("Icepick").join("mods")
        } else {
            settings::resolve_profile_dir(&PathBuf::from(&root_str), &conf, server == "official").join("mods")
        };
        let folder_name = pending
            .source_name
            .trim_end_matches(".zip")
            .to_string();
        let dest = target_base.join(&folder_name);

        if pending.source_path.is_file() && pending.source_name.to_ascii_lowercase().ends_with(".zip") {
            let bytes = fs::read(&pending.source_path).map_err(|e| e.to_string())?;
            catalog::extract_zip_bytes(&bytes, &dest)?;
        } else if pending.source_path.is_dir() {
            copy_dir_recursive(&pending.source_path, &dest)?;
        }
        let lib = mods::scan_library();
        let _ = app.emit("mods", &lib);
    } else {
        // Store DDS / VTF skin package in arsenal vault & register record.
        let vault = arsenal_dir()?.join("vault").join(&pending.id);
        fs::create_dir_all(&vault).map_err(|e| e.to_string())?;
        if pending.source_path.is_file() {
            fs::copy(&pending.source_path, vault.join(&pending.source_name)).map_err(|e| e.to_string())?;
        } else if pending.source_path.is_dir() {
            copy_dir_recursive(&pending.source_path, &vault)?;
        }

        let mut records = load_records();
        for r in &mut records {
            r.current_weapon_ids.retain(|w| !pending.weapon_ids.contains(w));
        }
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        records.insert(
            0,
            SkinRecord {
                id: pending.id.clone(),
                name: pending
                    .source_name
                    .trim_end_matches(".zip")
                    .trim_end_matches(".dds")
                    .trim_end_matches(".vtf")
                    .to_string(),
                format: pending.format.clone(),
                weapon_ids: pending.weapon_ids.clone(),
                current_weapon_ids: pending.weapon_ids.clone(),
                created_at: format!("TS-{ts}"),
                backup_dir: vault.to_string_lossy().into_owned(),
            },
        );
        save_records(&records)?;
    }

    let _ = app.emit(
        "skin-import-progress",
        json!({ "stage": "installing", "sourceName": pending.source_name, "phase": "complete", "percent": 100 }),
    );
    clear_selection();
    Ok(json!({ "ok": true, "installed": true }))
}

pub fn restore_record(app: &AppHandle, weapon_id: &str, record_id: Option<&str>) -> Result<Value, String> {
    let _ = app.emit(
        "weapon-library-progress",
        json!({ "stage": "installing", "sourceName": weapon_id, "phase": "committing", "percent": 65 }),
    );
    let mut records = load_records();
    for r in &mut records {
        if r.weapon_ids.iter().any(|w| w == weapon_id) {
            r.current_weapon_ids.retain(|w| w != weapon_id);
            if record_id == Some(r.id.as_str()) {
                r.current_weapon_ids.push(weapon_id.to_string());
            }
        }
    }
    save_records(&records)?;
    let _ = app.emit(
        "weapon-library-progress",
        json!({ "stage": "installing", "sourceName": weapon_id, "phase": "complete", "percent": 100 }),
    );
    Ok(json!({ "ok": true, "stateRestored": true }))
}
