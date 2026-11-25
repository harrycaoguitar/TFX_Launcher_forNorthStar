# TFX Launcher 2.0.0

TFX Launcher 2.0.0 是面向《泰坦陨落 2》（Northstar 国际服 / 北极星国服 / 原版 / 原版带 Mod Vanilla+）与《泰坦陨落 1》（R1Delta）的**全原生轻量启动器**。

本版本完成**史诗级底层架构重构**：彻底剥离臃肿的 Electron + Chromium + Node.js 运行时，全面迁移至 **Tauri 2 + Rust + Windows WebView2** 原生架构。

## 2.0.0 史诗级优化一览

| 维度 | 1.x 旧版（Electron） | 2.0.0（Tauri 2 + Rust 原生重构） | 提升幅度 |
| --- | --- | --- | --- |
| 安装包体积（Setup.exe） | ~80 MB+ | **2.59 MB** | **暴降 96%+** |
| 免安装绿色版体积 | ~200 MB+ | **5.31 MB** | **暴降 97%+** |
| 常驻运行内存 | ~200–350 MB | **~39 MB** | **直降 80%+** |
| 进程状态探测耗时 | PowerShell 轮询（数百 ms / 偶发转圈） | **Win32 原生快照 < 2 ms** | **百倍提速、零转圈** |
| 国服 / 国际服内核切换 | 手动折腾或全量重装 | **150 ms 无损热切换** | **秒级切换、零丢 Mod** |

## 核心特性

- **极速轻量原生架构**：主程序（`TFX-Launcher.exe` + `WebView2Loader.dll`）解压后仅约 `5.3 MB`，安装包仅 `2.59 MB`，秒开零卡顿。
- **双代泰坦陨落全模式一键启动**：
  - **Northstar 北极星国服（CN）与国际服（Global）**：内置发行版热切换引擎（约 `150ms` 无损切换官方引导文件与核心模组，完整保留用户模组与皮肤），自动同步 `autoexec_ns_client.cfg` 与主服务器参数，禁用多余黑框控制台（`-noallocconsole` + Win32 `ConsoleWindowClass` 静默隐藏）。
  - **原版游戏 / 原版带 Mod（Vanilla+）**：未检测到 `R2Titanfall (VanillaPlus)` 或国际服引导组件时自动从 Thunderstore / GitHub 下载安装并实时回报进度。
  - **泰坦陨落 1（R1Delta）**：支持目录检测、插件管理与一键启动。
- **实时服务器浏览器**：异步 HTTPS + Rustls 直连 CN（`nscn.wolf109909.top`）与 Global（`northstar.tf`）服务器列表，自动清洗颜色代码。
- **模组、皮肤与 Icepick 管理**：原生扫描 `mods/` 与 `packages/`，原子写入 `enabledmods.json`（兼容扁平与版本化格式），防止误删核心模组；集成 Thunderstore 模组商店、武器皮肤库（DDS/VTF/Mod/Icepick 导入与保险库备份恢复）以及 Icepick 单人模组管理。
- **EA 账户与真实诊断**：读取 `fold-launcher` 账户配置，原生探测本地 LSX TCP `3216` 端口与 `accounts.ea.com` HTTPS 连通性。
- **17 套 WCAG AA 主题 & 5 语言界面**：支持简体中文、繁體中文、English、Deutsch、Français，配置与旧版 `%APPDATA%\fold.json` 100% 互通。

## 快速构建

请参阅 [BUILD.md](./BUILD.md)。
