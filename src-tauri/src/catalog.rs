use crate::{mods, settings};
use serde_json::{json, Value};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

const THUNDERSTORE_URL: &str = "https://northstar.thunderstore.io/api/v1/package/";

struct CachedCatalog {
    data: Value,
    fetched_at: u64,
}

static CATALOG_CACHE: OnceLock<Mutex<Option<CachedCatalog>>> = OnceLock::new();

fn now_sec() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub async fn fetch_thunderstore() -> Result<Value, String> {
    let cache = CATALOG_CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(guard) = cache.lock() {
        if let Some(entry) = guard.as_ref() {
            if now_sec().saturating_sub(entry.fetched_at) < 300 {
                return Ok(entry.data.clone());
            }
        }
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("TFX/3.0.0 catalog")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(THUNDERSTORE_URL)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("无法连接 Thunderstore：{e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Thunderstore 返回 HTTP {}", resp.status()));
    }
    let data: Value = resp.json().await.map_err(|e| format!("解析模组列表失败：{e}"))?;
    if let Ok(mut guard) = cache.lock() {
        *guard = Some(CachedCatalog {
            data: data.clone(),
            fetched_at: now_sec(),
        });
    }
    Ok(data)
}

pub fn extract_zip_bytes(bytes: &[u8], dest: &Path) -> Result<usize, String> {
    fs::create_dir_all(dest).map_err(|e| format!("创建目标目录失败：{e}"))?;
    let reader = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("压缩包损坏或不支持：{e}"))?;
    let mut count = 0usize;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let Some(rel) = file.enclosed_name().map(|p| p.to_path_buf()) else {
            continue;
        };
        let out_path = dest.join(rel);
        if file.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out_file = fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut out_file).map_err(|e| e.to_string())?;
            count += 1;
        }
    }
    Ok(count)
}

pub async fn install_from_url(
    app: &AppHandle,
    url: &str,
    owner: &str,
    name: &str,
    version: &str,
) -> Result<Value, String> {
    if !url.starts_with("https://") {
        return Err("仅允许从 HTTPS 源下载模组".into());
    }
    let conf = settings::load();
    let server = conf.get("modProfileServer").and_then(|v| v.as_str()).unwrap_or("cn");
    let region = if server == "global" { "global" } else { "cn" };
    let root_str = settings::resolve_game_root(&conf, region);
    if root_str.is_empty() {
        return Err("请先选择游戏目录后再安装模组".into());
    }
    let profile = settings::resolve_profile_dir(&PathBuf::from(&root_str), &conf, server == "official");
    let pkg_dir = profile
        .join("packages")
        .join(format!("{owner}-{name}-{version}"));

    let _ = app.emit(
        "skin-import-progress",
        json!({ "stage": "installing", "sourceName": name, "phase": "staging", "percent": 20 }),
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .user_agent("TFX/3.0.0 installer")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(url).send().await.map_err(|e| format!("下载模组失败：{e}"))?;
    if !resp.status().is_success() {
        return Err(format!("下载失败：HTTP {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| format!("读取模组数据失败：{e}"))?;

    let _ = app.emit(
        "skin-import-progress",
        json!({ "stage": "installing", "sourceName": name, "phase": "committing", "percent": 75 }),
    );

    let extracted = extract_zip_bytes(&bytes, &pkg_dir)?;

    let _ = app.emit(
        "skin-import-progress",
        json!({ "stage": "installing", "sourceName": name, "phase": "complete", "percent": 100 }),
    );
    let lib = mods::scan_library();
    let _ = app.emit("mods", &lib);
    let _ = app.emit("installed-mod", json!({ "name": name, "files": extracted }));
    Ok(json!({ "ok": true, "files": extracted, "path": pkg_dir.to_string_lossy() }))
}

pub async fn check_update(kind: &str) -> Value {
    let conf = settings::load();
    let region = conf.get("northstarRegion").and_then(|v| v.as_str()).unwrap_or("cn");
    let current = if kind == "launcher" {
        "3.0.0"
    } else if region == "global" {
        "1.31.1"
    } else {
        "1.17.7"
    };
    let repo = if kind == "launcher" {
        "harrycaoguitar/TFX_Launcher_forNorthStar"
    } else if region == "global" {
        "R2Northstar/Northstar"
    } else {
        "R2NorthstarCN/R2NorthstarCN_Launcher"
    };
    let api = format!("https://api.github.com/repos/{repo}/releases/latest");
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("TFX/3.0.0 updater")
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return json!({
                "ok": true, "status": "up-to-date", "currentVersion": current, "latestVersion": current, "region": region, "note": e.to_string()
            });
        }
    };
    match client.get(&api).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(v) = resp.json::<Value>().await {
                let tag = v
                    .get("tag_name")
                    .and_then(|t| t.as_str())
                    .unwrap_or(current)
                    .trim_start_matches('v')
                    .to_string();
                let status = if tag == current { "up-to-date" } else { "available" };
                return json!({
                    "ok": true,
                    "status": status,
                    "currentVersion": current,
                    "latestVersion": tag,
                    "region": region,
                    "url": v.get("html_url").and_then(|u| u.as_str()).unwrap_or("")
                });
            }
        }
        _ => {}
    }
    json!({
        "ok": true,
        "status": "up-to-date",
        "currentVersion": current,
        "latestVersion": current,
        "region": region
    })
}

pub fn clear_download_cache() -> Value {
    let mut files = 0usize;
    let mut bytes = 0u64;
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        let temp_dir = PathBuf::from(local).join("TFX-Launcher").join("Temp");
        if let Ok(entries) = fs::read_dir(&temp_dir) {
            for e in entries.flatten() {
                if let Ok(meta) = e.metadata() {
                    if meta.is_file() {
                        bytes += meta.len();
                        if fs::remove_file(e.path()).is_ok() {
                            files += 1;
                        }
                    }
                }
            }
        }
    }
    json!({ "ok": true, "files": files, "bytes": bytes })
}
