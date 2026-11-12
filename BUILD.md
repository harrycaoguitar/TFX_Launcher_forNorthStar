# Building TFX Launcher 1.1.1 / 构建说明

## Requirements / 环境

- Windows x64; Node.js **22.12+**, preferably Node.js 24.
- Electron **43.1.1** and the existing electron-builder **26.15.3** remain pinned in `package.json` and `package-lock.json`.
- Git should preserve bundled file bytes. `.gitattributes` disables text conversion for `src/`, including the files checked by client and VanillaPlus manifests.

## Development / 开发运行

```powershell
npm ci
npm start
```

For an isolated development profile / 使用独立配置调试：

```powershell
.\node_modules\.bin\electron.cmd . --fold-profile=D:\TFX-Dev-Profile
```

The normal user's configuration is not used by that profile. Do not point fixture tests at a live game directory.

## Setup installer / 安装器

```powershell
npm run build:win
# npm run dist invokes the same installer build.
```

Default output / 默认输出：

```text
dist/
  TFX-Launcher-1.1.1/
  TFX-Launcher-1.1.1-Setup.exe
  uninstall-files.nsh
```

The output directory must be fresh. To use a different output root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build\Build.ps1 -OutputRoot D:\TFX-Build-1.1.1
```

For an existing Electron 43.1.1 x64 runtime, offline packaging is also supported:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build\Build.ps1 -RuntimeDir D:\TFX-Electron-Runtime -OutputRoot D:\TFX-Build-Offline
```

`RuntimeDir` must contain `electron.exe` or `TFX-Launcher.exe` and its matching runtime files. Production dependencies must be present under the repository's `node_modules`. The downloaded release Source.zip already contains those dependencies; a Git clone obtains them with `npm ci`.

构建会复制运行时和生产依赖，生成 ASAR，将 `src/tools` 保持为解包资源，设置 EXE 的 1.1.1 版本与图标，再生成卸载文件清单并编译安装器。输出目录要求为空，已有输出请保留并换一个目录。

### Installer project / 安装器工程

| Path | Purpose / 用途 |
|---|---|
| `build/Build.ps1` | Reproducible Windows build entry / Windows 构建入口 |
| `build/Installer.nsi` | Modern UI 2 wizard, five languages, folder selection and shortcuts |
| `build/Make-Art.ps1` | Regenerate the branded BMP artwork using System.Drawing |
| `build/wizard.bmp`, `build/header.bmp` | Installer artwork / 安装器背景与页眉 |
| `build-tools/nsis` | NSIS 3.0.4.1 and bundled licenses |
| `build-tools/rcedit-x64.exe` | rcedit 2.0.0, native executable resource editor |
| `build-tools/asar` | @electron/asar 4.3.1 and its dependencies |

The setup is per-user and defaults to `%LOCALAPPDATA%\Programs\TFX Launcher`. It offers Simplified Chinese, Traditional Chinese, English, German and French, a directory page and an optional desktop shortcut. Uninstall uses an explicit owned-file manifest and leaves separately added files and AppData settings in place. The installer is unsigned; no signing certificate is configured.

安装器语言只控制安装向导，不覆盖启动器内的语言偏好。启动器目录和游戏目录分别配置。

## Existing portable build / 原便携版构建入口

```powershell
npm run dist:portable
```

This retains the earlier electron-builder configuration in `build.config.json`. The published 1.1.1 Setup.exe uses `build/Build.ps1`; it is not produced by the legacy portable wrapper.

## Source provenance / 源码对应关系

Version 1.1.1 applies the directory, disk-space and integrated Icepick fixes to the 1.1.0 release source. The matching source archive contains the application files, production dependencies and installer tooling. Repository-only materials include the retained historical tests, project documentation, a lockfile and the legacy portable-build command. The release source was recovered from the retained repaired application package and remains editable JavaScript, HTML and CSS.

1.1.1 在 1.1.0 发布源码上同步本轮安装目录、磁盘空间与 Icepick 管理修复。仓库保留历史测试、文档和许可，补入新版安装器工程。不要将 GitHub 自动生成的旧标签源码快照误认为附件源码包；需要发布时对应的交付物，请选择 Release 中手动上传的 `TFX-Launcher-1.1.1-Source.zip`。

## Verification / 验证

```powershell
npm test
```

Historical tests remain available. Some fixtures assume the older shared-root client architecture, so a full-suite result must be read with its actual failures and timeout status. See [the 1.1.1 verification report](docs/RELEASE_1.1.1_VERIFICATION.md) for this checkout's observed results. Do not describe inherited tests as newly passing without running them.

`release-verification/1.1.1/` retains the current renderer reports and targeted regression checks. Both the staged and installed application passed 18 renderer checks. Silent installation into a custom Chinese path succeeded and all 121 application files matched the build. The uninstaller was present; uninstall was not rerun for 1.1.1. These checks did not start an EA service or complete an actual game session.

Keep the client's offline `payload.zip` files, manifests, fonts, archive tools and third-party notices. Do not publish local account stores, tokens, user profiles, caches or game data. Existing data locations and recovery journals are not relocated by this repository synchronization.

## Licensing / 许可

Preserve `LICENSE`, `THIRD_PARTY_NOTICES.md` and licenses in `src/tools`, font folders and build tools. NSIS: its bundled COPYING; @electron/asar and dependencies: bundled package notices; rcedit: MIT, source https://github.com/electron/rcedit/tree/v2.0.0 . No third-party component is claimed as original TFX code.
