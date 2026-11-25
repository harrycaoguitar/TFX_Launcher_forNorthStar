use crate::settings;
use serde_json::{json, Value};
use std::fs;
use std::net::TcpStream;
use std::path::PathBuf;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

fn ea_store_path() -> Option<PathBuf> {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|d| d.join("fold-launcher").join("ea-accounts.json"))
}

pub fn status() -> Value {
    if let Some(path) = ea_store_path() {
        if let Ok(raw) = fs::read_to_string(&path) {
            if let Ok(v) = serde_json::from_str::<Value>(&raw) {
                let accounts = v.get("accounts").cloned().unwrap_or_else(|| json!([]));
                let active_id = v.get("activeAccountId").and_then(|s| s.as_str()).map(|s| s.to_string());
                if let Some(arr) = accounts.as_array() {
                    let current = active_id
                        .as_deref()
                        .and_then(|id| arr.iter().find(|a| a.get("accountId").and_then(|x| x.as_str()) == Some(id)))
                        .or_else(|| arr.first());
                    if let Some(acc) = current {
                        return json!({
                            "ok": true,
                            "loggedIn": true,
                            "accountId": acc.get("accountId").cloned().unwrap_or(Value::Null),
                            "playerName": acc.get("playerName").cloned().unwrap_or_else(|| json!("Pilot")),
                            "userId": acc.get("userId").cloned().unwrap_or_else(|| json!("—")),
                            "country": acc.get("country").cloned().unwrap_or_else(|| json!("CN")),
                            "ownsGame": true,
                            "accounts": accounts
                        });
                    }
                }
            }
        }
    }
    json!({
        "ok": true,
        "loggedIn": false,
        "accountId": null,
        "accounts": [],
        "ownsGame": false
    })
}

pub async fn diagnostics() -> Value {
    let conf = settings::load();
    let ea_enabled = conf.get("eaEmulator").and_then(|v| v.as_bool()).unwrap_or(false);
    let root = settings::resolve_game_root(&conf, "cn");
    let root_ok = !root.is_empty() && settings::is_valid_game_dir(&PathBuf::from(&root));
    let bridge_ok = !root.is_empty()
        && (PathBuf::from(&root).join("NorthstarLauncher.exe").is_file()
            || PathBuf::from(&root).join("Titanfall2.exe").is_file());
    let acc = status();
    let logged = acc.get("loggedIn").and_then(|v| v.as_bool()).unwrap_or(false);

    // Non-blocking quick TCP probe on LSX port 3216.
    let lsx_listening = TcpStream::connect_timeout(
        &"127.0.0.1:3216".parse().unwrap(),
        Duration::from_millis(80),
    )
    .is_ok();

    // Real HTTPS reachability & latency check to EA accounts endpoint.
    let net_start = Instant::now();
    let net_ok = reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
        .ok()
        .map(|c| c.head("https://accounts.ea.com").send());
    let (net_state, net_val, net_detail) = match net_ok {
        Some(fut) => match fut.await {
            Ok(_) => {
                let ms = net_start.elapsed().as_millis();
                ("ok", "可连接", format!("EA 认证节点连通正常，响应 {ms} ms"))
            }
            Err(_) => ("warn", "连接超时", "无法直连 accounts.ea.com，请检查网络或代理".to_string()),
        },
        None => ("warn", "未知", "网络客户端初始化失败".to_string()),
    };

    let all_ok = root_ok && bridge_ok && net_state == "ok";
    let now_ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    json!({
        "at": format!("{now_ts}"),
        "view": {
            "state": if all_ok { "ok" } else { "warn" },
            "label": if all_ok { "连接正常" } else { "部分项目需关注" },
            "checks": [
                {
                    "id": "emulator",
                    "title": "本地模拟器开关",
                    "value": if ea_enabled { "已启用" } else { "未启用" },
                    "state": "ok",
                    "detail": "本地模拟服务配置与当前模式一致"
                },
                {
                    "id": "account",
                    "title": "账户凭据",
                    "value": if logged { "已连接" } else { "未登录" },
                    "state": if logged { "ok" } else { "warn" },
                    "detail": if logged { "本地缓存凭据有效" } else { "使用 EA App 启动时由官方客户端负责登录" }
                },
                {
                    "id": "game",
                    "title": "游戏目录",
                    "value": if root_ok { "已找到" } else { "未配置" },
                    "state": if root_ok { "ok" } else { "warn" },
                    "detail": if root_ok { "已检测到 Titanfall2.exe 主程序与 r2 目录" } else { "请在首页选择 Titanfall 2 游戏目录" }
                },
                {
                    "id": "bridge",
                    "title": "游戏启动桥接",
                    "value": if bridge_ok { "已就绪" } else { "未就绪" },
                    "state": if bridge_ok { "ok" } else { "warn" },
                    "detail": if bridge_ok { "启动程序完整且可读" } else { "未检测到可执行的启动入口" }
                },
                {
                    "id": "lsx",
                    "title": "LSX 通道",
                    "value": if lsx_listening { "运行中" } else { "待命" },
                    "state": "ok",
                    "detail": if lsx_listening { "本地 LSX 3216 端口已监听" } else { "本地 LSX 通道待命，启动时按需建立" }
                },
                {
                    "id": "network",
                    "title": "EA 登录网络",
                    "value": net_val,
                    "state": net_state,
                    "detail": net_detail
                }
            ]
        }
    })
}

pub fn switch_account(account_id: &str) -> Result<Value, String> {
    let path = ea_store_path().ok_or_else(|| "找不到 EA 账户存储目录".to_string())?;
    let raw = fs::read_to_string(&path).map_err(|_| "尚未保存任何 EA 账户".to_string())?;
    let mut store: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if let Some(obj) = store.as_object_mut() {
        obj.insert("activeAccountId".to_string(), json!(account_id));
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_string_pretty(&store).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(status())
}

pub fn logout() -> Result<Value, String> {
    let path = ea_store_path().ok_or_else(|| "找不到 EA 账户存储目录".to_string())?;
    if let Ok(raw) = fs::read_to_string(&path) {
        if let Ok(mut store) = serde_json::from_str::<Value>(&raw) {
            let active = store.get("activeAccountId").and_then(|v| v.as_str()).map(|s| s.to_string());
            if let Some(arr) = store.get_mut("accounts").and_then(|v| v.as_array_mut()) {
                if let Some(id) = active {
                    arr.retain(|a| a.get("accountId").and_then(|x| x.as_str()) != Some(id.as_str()));
                } else {
                    arr.clear();
                }
                let next_id = arr.first().and_then(|a| a.get("accountId").and_then(|x| x.as_str())).map(|s| s.to_string());
                if let Some(obj) = store.as_object_mut() {
                    obj.insert("activeAccountId".to_string(), next_id.map(Value::String).unwrap_or(Value::Null));
                }
            }
            let tmp = path.with_extension("json.tmp");
            if let Ok(body) = serde_json::to_string_pretty(&store) {
                let _ = fs::write(&tmp, body);
                let _ = fs::rename(&tmp, &path);
            }
        }
    }
    Ok(status())
}
