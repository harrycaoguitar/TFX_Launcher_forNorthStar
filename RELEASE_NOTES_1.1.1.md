# TFX Launcher 1.1.1

## 中文

- 修复国服 / 全球服选择多层目录时无法安装的问题，安装位置不再限制为磁盘根目录下的文件夹。
- 支持在已有文件的目录中部署独立客户端，保留无关文件；继续阻止国服与全球服使用同一个实际目录。
- 修复磁盘空间误报：安装计划不再把游戏截图与录制帧计入所需资源或复制到客户端目录；空间不足提示显示目标路径、所需空间与可用空间。
- 修复原版带 Mod 的框架识别：必须在原版游戏根目录检测到国际服北极星；缺失、国服、损坏和过旧框架分别显示正确操作提示，不再误报为 VanillaPlus 问题。
- 检测到国服北极星时，确认后才会清理国服加载文件和官方核心模组并写入完整国际服框架；保留个人模组，取消不执行替换，框架替换失败恢复原文件。
- 移除重复的 Icepick 独立页面，在“我的模组”中统一管理 Icepick 内容。
- 在“模组安装”中加入 Icepick 格式标签，拖入有效安装包后自动识别并切换到对应格式。
- 保留原版 / 北极星启动、多语言、游戏目录选择及现有模组和皮肤管理功能。
- 重新打包 Windows x64 安装程序，更新品牌背景与 1.1.1 版本信息，保留简体中文、繁体中文、英语、德语、法语以及自定义安装目录、快捷方式和卸载程序。
- 同步发布对应开发源码、构建脚本与安装器工程。

## English

- Fixed CN / Global client installation in nested folders. Installation destinations no longer need to be directly under a drive root.
- Allowed deployment into folders containing existing files while preserving unrelated content. CN and Global clients still cannot use the same physical directory.
- Fixed inflated disk-space requirements by excluding game screenshots and captured movie frames from the copy plan. Low-space errors now show the destination, required space and available space.
- Fixed the Vanilla-with-Mod framework check. The Global Northstar framework must be present in the original game folder; missing, CN, damaged and outdated states now show the correct action instead of a VanillaPlus repair prompt.
- When CN Northstar is detected, the launcher asks before removing CN loaders and official core Mods and installing the complete Global framework. Personal Mods are preserved. Canceling makes no replacement, and a failed framework replacement restores the original framework files.
- Removed the duplicate standalone Icepick page and consolidated Icepick management under My Mods.
- Added an Icepick format tab to Mod Installer. Valid dropped packages are detected automatically and select the matching format.
- Retained Vanilla / Northstar launching, multiple interface languages, game-folder selection, and existing mod and skin management.
- Rebuilt the Windows x64 setup with updated branded artwork and consistent 1.1.1 version information. The installer retains Simplified Chinese, Traditional Chinese, English, German and French, a selectable installation folder, shortcuts and an uninstaller.
- Published the matching development source, build scripts and installer project.
