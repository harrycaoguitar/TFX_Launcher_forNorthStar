mod arsenal;
mod catalog;
mod delta;
mod ea;
mod icepick;
mod installer;
mod launch;
mod mods;
mod process;
mod servers;
mod settings;

use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter, Window};

#[tauri::command]
fn load_settings() -> Value {
    settings::load()
}

#[tauri::command]
fn save_settings(app: AppHandle, patch: Value) -> Result<Value, String> {
    let updated = settings::save(&patch)?;
    let _ = app.emit("changed-settings", &patch);
    Ok(updated)
}

#[tauri::command]
fn restore_default_settings(app: AppHandle) -> Result<Value, String> {
    let updated = settings::restore_defaults()?;
    let _ = app.emit("changed-settings", &updated);
    Ok(updated)
}

#[tauri::command]
fn check_game_processes() -> process::ProcessSnapshot {
    process::snapshot()
}

#[tauri::command]
async fn get_servers(region: String, force: bool) -> servers::ServerListResponse {
    servers::fetch(&region, force).await
}

#[tauri::command]
fn get_mods() -> mods::ModLibrary {
    mods::scan_library()
}

#[tauri::command]
fn set_mod_state(app: AppHandle, payload: Value) -> Result<Value, String> {
    let lib = mods::set_mod_state(&payload)?;
    let _ = app.emit("mods", &lib);
    Ok(json!({ "ok": true, "mods": lib }))
}

#[tauri::command]
fn remove_mod(app: AppHandle, name: String) -> Result<Value, String> {
    let lib = mods::remove_mod(&name)?;
    let _ = app.emit("mods", &lib);
    let _ = app.emit("removed-mod", json!({ "name": name }));
    Ok(json!({ "ok": true, "mods": lib }))
}

#[tauri::command]
async fn fetch_thunderstore() -> Result<Value, String> {
    catalog::fetch_thunderstore().await
}

#[tauri::command]
async fn install_from_url(
    app: AppHandle,
    url: String,
    owner: String,
    name: String,
    version: String,
) -> Result<Value, String> {
    catalog::install_from_url(&app, &url, &owner, &name, &version).await
}

#[tauri::command]
async fn check_update(kind: String) -> Value {
    catalog::check_update(&kind).await
}

#[tauri::command]
fn clear_download_cache() -> Value {
    catalog::clear_download_cache()
}

#[tauri::command]
fn northstar_client_status(region: String) -> Value {
    launch::northstar_client_status(&region)
}

#[tauri::command]
fn vanilla_client_status() -> Value {
    launch::vanilla_client_status()
}

#[tauri::command]
fn dds_protection_status() -> Value {
    launch::dds_protection_status()
}

#[tauri::command]
fn launch_game(app: AppHandle, game_version: String) -> Result<Value, String> {
    launch::launch_game(&app, &game_version)
}

#[tauri::command]
async fn install_northstar_client(app: AppHandle, region: String) -> Result<Value, String> {
    installer::install_northstar(&app, &region).await
}

#[tauri::command]
async fn install_vanilla_client(app: AppHandle) -> Result<Value, String> {
    installer::install_vanilla_plus(&app).await
}

#[tauri::command]
fn icepick_status() -> Value {
    icepick::status()
}

#[tauri::command]
fn icepick_select() -> Result<Value, String> {
    icepick::select_directory()
}

#[tauri::command]
fn icepick_toggle(id: String) -> Result<Value, String> {
    icepick::toggle(&id)
}

#[tauri::command]
fn icepick_remove(id: String) -> Result<Value, String> {
    icepick::remove(&id)
}

#[tauri::command]
fn weapon_library_list() -> Value {
    arsenal::weapon_library_list()
}

#[tauri::command]
fn skin_import_select(app: AppHandle, kind: String) -> Result<Value, String> {
    arsenal::select_and_inspect(&app, &kind)
}

#[tauri::command]
fn skin_import_inspect(app: AppHandle, path: String) -> Result<Value, String> {
    arsenal::inspect_path(&app, PathBuf::from(path))
}

#[tauri::command]
fn skin_import_clear() -> Value {
    arsenal::clear_selection()
}

#[tauri::command]
fn skin_import_install(app: AppHandle) -> Result<Value, String> {
    arsenal::install_pending(&app)
}

