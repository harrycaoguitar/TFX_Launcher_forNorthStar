# R1Delta 部署与 TFX 接入核对

核对日期：2026-11-17。本文依据官方 v3.0.5 发布包及同名标签源码；没有将 main 分支的新代码混进发布包。

## 已确认的发布物

- 仓库：https://github.com/r1delta/r1delta
- 发布：https://github.com/r1delta/r1delta/releases/tag/v3.0.5
- 发布于：2026-11-07 00:59:13 UTC，即北京时间 08:59:13。核对时 `/releases/latest` 指向此版本。
- 安装器：`R1DeltaSetup.exe`；官方 README 推荐从安装器开始。
- 完整核心包：`R1Delta-3.0.5-full.nupkg`，285,123,246 字节；这是 ZIP 格式的 Squirrel 包。
- 官方 RELEASES 清单 SHA-1：`FAE115963A1FDE2BA000C23E5606CD4778404198`，下载后实测相同。
- 实测 SHA-256：`1815DB157CA4864DC54F984A8282C1730E36ABEA2E976177E930D16561A54022`。
- 标签源码提交：`2e791ed32f378a71aa76cebf9b70f3a036836d54`。

下载物和解压核心保存在 `verification-output/r1delta-research-20261117/`，没有改动 TFX 当前程序或 HTML。

## 核心文件是什么

`r1delta/r1delta` 是原生框架和官方启动器源码；`r1delta/CORE` 是脚本、菜单、配置及配套运行文件。单独下载 CORE 不能得到完整可运行客户端。发布包已组合配套 CORE 与编译产物，接入时应使用整个版本包。

解压包内的 `lib/net462/`，其主要布局为：

```text
core/
  r1delta.exe                  官方 WPF 启动器与安装/修复入口
  r1delta.exe.config
  Titanfall.exe                R1Delta 的原生启动入口，非完整游戏本体
  R1Delta_DS.exe               专用服务器入口
  tools/                      官方下载工具
  r1delta/
    bin/                      引擎及配套运行库，包含 launcher.dll
    bin_delta/tier0.dll        R1Delta 编译核心及其他原生组件
    bin_nexon/                配套运行库与 SHA256SUMS
    cfg/
    scripts/
    resource/
    GameInfo.txt
    content_manifest.txt      脚本、菜单及原生文件的版本哈希
content/                      用户另选的游戏资源目录
  bin/x64_retail/
  r1/
  vpk/
```

核心与资源目录可以分开。核心 `lib/net462/` 有 1,596 个文件，合计 558,813,636 字节；不能只拿 tier0.dll 或某一个 EXE。

## 没有游戏本体时怎么部署

官方 v3.0.5 启动器允许选择空的资源目录，然后下载、续传并校验自身清单中的文件。不是必须先安装 Steam 版本。

1. 常规部署：下载官方 `R1DeltaSetup.exe`，安装并启动 R1Delta。
2. 首次设置选择专用资源目录，例如 `D:/Games/Titanfall-R1Delta/content`，按设置界面确认下载。不要把整个磁盘根目录作为新安装目的地。
3. 官方 `TitanfallFileList.cs` 列出 386 项资源，大小合计 13,027,429,853 字节，约 13.03 GB / 12.13 GiB；核心包另计。资源源站来自官方源码清单，不是 GitHub release 本身。
4. 下载过程先检查大小与 xxHash64，支持断点续传，校验完成再启动。无需手动制造校验标记。
5. 官方启动器在 `HKCU/Software/R1Delta` 保存 `InstallPath`、`LaunchArguments` 和 `ShowSetupOnLaunch`。以后可以直接复用。
6. 运行依赖依据该版官方启动代码：.NET Framework 4.6.2 或兼容运行时、VC++ 2010 SP1 x64、VC++ 2015–2022 x64、DirectX June 2010。该版会提示原生依赖，但不再自动安装它们。

已解压核心还可以直接运行旁边的 `Start-R1Delta.ps1` 打开官方设置入口；这是研究用入口，尚未完成端到端游戏验证，正式用户分发仍以官方安装器路径为准。

```powershell
# 只检查核心入口文件，不启动、不下载游戏资源
pwsh -NoProfile -File ./verification-output/r1delta-research-20261117/Start-R1Delta.ps1 -CheckOnly

# 打开官方启动器，由它选择资源目录并执行部署
pwsh -NoProfile -File ./verification-output/r1delta-research-20261117/Start-R1Delta.ps1
```

