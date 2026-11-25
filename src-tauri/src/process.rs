use serde::Serialize;
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
};

const WATCHED_IMAGES: &[&str] = &[
    "titanfall.exe",
    "titanfall2.exe",
    "titanfall2-unpacked.exe",
    "northstarlauncher.exe",
    "origin.exe",
    "eadesktop.exe",
];

const GAME_IMAGES: &[&str] = &[
    "titanfall.exe",
    "titanfall2.exe",
    "titanfall2-unpacked.exe",
    "northstarlauncher.exe",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessEntry {
    pub image: String,
    pub pid: u32,
    pub executable_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessSnapshot {
    pub ok: bool,
    pub elapsed_ms: u64,
    pub processes: Vec<ProcessEntry>,
}

fn wide_cstr_to_string(buf: &[u16]) -> String {
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    OsString::from_wide(&buf[..len]).to_string_lossy().into_owned()
}

fn query_exe_path(pid: u32) -> Option<String> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return None;
        }
        let mut buf = [0u16; 1024];
        let mut size = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size);
        CloseHandle(handle);
        if ok != 0 && size > 0 {
            Some(OsString::from_wide(&buf[..size as usize]).to_string_lossy().into_owned())
        } else {
            None
        }
    }
}

/// Native Win32 Toolhelp32 process scan (< 2ms, zero PowerShell spawns, zero wait cursor).
pub fn snapshot() -> ProcessSnapshot {
    let started = std::time::Instant::now();
    let mut processes = Vec::new();

    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap == INVALID_HANDLE_VALUE || snap.is_null() {
            return ProcessSnapshot {
                ok: false,
                elapsed_ms: started.elapsed().as_millis() as u64,
                processes,
            };
        }

        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        if Process32FirstW(snap, &mut entry) != 0 {
            loop {
                let image = wide_cstr_to_string(&entry.szExeFile).to_ascii_lowercase();
                if WATCHED_IMAGES.contains(&image.as_str()) {
                    let pid = entry.th32ProcessID;
                    let executable_path = query_exe_path(pid);
                    processes.push(ProcessEntry {
                        image,
                        pid,
                        executable_path,
                    });
                }
                if Process32NextW(snap, &mut entry) == 0 {
                    break;
                }
            }
        }
        CloseHandle(snap);
    }

    ProcessSnapshot {
        ok: true,
        elapsed_ms: started.elapsed().as_millis() as u64,
        processes,
    }
}

pub fn has_game_running(snap: &ProcessSnapshot, root: Option<&str>) -> bool {
    if !snap.ok {
        return false;
    }
    let normalized_root = root.map(|r| {
        r.replace('/', "\\")
            .trim_end_matches('\\')
            .to_ascii_lowercase()
    });
    snap.processes.iter().any(|p| {
        if !GAME_IMAGES.contains(&p.image.as_str()) {
            return false;
        }
        match (&normalized_root, &p.executable_path) {
            (Some(r), Some(exe)) if !r.is_empty() => {
                let exe_norm = exe.replace('/', "\\").to_ascii_lowercase();
                exe_norm.starts_with(r)
            }
            _ => true,
        }
    })
}
