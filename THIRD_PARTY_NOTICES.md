# 来源与第三方组件

TFX Launcher 是基于 ViperCN 1.11.3 的衍生项目。原启动器由 R2NorthstarCN / 0neGal 等贡献者维护，源项目：https://gitee.com/R2NorthstarCN/viper-cn 。沿用代码继续遵守 GPL-3.0-or-later；许可全文见 LICENSE。新增实现不能取消沿用部分的许可、署名和提供源码义务。

TFX 独立重新实现模组目录索引、开关与删除控制、模组管理界面、社区目录浏览、网络资源读取、Thunderstore 依赖计划与事务下载安装。Thunderstore 仍是数据和模组包提供方，来源：https://thunderstore.io/c/northstar/ ，公开目录接口：https://thunderstore.io/c/northstar/api/v1/package/ 。兼容旧配置和界面调用名称属于接口契约；旧模组管理、下载和前端依赖队列实现已替换。该工作以现有项目接口与行为为参照，不构成隔离净室重写，也不能因此宣称整个启动器脱离 GPL 来源。每个下载模组的作者、包内 LICENSE 和其他文件随模组原样保留；模组版权属于对应作者。

DDS 导入、格式与尺寸校验、声明式资源匹配、安装计划、局部备份、写入校验和恢复使用本项目的 JavaScript 实现。产品不包含或执行 Titanfall2-SkinTool、FoldDdsPlan 或其 .NET 依赖。src/modules/data/dds-layout-tf2.json 是对用户提供工具进行元数据兼容性查询测得的游戏资源位置事实，数据内保留来源与参考文件哈希。它不是独立发现所有游戏布局的通用 RPAK 解析器，也不包含参考工具的程序实现。开发所用参考工具不随运行包或源码包分发。用户提供的皮肤包及其图片不随产品分发；皮肤版权属于各自作者。

Steam KeyValues 解析器为新增实现，原 simple-vdf 依赖已移除。其余生产依赖 follow-redirects、fs-extra、fuse.js、jsonrepair 及传递依赖的许可随 node_modules 保留。Electron、Chromium、Node.js 与运行时使用的其他组件许可随目录版/便携包保留。

Roboto 2.137（2017）字体：Copyright 2011 Google Inc. All Rights Reserved.，采用 Apache License 2.0。字体原字节保持不变，完整许可、NOTICE 与官方来源记录见 src/app/fonts。部分旧 npm 包原发布包仅包含 MIT 声明；补附许可的确切来源和依据保存在各包的 NOTICE / LICENSE-SOURCE 中，未将补附文本冒称为原发布包内的许可文件。

VTF 安装模块 vtf-engine.js、vtf-vpk.js 为新增 JavaScript 实现。开发时参考 MIT 许可 tf2vpk 的 Titanfall 2 VPK 2.3 格式实现与 Northstar 公开源码。相关格式参考、来源与 MIT 许可保存在 src/tools/vtf/SOURCE.txt 和 tf2vpk-LICENSE.txt。用户提供的 VPK GUI 工具不包含在产品中。

压缩包读取使用未修改的 7-Zip 26.04 7z.exe/7z.dll 与 21.07 7za.exe 兼容回退。7-Zip Copyright Igor Pavlov；本体主要采用 GNU LGPL 2.1，部分代码采用 BSD，RAR 解压代码有 unRAR 限制；7zip-bin 包装包为 MIT。完整许可、LGPL 全文、对应版本源码下载地址保留于 src/tools/vtf。官方来源：https://github.com/ip7z/7zip 。

TITANFALL 2 题标来自 Steam Titanfall®2（app 1237970）官方店铺公开素材 https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1237970/logo.png 。仅裁去透明边缘；游戏、题标和其他原有游戏素材权利属于 Respawn Entertainment / Electronic Arts 及各自权利人。游戏识别用途不表示官方认可。原有素材署名继续保留。

国服与全球服客户端随 1.0.0 提供离线安装数据：NorthstarCN 1.17.7（R2NorthstarCN/R2NorthstarCN_Launcher）与 Northstar 1.31.13（R2Northstar/Northstar）。启动器的文件清单、缓存及带回滚的切换实现为新增 JavaScript 模块；两套客户端本身是官方第三方软件，不能称为本项目原创。对应来源、版本、下载与逐文件哈希见 src/tools/clients/SOURCE.md、各频道 manifest.json；原有 LEGAL.txt、MIT、Apache 2.0 与其他组件许可见客户端数据和 licenses 目录。当前游戏的国服 1.18.0 只在用户本机保存私有快照，不随产品分发。