一个容易误判的细节：`vpk/client_mp_common.bsp.pak000_000.vpk` 在官方源码中是可由下载流程创建的空占位文件，并不是资源清单里的下载地址。仅检测它存在，或检测“某个 VPK 存在”，都不能证明游戏完整。

## TFX 当前代码要怎么接

当前 `src/modules/r1delta.js` 和旧页面 `src/app/js/r1delta.js` 是遗留实现。当前 `src/index.js` 没有注册它，`src/preload.js` 未开放相应 IPC，实际 prototype runtime 也未接入。因此不能把“源码里有文件”当作现成支持。

该模块与新版部署有以下差异：

| 旧实现 | 对照官方源码后的接入要求 |
| --- | --- |
| 先要求 Titanfall.exe 与任意 VPK 在同一目录 | 分开记录核心目录和资源目录，允许缺资源时进入官方安装流程 |
| 把全部核心文件覆盖进游戏根目录 | 优先在 TFX 管理的版本目录部署整个核心，资源目录另选；保持版本内文件配套 |
| 直接 spawn 游戏根目录的 Titanfall.exe | 首期调用官方 r1delta.exe，让官方完成初始化；接管直启前必须复现下面的启动条件 |
| 从 `/latest/download/` 分别读取清单与下载包 | 检查 latest 后固定 tag/资产地址，避免检查和下载期间发生版本切换 |
| 简单目录存在即显示已安装 | 分别报告核心完整性、资源状态、依赖和进程状态；不能把创建进程当作进入游戏成功 |

若将来完全由 TFX 直启原生 `Titanfall.exe`，必须复现 `launcher_ex/App.xaml.cs` 的工作：资源目录为 cwd；核心目录的 `Titanfall.exe` 为可执行文件；设置 `ContentId=1025161`、`FROM_DELTA_LAUNCHER=1`、`__COMPAT_LAYER=NoDTToDITMouseBatch=1`；按顺序前置核心的 `r1delta/bin_delta`、`r1delta/bin` 和资源的两个 retail bin 路径；完成音频初始化并处理中文路径的 ASCII junction。`launch/main.cpp` 在没有 FROM_DELTA_LAUNCHER 时会重新打开 r1delta.exe，旧模块的直启因此会转回官方界面。

现代核心会根据自身位置自动构造 `-game` 的绝对路径；CORE README 的 `-game r1delta` 是其通用说明，不能代替完整启动初始化。联机参数传给官方启动器后会转交原生程序，但服务器实连尚未验证。

专用服务器是另一条路径：`R1Delta_DS.exe`，不是普通客户端按钮必需功能；本次不增加开服 UI。

## 验证结果与范围

- 实际下载并核对 285,123,246 字节发布包的官方 SHA-1。
- 检查核心 `content_manifest.txt` 的 620 个 SHA-256 项及 `bin_nexon/SHA256SUMS` 的 13 项，全部一致。
- 使用已发布 r1delta.exe 运行同版本官方 `launcher_installer_integration_tests.ps1`，89 项断言通过。用 pwsh 执行；旧 Windows PowerShell 读取该无 BOM 源脚本曾有解析错误，未更改官方脚本。
- 官方源码引用的 GameInfo 和英文 common VPK 索引端点 HEAD 返回 200；只代表抽样端点当时可访问，不代表所有资源已下载或都可用。
- 官方整体校验脚本在 PE 导入检查阶段缺少 dumpbin.exe，未完成原生依赖导入检查；前面的内容和 CORE 检查已执行，另有独立哈希检查结果。
- **尚未完整下载约 13 GB 资源，也未验证进入游戏、连接服务器或实际游玩。本次没有声称 TFX 已经支持 R1Delta。**

证据在 `VERIFICATION.json`、`core-manifest.json`、`content-file-list.json`、`installer-tests-pwsh.log`、`payload-verification.log`。

## 对应官方源码

- https://github.com/r1delta/r1delta/blob/v3.0.5/launcher_ex/TitanfallManager.cs
- https://github.com/r1delta/r1delta/blob/v3.0.5/launcher_ex/TitanfallFileList.cs
- https://github.com/r1delta/r1delta/blob/v3.0.5/launcher_ex/SetupWindow.xaml.cs
- https://github.com/r1delta/r1delta/blob/v3.0.5/launcher_ex/App.xaml.cs
- https://github.com/r1delta/r1delta/blob/v3.0.5/launch/main.cpp
- https://github.com/r1delta/r1delta/blob/v3.0.5/ci/verify_release_payload.ps1
- https://github.com/r1delta/CORE
