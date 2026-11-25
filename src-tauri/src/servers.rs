use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const CN_URL: &str = "https://nscn.wolf109909.top/client/servers";
const GLOBAL_URL: &str = "https://northstar.tf/client/servers";
const MAX_SERVERS: usize = 500;
const CACHE_TTL_MS: u64 = 60_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequiredMod {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerItem {
    pub key: String,
    pub name: String,
    pub description: String,
    pub players: u32,
    pub max_players: u32,
    pub map: String,
    pub mode: String,
    pub location: String,
    pub password: bool,
    pub required_mods: Vec<RequiredMod>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerListResponse {
    pub status: String,
    pub error: String,
    pub region: String,
    pub source: String,
    pub source_url: String,
    pub fetched_at: Option<u64>,
    pub checked_at: u64,
    pub servers: Vec<ServerItem>,
    pub truncated: bool,
    pub reported_count: usize,
}

struct CacheEntry {
    response: ServerListResponse,
    fetched_ms: u64,
}

static CACHE: OnceLock<Mutex<HashMap<String, CacheEntry>>> = OnceLock::new();

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Strips Northstar `^RRGGBBAA` color codes and control characters.
fn clean_text(raw: Option<&str>, limit: usize) -> String {
    let s = match raw {
        Some(v) => v,
        None => return String::new(),
    };
    let bytes = s.as_bytes();
    let mut out = String::with_capacity(s.len().min(limit));
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'^' && i + 8 < bytes.len() && bytes[i + 1..i + 9].iter().all(|b| b.is_ascii_hexdigit()) {
            i += 9;
            continue;
        }
        let ch = s[i..].chars().next().unwrap();
        i += ch.len_utf8();
        if ch.is_control() {
            out.push(' ');
        } else {
            out.push(ch);
        }
    }
    let trimmed = out.trim();
    trimmed.chars().take(limit).collect()
}

fn sha_key(region: &str, id: &str, name: &str, map: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("{region}:{id}:{name}:{map}").as_bytes());
    let digest = hasher.finalize();
    let mut hex = String::with_capacity(20);
    for b in digest.iter().take(10) {
        hex.push_str(&format!("{b:02x}"));
    }
    hex
}

pub async fn fetch(region: &str, force: bool) -> ServerListResponse {
    let reg = if region == "global" { "global" } else { "cn" };
    let (source_name, url) = if reg == "global" {
        ("Northstar Global", GLOBAL_URL)
    } else {
        ("Northstar CN", CN_URL)
    };
    let now = now_ms();

    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Ok(map) = cache.lock() {
        if let Some(entry) = map.get(reg) {
            let age = now.saturating_sub(entry.fetched_ms);
            if (!force && age < CACHE_TTL_MS) || age < 4000 {
                return entry.response.clone();
            }
        }
    }

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(9))
        .user_agent("TFX/3.0.0 server-list")
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return ServerListResponse {
                status: "unavailable".into(),
                error: e.to_string(),
                region: reg.into(),
                source: source_name.into(),
                source_url: url.into(),
                fetched_at: None,
                checked_at: now,
                servers: vec![],
                truncated: false,
                reported_count: 0,
            };
        }
    };

    let fetched = async {
        let resp = client
            .get(url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status()));
        }
        let rows: Vec<Value> = resp.json().await.map_err(|e| e.to_string())?;
        let reported_count = rows.len();
        let truncated = reported_count > MAX_SERVERS;
        let mut servers = Vec::with_capacity(reported_count.min(MAX_SERVERS));

        for row in rows.into_iter().take(MAX_SERVERS) {
            let name = clean_text(row.get("name").and_then(|v| v.as_str()), 150);
            if name.is_empty() {
                continue;
            }
            let id = row
                .get("id")
                .map(|v| match v {
                    Value::String(s) => s.clone(),
                    other => other.to_string(),
                })
                .unwrap_or_default();
            let map_name = clean_text(row.get("map").and_then(|v| v.as_str()), 100);
            let description = clean_text(row.get("description").and_then(|v| v.as_str()), 1000);
            let players = row.get("playerCount").and_then(|v| v.as_u64()).unwrap_or(0).min(10000) as u32;
            let max_players = row.get("maxPlayers").and_then(|v| v.as_u64()).unwrap_or(0).min(10000) as u32;
            let mode = clean_text(row.get("playlist").and_then(|v| v.as_str()), 100);
            let location = clean_text(row.get("region").and_then(|v| v.as_str()), 80);
            let password = row.get("hasPassword").and_then(|v| v.as_bool()).unwrap_or(false);

            let mut required_mods = Vec::new();
            if let Some(mods) = row
                .get("modInfo")
                .and_then(|m| m.get("Mods"))
                .and_then(|m| m.as_array())
            {
                for m in mods.iter().take(30) {
                    if m.get("RequiredOnClient").and_then(|v| v.as_bool()) == Some(true) {
                        let mname = clean_text(m.get("Name").and_then(|v| v.as_str()), 100);
                        if !mname.is_empty() {
                            let mver = clean_text(m.get("Version").and_then(|v| v.as_str()), 40);
                            required_mods.push(RequiredMod {
                                name: mname,
                                version: mver,
                            });
                        }
                    }
                }
            }

            servers.push(ServerItem {
                key: sha_key(reg, &id, &name, &map_name),
                name,
                description,
                players,
                max_players,
                map: map_name,
                mode,
                location,
                password,
                required_mods,
            });
        }

        let ts = now_ms();
        Ok::<ServerListResponse, String>(ServerListResponse {
            status: "online".into(),
            error: String::new(),
            region: reg.into(),
            source: source_name.into(),
            source_url: url.into(),
            fetched_at: Some(ts),
            checked_at: ts,
            servers,
            truncated,
            reported_count,
        })
    }
    .await;

    match fetched {
        Ok(res) => {
            if let Ok(mut map) = cache.lock() {
                map.insert(
                    reg.to_string(),
                    CacheEntry {
                        response: res.clone(),
                        fetched_ms: now_ms(),
                    },
                );
            }
            res
        }
        Err(err) => {
            if let Ok(map) = cache.lock() {
                if let Some(prev) = map.get(reg) {
                    let mut stale = prev.response.clone();
                    stale.status = "stale".into();
                    stale.error = err;
                    stale.checked_at = now_ms();
                    return stale;
                }
            }
            ServerListResponse {
                status: "unavailable".into(),
                error: err,
                region: reg.into(),
                source: source_name.into(),
                source_url: url.into(),
                fetched_at: None,
                checked_at: now_ms(),
                servers: vec![],
                truncated: false,
                reported_count: 0,
            }
        }
    }
}
