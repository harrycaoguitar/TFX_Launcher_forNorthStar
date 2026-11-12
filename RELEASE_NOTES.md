# TFX Launcher 1.1.1

## 中文

- 修复国服 / 全球服选择多层目录时无法安装的问题，安装位置不再限制为磁盘根目录下的文件夹。
- 支持在已有文件的目录中部署独立客户端，保留无关文件；继续阻止国服与全球服使用同一个实际目录。
- 修复磁盘空间误报：安装计划不再把游戏截图与录制帧计入所需资源或复制到客户端目录；空间不足提示显示目标路径、所需空间与可用空间。
- 移除重复的 Icepick 独立页面，在“我的模组”中统一管理 Icepick 内容。
- 在“模组安装”中加入 Icepick 格式标签，拖入有效安装包后自动识别并切换到对应格式。
- 保留原版 / 北极星启动、多语言、游戏目录选择及现有模组和皮肤管理功能。
- 重新打包 Windows x64 安装程序，更新品牌背景与 1.1.1 版本信息，保留简体中文、繁体中文、英语、德语、法语以及自定义安装目录、快捷方式和卸载程序。
- 同步发布对应开发源码、构建脚本与安装器工程。

## English

- Fixed CN / Global client installation in nested folders. Installation destinations no longer need to be directly under a drive root.
- Allowed deployment into folders containing existing files while preserving unrelated content. CN and Global clients still cannot use the same physical directory.
- Fixed inflated disk-space requirements by excluding game screenshots and captured movie frames from the copy plan. Low-space errors now show the destination, required space and available space.
- Removed the duplicate standalone Icepick page and consolidated Icepick management under My Mods.
- Added an Icepick format tab to Mod Installer. Valid dropped packages are detected automatically and select the matching format.
- Retained Vanilla / Northstar launching, multiple interface languages, game-folder selection, and existing mod and skin management.
- Rebuilt the Windows x64 setup with updated branded artwork and consistent 1.1.1 version information. The installer retains Simplified Chinese, Traditional Chinese, English, German and French, a selectable installation folder, shortcuts and an uninstaller.
- Published the matching development source, build scripts and installer project.

---

# TFX Launcher 1.0.4

**中文**

- 原版启动新增“不带 Mod / 带 Mod”选择；带 Mod 模式使用 VanillaPlus 2.5.1 与兼容的 Northstar Global 加载组件，并保留 Steam / EA 的正版启动身份。
- 可选分别记忆官服、中国服和全球服的 Mod 开关，默认关闭；Mod 文件、原生插件以及 DDS / VTF 皮肤仍然共用。
- 加强启动过程诊断与失败反馈；加载 Mod 时提前退出会提供 Mod 排查入口，保留真实失败分类，不把未知原因认定为已查明冲突。
- 五种语言同步更新。该版本为正式版；仅支持兼容的客户端 Mod，不保证所有 Mod 或组合可用于官服。

**English**

- Adds **Without Mods / With Mods** choices to Vanilla launching. Modded official play uses VanillaPlus 2.5.1 and a compatible Northstar Global runtime while preserving the purchased game's Steam / EA launch identity.
- Optionally remembers Mod switches independently for Official, NorthstarCN and Northstar Global; off by default. Installed files, native plugins and DDS / VTF skins remain shared.
- Improves launch diagnostics and failure feedback. Early exits with a Mod loader offer Mod troubleshooting while retaining the observed failure classification and an unknown cause when no cause is established.
- Updates all five interface languages. This stable release supports compatible client-side Mods; compatibility of every Mod or combination is not guaranteed.

**Validation / 验证**: The stable version is rebuilt from the accepted beta.2 functionality with synchronized application and sidebar versions. Automated validation and artifact checks accompany this release. Recorded live validation covers official multiplayer and Northstar menu/authentication checks, not every Mod effect or joining a match on every network. The source archive and Windows x64 portable application are rebuilt for version 1.0.4; original beta release artifacts remain available.

Windows x64 portable: `TFX-Launcher-1.0.4.exe`. Source, validation notes and SHA-256 checksums accompany this release.

---

# TFX Launcher 1.0.1

**English**

- Faster DDS / VTF skin installation, with backups and replacement checks retained.
- Earlier launcher window display and fewer startup background reads.
- Faster EA / Northstar launch handoff and confirmation.
- Fix stale client status after changing game folders and GitHub update checks.

**中文**

- 加快 DDS / VTF 皮肤安装，保留备份与替换校验。
- 更早显示启动器窗口，减少启动时的后台读盘。
- 缩短 EA / 北极星唤起与启动确认的等待。
- 修正更换游戏目录后的客户端状态及 GitHub 更新检查。

Windows x64 portable: `TFX-Launcher-1.0.1.exe`. Source and checksums accompany this release.

---

# TFX Launcher 1.0.0

TFX 首次正式版本，提供 TITANFALL 2 原版启动、NorthstarCN / Northstar 客户端管理、社区服务器浏览、模组管理与 DDS / VTF 皮肤安装。

- 五种界面语言、十种磨砂主题、页面过渡与自绘选择菜单。
- 独立客户端安装与切换、核心模组准备、启动确认与提前退出反馈。
- Thunderstore 目录、搜索、依赖安装、取消和失败恢复；本地模组搜索、排序、开关与导入校验。
- DDS / VTF 同枪替换协调、备份恢复、启动保护与历史记录管理。
- 发布前修复设置保存反馈、菜单键盘行为、长文本和下载漏译；加强异步安装检查、ZIP CRC、外部文件变更检测和重复启动保护。

Windows x64 便携版。需要已安装的正版游戏及 Steam / EA 环境。运行 TFX-Launcher-1.0.0.exe；校验值见 SHA256SUMS.txt。源代码与许可证随同发布。

应用仍为 GPL-3.0-or-later 派生项目；请保留来源与第三方许可。内置全球服省略独立许可不明的可选 Discord 状态插件；完整官方更新由用户从官方源下载。

作者 HarryCao。反馈：harrycaoguitar@gmail.com 或 https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/issues。