全球客户端中的 rAnim 与 serialized_io 公开源仓库声明 Apache-2.0；截至 2026-10-14，DiscordRPC 官方插件源仓库没有独立 LICENSE 或 Cargo license 声明，GitHub 许可元数据为 null。TFX 1.0.0 离线客户端数据因此省略该可选 DLL，只保留其来源、路径、原字节 SHA-256 和省略原因，不将客户端总体 MIT 声明冒称为该插件的独立再分发许可。省略影响 Discord Rich Presence，核心客户端、私人服务器菜单与联机模块均保留。用户自行通过启动器从官方发布下载完整客户端更新时，官方文件原样安装，该运行时下载不在 TFX 发行包内再分发。未来若要重新捆绑该插件，需明确适用的上游许可或授权。详见 src/tools/clients/SOURCE.md 与全球服 manifest.json 的 source.optionalOmissions。

1.0.0 的 DDS ZIP 读取复用本项目有界 ZIP 校验器，已移除 unzip-stream 及其未再使用的传递依赖。生产依赖版本与开发工具固定在 package.json / package-lock.json，现有组件的署名与许可继续保留。

缺失原版皮肤资源的可选下载使用 SteamRE 社区维护的 DepotDownloader 3.4.0。它不是 Valve 或 Electronic Arts 官方程序；游戏资源字节由 Steam 提供。TFX 的选择、隔离缓存和校验适配器为新增 JavaScript 实现，通过公开命令行调用未经修改的上游程序，不包含其 C# 实现。该工具不随启动器运行包捆绑，只有用户选择单独下载资源时才按固定 SHA-256 从上游发布页获取；缓存保留其原 LICENSE。DepotDownloader 采用 GNU GPL version 2，来源与许可：https://github.com/SteamRE/DepotDownloader 和 https://github.com/SteamRE/DepotDownloader/blob/DepotDownloader_3.4.0/LICENSE 。其发行程序的 SteamKit2、QRCoder 等依赖仍遵守各自上游许可。版本、ZIP 与可执行文件哈希、下载流程及隔离范围见 docs/STEAM_RESOURCE_DOWNLOAD.md。TFX 不执行 Steam 全游戏验证，不传入账号密码或记住密码选项；独立登录环境在完成或取消后清理。此可选调用不改变 TFX 已有的 GPL-3.0-or-later 来源与署名义务。

官服带 Mod 模式使用 VanillaPlus 2.5.1，作者来源：https://github.com/NachosChipeados/NP.VanillaPlus ，发布来源：https://thunderstore.io/c/northstar/p/NachosChipeados/VanillaPlus/2.5.1/ 。该兼容组件由 Nanohm 制作、Cyn 重制、NachosChipeados 更新，采用 MIT 许可，Copyright (c) 2023 NanohmProtogen。其代码与原始 LICENSE、README、FAQ 随组件保留；TFX 的校验、安装事务和启动模式集成为独立新增实现，不能把 VanillaPlus 宣称为本项目原创。包内 Lato Regular 2.015 与 Northstar Mono 3.206 字体未经修改，采用 SIL Open Font License 1.1；本次已核对原字体内嵌版权与许可并补附完整 OFL 和来源。对应字节清单、原始 ZIP 哈希、字体版权与补充许可出处见 src/tools/vanilla-plus/manifest.json、SOURCE.md 和 payload/FONT-NOTICES.txt。

## 1.1.0 integration and build-tool additions

- EA connection/account integration references CrazyZhang666's EAappEmulater project: https://github.com/CrazyZhang666/EAappEmulater/releases/tag/1.9.1.3 . TFX's JavaScript integration and XML protocol templates are present under src/modules/ea-*.js and src/resources/ea-lsx. This attribution does not claim that the upstream emulator or EA protocol is original TFX work; consult the upstream project for its terms.
- Icepick is an external Titanfall 2 campaign-mod framework (https://titanfallmods.com). TFX provides directory discovery, package import and separate mod management; the full Icepick executable/SDK is not bundled by this integration. Installed campaign mods retain their own authorship and licenses.
- NSIS 3.0.4.1 is included for the setup build; its copyright and license texts are retained in build-tools/nsis/COPYING.
- @electron/asar 4.3.1 and its build dependencies retain the package licenses and notices under build-tools/asar/node_modules.
- rcedit 2.0.0 is distributed under MIT; the full notice is in build-tools/rcedit-LICENSE.txt. Source: https://github.com/electron/rcedit/tree/v2.0.0 .

1.1.0 的安装器工具、客户端、框架、模组和其他第三方资源继续保留各自署名与许可。EA 与 Icepick 集成不代表这些上游项目为 TFX 原创，也不表示 Electronic Arts 官方背书。