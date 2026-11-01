# TFX Launcher

[English](README.md) · **简体中文**

### 北极星国服与全球服、EA 账号、模组和皮肤，一个启动器管理。

TFX 是面向 **《泰坦陨落 2》** 的 Windows 启动器，整合 **NorthstarCN 国服**、**Northstar 全球服**、原版游戏启动、内置 **EA 模拟器**，以及 **Icepick / Northstar Mod / DDS / VTF** 统一安装工作区。

[**下载 1.1.0**](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/releases/tag/1.1.0) · [**最新版本**](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/releases/latest) · [反馈问题](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/issues) · [源码构建](BUILD.md)

![TFX 北极星启动页面](docs/images/play.webp)

> README 截图来自此前发布的 **1.0.3**，用于展示界面结构；1.1.0 新功能以以下介绍为准。截图中的服务器、路径与数量为演示数据。

## 1.1.0 更新重点

- **国服 / 全球服独立目录安装：** 可选择支持的 NTFS 磁盘上的独立文件夹，分别准备客户端。
- **EA 模拟器独立页面：** 集中管理 EA 登录、账号状态和内置服务；更换账号时退出当前登录再重新登录。
- **Icepick 整合：** 在统一安装页导入战役模组，在“我的模组”底部单独管理。
- **原版页面修复：** 切换原版游戏时保留页面内容和启动按钮。
- **新版安装向导：** 品牌背景、自选安装目录、可选快捷方式与五种安装语言。
- **版本显示统一：** 启动器界面和程序文件版本统一为 1.1.0。

[查看中英文更新说明](RELEASE_NOTES_1.1.0.md)。

## 功能一览

| 工作区 | 可以做什么 |
|---|---|
| 开始游戏 | 启动北极星国服、全球服和原版；检查客户端安装状态、选择游戏目录 |
| 社区服务器 | 浏览所选网络的公开服务器，搜索名称、地图、玩法并查看人数 |
| 我的模组 | 搜索、排序、启停和移除多人模组；可选独立启用状态配置 |
| 模组安装 | 拖入 Icepick、Northstar Mod、DDS 或 VTF，自动识别并进入对应安装流程 |
| Icepick 管理 | 独立管理战役模组，不混入北极星多人模组 |
| 武器库 | 按武器浏览皮肤，恢复可用的 DDS / VTF 历史状态或原版资源 |
| EA 模拟器 | EA 登录、账号状态、服务状态和诊断操作 |
| 偏好设置 | 十套主题、五种界面语言、启动参数、维护与更新选项 |

## 下载与安装

支持 **Windows x64**。需要已购买并安装的《泰坦陨落 2》，启动器不包含游戏本体。请准备可用的 Steam / EA 环境，并为客户端、缓存和皮肤备份留出空间。

1. 前往 [1.1.0 发布页](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/releases/tag/1.1.0)，下载 **`TFX-Launcher-1.1.0-Setup.exe`**。
2. 选择安装语言：**简体中文、繁體中文、English、Deutsch 或 Français**。
3. 选择安装目录与是否创建桌面快捷方式。安装器同时提供开始菜单入口和卸载程序。
4. 打开 TFX，确认现有游戏源目录，也就是包含 `Titanfall2.exe` 的完整游戏目录。
5. 选择启动模式和网络。所选客户端未安装时，按页面提示安装，再启动游戏。

默认启动器安装位置为 `%LOCALAPPDATA%\Programs\TFX Launcher`。**启动器安装目录与游戏 / 客户端目录是不同设置。** 安装器语言也不会替代启动器中已保存的界面语言。

升级前先退出旧启动器。卸载按程序清单移除文件，保留应用数据中的用户配置和额外添加的文件。当前安装程序未签名。

## 国服与全球服独立目录

先选择已有的完整游戏作为源目录，再为国服或全球服选择**单独的目标文件夹**。目标为空文件夹时，不需要预先放入 `Titanfall2.exe`，启动器会基于游戏源目录准备所需内容。支持的 NTFS 目标目录可放在其他盘；请保持源与目标可访问、互不相同且不互相嵌套。

分别准备两个客户端后，启动时使用对应的网络和目录，减少反复替换核心文件。双开还取决于平台、账号会话与游戏环境，独立目录不代表所有 Steam / EA 组合都能同时运行。

页面显示所选客户端的实际版本。**TFX 1.1.0 是启动器版本，不是北极星版本。** 内置回退清单记录 NorthstarCN **1.17.7**、Northstar 全球服 **1.31.13**；已识别的较新本地客户端另行处理。来源见[客户端说明](src/tools/clients/SOURCE.md)。

