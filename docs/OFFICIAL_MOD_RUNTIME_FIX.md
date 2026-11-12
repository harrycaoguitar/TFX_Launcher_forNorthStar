# Original game with Mods: framework correction / 原版带 Mod 框架修复

## Changes / 修改

“原版带 Mod”现在检查原版游戏根目录内的国际服北极星框架。独立国际服目录内的框架不再被当作原版目录的安装状态；缺失、国服、损坏及过旧框架分别显示安装、替换或修复提示。只有 VanillaPlus 组件自身损坏时才提示修复 VanillaPlus。

检测到国服框架时，由主进程弹窗确认目标目录。取消不写入；同意后通过现有文件事务备份并替换国服加载文件及三套官方核心模组，清除旧核心脚本，写入完整国际服框架。个人模组和独立客户端目录保留，替换失败恢复原文件。确认期间目录改变或游戏开始运行会阻止写入。

With Mods now checks the Global Northstar framework in the original game folder. A framework in the separate Global client folder no longer satisfies this prerequisite. Missing, CN, damaged and outdated frameworks have distinct install, replace or repair guidance. VanillaPlus repair is reserved for its own component problems.

CN replacement requires a main-process confirmation showing the target folder. Cancel writes nothing. Confirmation uses the existing file transaction to back up and replace CN loaders and the three official core mods, remove stale core scripts and install the complete Global framework. Personal mods and separate client folders are preserved. Failed replacement restores the original files. A directory change or game process starting during confirmation blocks writes.

## Verification / 验证

- Targeted source tests: 67 passed, 0 failed, including client manifests, rotation and recovery, VanillaPlus, original-root runtime selection, renderer actions and five-language error guidance.
- Package-backed runtime tests: 14 passed. The original and previous 1.1.1 archives each fail 13 of these 14 new expectations; a rolled-back copy reproduces those failures and matches the pristine archive hash.
- Packaged renderer: 32 checks passed for five-language framework actions, guidance and canceled replacement. Status/install replies are controlled fixtures; no real game files are changed.
- Existing packaged UI smoke: 18 checks passed, including navigation, languages, directory controls and integrated Icepick.
- All 449 packaged application source/assets match the repository. The binary patch reconstructs the corrected ASAR exactly. The supplied original directory's 126 recorded hashes remain unchanged.

以上替换验证使用临时游戏目录、有效测试清单及 PE 文件；未启动真实游戏或替换用户实际游戏目录。历史测试套件仍有与本次修复无关的失败，未据此宣称全套测试通过。

Replacement checks use temporary game folders, valid fixture manifests and PE files. No real game session or replacement of a player's actual game root was performed. Unrelated historical suite failures remain; this report does not claim the entire suite passes.

This correction leaves the published 1.1.1 tag and release assets unchanged. / 本次源码修正不移动已发布的 1.1.1 标签或覆盖其发布附件。

## Corrected local installer / 本地修订安装包

- Five-language NSIS Setup completed successfully. Silent install to a fresh selected Chinese path returned exit 0; all 121 installed application files match the build, and the uninstaller exists.
- Corrected ASAR SHA-256: `b1541d2fd81e5543cb1f23ec32b3fe5235c88910bc2819b183d09c9107d9d9ca`.
- Corrected Setup SHA-256: `4d3142b7f2acfdf6e449339bac49978a70add30c0c7ae007dc81d5fa2667b21d`; 288817113 bytes.
