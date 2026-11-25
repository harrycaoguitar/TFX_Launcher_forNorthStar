# R1Delta：仅部署核心，玩家自行安装游戏

2026-11-17 核对；本文件按用户最新要求确定 TFX 的接入范围，替代此前部署说明中建议接入整套资源下载的方案。

## GitHub 上已有的核心

官方 v3.0.5 发布资产 `R1Delta-3.0.5-full.nupkg` 包含编译后的启动器、原生入口及配套运行库、CORE 脚本和菜单。285,123,246 字节约为 285 MB（GitHub 显示 272 MiB）。包名里的 full 表示完整版本更新包，不是完整游戏资源。

- 官方资产：https://github.com/r1delta/r1delta/releases/expanded_assets/v3.0.5
- 包内容定义：https://github.com/r1delta/r1delta/blob/v3.0.5/r1delta.nuspec
- CORE：https://github.com/r1delta/CORE

包内 `lib/net462/` 才是程序载荷。核心包括 `r1delta.exe`、`Titanfall.exe`、`r1delta/bin_delta/tier0.dll`、`r1delta/bin/`、`r1delta/bin_nexon/`、`r1delta/scripts/`、`r1delta/resource/` 和配置文件。该包含配套二进制组件，不能将它描述为只有开源脚本或只有一个 DLL；单独克隆 CORE 也不能替代完整编译发布包。

上一轮提到的约 13 GB 是官方独立资源下载流程里的游戏资源，不属于本次 TFX 应部署的核心包。

## TFX 的接入行为

1. 玩家自行购买、下载并安装 Titanfall 1，然后在 TFX 选择已有游戏目录。
2. 检查该目录的游戏资源和运行文件；缺文件时说明缺失项，让玩家通过所用游戏平台修复。
3. 仅从 GitHub 下载、校验并解压版本配套的 Delta 核心到独立目录，复用玩家已有游戏资源。保留原游戏文件。
4. 由 TFX 完成启动环境初始化，再运行核心目录中的原生入口，工作目录指向玩家已有游戏目录。
5. 不接入 `TitanfallFileList.cs` 所列的游戏资源下载器，不提供“下载游戏本体”或从空目录安装本体的操作。

官方源码已经分开使用核心目录和资源目录：`launcher_ex/App.xaml.cs` 的 `originalLauncherExeDir` 用来定位核心，`finalInstallPath` 用作游戏工作目录。此结构支持复用已有安装，但具体零售版本与 Delta 3.0.5 的兼容性仍需使用真实游戏测试。

不应把调用官方 `r1delta.exe` 简单当成“仅核心”已实现：它在检测到损坏或缺失资源时会进入自身设置/下载界面。TFX 的最终仅核心路径需要自行检查资源并完成原生启动初始化，而不是自动进入该下载流程。

对应启动逻辑：https://github.com/r1delta/r1delta/blob/v3.0.5/launcher_ex/App.xaml.cs

## 当前已交付与尚未验证

核心已下载解压至 `verification-output/r1delta-research-20261117/portable-core-v3.0.5/`，原始发布包及哈希核对结果在相邻目录。未下载约 13 GB 游戏资源；未修改 TFX 程序、UI 或游戏安装；尚未完成真实游戏启动验证。