#[tauri::command]
fn weapon_library_restore(app: AppHandle, weapon_id: String, record_id: Option<String>) -> Result<Value, String> {
    arsenal::restore_record(&app, &weapon_id, record_id.as_deref())
}

#[tauri::command]
fn ea_status() -> Value {
    ea::status()
}

#[tauri::command]
async fn ea_diagnostics() -> Value {
    ea::diagnostics().await
}

#[tauri::command]
fn ea_switch_account(account_id: String) -> Result<Value, String> {
    ea::switch_account(&account_id)
}

#[tauri::command]
fn ea_logout() -> Result<Value, String> {
    ea::logout()
}

#[tauri::command]
fn open_logs_folder() -> Result<(), String> {
    let dir = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|d| d.join("fold-launcher"))
        .ok_or_else(|| "无法定位日志目录".to_string())?;
    let _ = std::fs::create_dir_all(&dir);
    Command::new("explorer.exe")
        .arg(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn r1delta_status() -> Value {
    delta::status()
}

#[tauri::command]
fn r1delta_select() -> Result<Value, String> {
    delta::select_directory()
}

#[tauri::command]
fn r1delta_addons_list() -> Value {
    delta::list_addons()
}

#[tauri::command]
fn r1delta_addons_toggle(id: String) -> Result<Value, String> {
    delta::toggle_addon(&id)
}

#[tauri::command]
fn r1delta_addons_remove(id: String) -> Result<Value, String> {
    delta::remove_addon(&id)
}

#[tauri::command]
fn r1delta_launch(steam: bool) -> Result<Value, String> {
    delta::launch(steam)
}

#[tauri::command]
fn pick_game_directory(app: AppHandle, global: bool) -> Result<Value, String> {
    let picked = rfd::FileDialog::new()
        .set_title(if global { "选择国际服 Titanfall 2 游戏目录" } else { "选择 Titanfall 2 游戏目录" })
        .pick_folder();
    let Some(dir) = picked else {
        return Ok(json!({ "ok": true, "cancelled": true }));
    };
    let path_str = dir.to_string_lossy().into_owned();
    let patch = if global {
        json!({ "globalGamepath": path_str })
    } else {
        json!({ "gamepath": path_str })
    };
    let updated = settings::save(&patch)?;
    let _ = app.emit("changed-settings", &patch);
    let _ = app.emit(if global { "globalpath-selected" } else { "newpath" }, json!({ "path": path_str }));
    Ok(json!({ "ok": true, "path": path_str, "settings": updated }))
}

#[tauri::command]
fn open_path(target: String) -> Result<(), String> {
    if target.trim().is_empty() {
        return Err("路径为空".into());
    }
    Command::new("explorer.exe")
        .arg(&target)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !url.starts_with("https://") && !url.starts_with("http://") && !url.starts_with("mailto:") {
        return Err("仅支持打开 http/https/mailto 链接".into());
    }
    Command::new("cmd.exe")
        .args(["/C", "start", "", &url])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn window_start_drag(window: Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_toggle_maximize(window: Window) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
    } else {
        window.maximize().map_err(|e| e.to_string())?;
    }
    let next = !is_max;
    let _ = window.emit("window-state", json!({ "maximized": next, "fullscreen": false }));
    Ok(next)
}

#[tauri::command]
fn window_toggle_fullscreen(window: Window) -> Result<bool, String> {
    let is_fs = window.is_fullscreen().map_err(|e| e.to_string())?;
    let next = !is_fs;
    window.set_fullscreen(next).map_err(|e| e.to_string())?;
    let _ = window.emit("window-state", json!({ "fullscreen": next, "maximized": false }));
    Ok(next)
}

#[tauri::command]
fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_close(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            restore_default_settings,
            check_game_processes,
            get_servers,
            get_mods,
            set_mod_state,
            remove_mod,
            fetch_thunderstore,
            install_from_url,
            check_update,
            clear_download_cache,
            northstar_client_status,
            vanilla_client_status,
            dds_protection_status,
            launch_game,
            install_northstar_client,
            install_vanilla_client,
            icepick_status,
            icepick_select,
            icepick_toggle,
            icepick_remove,
            weapon_library_list,
            skin_import_select,
            skin_import_inspect,
            skin_import_clear,
            skin_import_install,
            weapon_library_restore,
            ea_status,
            ea_diagnostics,
            ea_switch_account,
            ea_logout,
            open_logs_folder,
            r1delta_status,
            r1delta_select,
            r1delta_addons_list,
            r1delta_addons_toggle,
            r1delta_addons_remove,
            r1delta_launch,
            pick_game_directory,
            open_path,
            open_external,
            window_start_drag,
            window_toggle_maximize,
            window_toggle_fullscreen,
            window_minimize,
            window_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TFX Launcher 3.0");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn win32_process_snapshot_is_fast_and_ok() {
        let snap = process::snapshot();
        assert!(snap.ok, "Win32 Toolhelp32 snapshot must succeed");
        assert!(snap.elapsed_ms < 500, "Native Win32 scan must be fast, got {}ms", snap.elapsed_ms);
    }

    #[test]
    fn settings_defaults_are_coherent() {
        let d = settings::default_settings();
        assert_eq!(d["prototypeTheme"], "airwave");
        assert_eq!(d["uiLanguage"], "zh-CN");
        assert_eq!(d["northstarRegion"], "cn");
        assert_eq!(d["independentServerMods"], false);
    }

    #[test]
    fn profile_resolution_handles_custom_profile_arg() {
        let conf = json!({ "nsargs": "-novid -profile=CustomProfile" });
        let p = settings::resolve_profile_dir(&PathBuf::from(r"D:\Games\Titanfall2"), &conf, false);
        assert!(p.ends_with("CustomProfile"));
        let official = settings::resolve_profile_dir(&PathBuf::from(r"D:\Games\Titanfall2"), &conf, true);
        assert!(official.ends_with("R2Titanfall"));
    }

    #[test]
    fn weapon_library_returns_valid_catalog() {
        let list = arsenal::weapon_library_list();
        assert_eq!(list["ok"], true);
        assert!(list["weapons"].as_array().map(|a| a.len() >= 10).unwrap_or(false));
    }

    #[test]
    fn core_mods_cannot_be_removed() {
        let err = mods::remove_mod("Northstar.Client").unwrap_err();
        assert!(err.contains("核心"));
    }

    #[test]
    fn launch_args_match_cn_global_and_vanilla_mods() {
        let cn = launch::build_launch_args("-novid +ns_masterserver_hostname https://northstar.tf", "northstar", "cn", false);
        assert!(cn.contains(&"+ns_masterserver_hostname".to_string()));
        assert!(cn.contains(&"https://nscn.wolf109909.top".to_string()));
        assert!(!cn.contains(&"https://northstar.tf".to_string()));
        assert!(cn.contains(&"-noallocconsole".to_string()));

        let global = launch::build_launch_args("-novid", "northstar", "global", false);
        assert!(global.contains(&"https://northstar.tf".to_string()));
        assert!(global.contains(&"-noallocconsole".to_string()));

        let vm = launch::build_launch_args("-novid +ns_masterserver_hostname https://northstar.tf", "vanilla", "cn", true);
        assert!(vm.contains(&"-northstar".to_string()));
        assert!(vm.contains(&"-vanilla".to_string()));
        assert!(vm.contains(&"-profile=R2Titanfall".to_string()));
        assert!(vm.contains(&"-noallocconsole".to_string()));
        assert!(!vm.contains(&"+ns_masterserver_hostname".to_string()));
    }

    #[test]
    fn channel_detection_distinguishes_cn_and_global() {
        let base = std::env::temp_dir().join(format!("tfx-ch-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        let cn_root = base.join("cn");
        std::fs::create_dir_all(cn_root.join("R2Northstar")).unwrap();
        std::fs::write(cn_root.join("Northstar.dll"), b"cn").unwrap();
        std::fs::write(cn_root.join("launcher.dll"), b"cn").unwrap();
        assert_eq!(launch::detect_installed_channel(&cn_root).map(|(c, _)| c), Some("cn"));

        let gl_root = base.join("global");
        std::fs::create_dir_all(gl_root.join("R2Northstar")).unwrap();
        std::fs::write(gl_root.join("R2Northstar").join("Northstar.dll"), b"gl").unwrap();
        assert_eq!(launch::detect_installed_channel(&gl_root).map(|(c, _)| c), Some("global"));
        let _ = std::fs::remove_dir_all(&base);
    }
}