单人战役与官方多人可选择**原版**。“带 Mod”模式使用 VanillaPlus 和兼容的客户端模组，通过启动页准备或修复所需组件。依赖北极星自定义服务器的模组不适用于官方多人。

## 模组、Icepick 与皮肤

在**模组安装**页面拖入一个兼容压缩包或完整文件夹，也可点击选择文件 / 文件夹。启动器会检查内容，点亮对应的 **Icepick / DDS / VTF / Mod** 类型，并进入对应安装流程。

| 内容 | 请保留 |
|---|---|
| Icepick 战役模组 | 完整包结构，并选择正确的 Icepick 目录 |
| Northstar 多人模组 | 有效的 `mod.json` 与资源目录 |
| DDS 皮肤 | 原始 DDS 文件名与全部必要文件 |
| VTF 皮肤 | 完整 materials / models 目录和关联资源 |

ZIP、7z、RAR 能解压不代表内容一定兼容。一次导入一个包，修改资源时请先退出游戏。

**Icepick 管理位于“我的模组”页面底部。** 在这里选择 Icepick 目录，刷新、启用、停用或移除战役模组；它们不会混入 Northstar 多人列表。启动器未捆绑完整 Icepick 战役框架，请选择已有的适用安装目录。

多人模组支持搜索、排序、开关和移除，也可通过 Thunderstore 发现内容。可选服务器配置分别记住官服、国服与全球服的启用状态；这不等同于隔离全部资源和原生插件的三套游戏。

**武器库**按武器组织已识别皮肤，可选择可用的 DDS / VTF 历史状态或恢复原版资源。请保留必要备份，并先完成中断操作的恢复。若游戏仍显示 Mod 皮肤，请检查并关闭覆盖该武器的模组。

## EA 模拟器与账号

从导航进入 **EA 模拟器**，登录账号、查看当前账号与服务状态。更换账号时先退出当前登录，再重新登录。账号登录在提供的 EA 登录窗口中完成；内置服务通过本地连接工作，页面提供适用的诊断与修复入口。

服务运行时，关闭窗口会提供**直接退出并停止服务**、**留在托盘继续运行**与**取消**。留在托盘可保持服务，需要结束时从托盘菜单退出。账号有效性、游戏所有权和平台要求仍然适用。

## 界面预览

以下为历史 1.0.3 截图，并非此次重新拍摄的 1.1.0 界面。

| 模组管理 | 社区服务器 |
|:---:|:---:|
| ![搜索与启停模组](docs/images/mods.webp) | ![社区服务器列表](docs/images/servers.webp) |
| DDS 安装 | VTF 安装 |
| ![DDS 安装](docs/images/dds.webp) | ![VTF 安装](docs/images/vtf.webp) |
| 武器库 | 偏好设置 |
| ![武器皮肤历史](docs/images/arsenal.webp) | ![主题与设置](docs/images/preferences.webp) |

## 开发与构建

`main` 分支提供 1.1.0 应用源码。需要与已发布安装器**对应的交付源码包**，请下载 Release 附件 **`TFX-Launcher-1.1.0-Source.zip`**。

Windows x64，使用 **Node.js 22.12+**，推荐 Node.js 24：

```powershell
npm ci
npm start
```

```powershell
npm run build:win      # 构建新版 NSIS 安装器
npm run dist:portable  # 保留的 electron-builder 便携版构建
```

运行时固定为 **Electron 43.1.1**。安装器工程附构建工具、品牌图和卸载清单生成逻辑。目录结构、离线运行时构建方式及验证范围见 [BUILD.md](BUILD.md)。已有测试保留为 `npm test`；历史测试不代表已经完成所有 1.1.0 实际游戏场景验证。

## 支持与贡献者

问题与建议请提交 [GitHub Issue](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/issues)，或邮件联系 **harrycaoguitar@gmail.com**。请附启动器版本、模式 / 网络、操作步骤与完整报错。分享日志前移除账号令牌并检查个人路径。

**作者：** HarryCao  
**合作伙伴：** southstar

**特别鸣谢**，保留原有顺序：

- **Northstar**
- **NorthstarCN**
- **Glock-雨夜**
- **HK560**
- **zxcPandora**

同时感谢 **CrazyZhang666 / EAappEmulater**、**Icepick** 项目，以及所有上游开发者、测试与反馈玩家。

TFX 是基于 ViperCN 1.11.3 的 **GPL-3.0-or-later** 衍生项目，保留继承内容的署名与对应源码义务。参阅 [LICENSE](LICENSE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)；客户端、模组、字体与工具遵循各自许可。

TFX 为社区项目，与 Respawn Entertainment 或 Electronic Arts 无隶属或背书关系。《泰坦陨落 2》名称与素材属于各自权利人。
