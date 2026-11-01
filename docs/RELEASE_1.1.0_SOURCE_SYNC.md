# TFX Launcher 1.1.0 — repository synchronization

Date: 2026-11-01 (Asia/Shanghai).

## Scope / 范围

The repository was synchronized from the published `TFX-Launcher-1.1.0-Source.zip` source asset. All **360 files under `src/`** match that source byte-for-byte. This operation did not change the distributed application logic or replace the uploaded Setup.exe and Source.zip assets.

仓库同步已发布的 1.1.0 源码，并更新英文 / 简体中文 README、构建文档、发布说明和第三方工具署名。保留原仓库历史、测试、截图和许可证。安装器源码与构建工具加入 main，旧的便携构建保留为 `npm run dist:portable`。

The starting repository commit was `462afc2f53982c7078b16ddad414ec1a30001f73` (1.0.7). `package.json` and the lockfile now use **1.1.0**. The repository's development scripts and retained tests are additional material beyond the recovered release source archive.

The synchronization check matched all 360 runtime files, passed `node --check` for all **144 JavaScript source files**, checked relative links in both READMEs and BUILD.md, and retained **76 historical test files**. Package and lockfile versions agree at 1.1.0.

The synchronized repository's `build/Build.ps1` also completed a fresh installer build using the existing Electron 43.1.1 runtime and Windows PowerShell. Compiler exit status: **0**; output size: **288,371,078 bytes**. This repository build includes the updated development scripts in package metadata, so it is not claimed to be byte-identical to the previously uploaded setup asset. It was not uploaded over that release asset.

## Verified for the distributed build / 发布包既有验证

Records are retained under [`release-verification/`](../release-verification/):

- Branded five-language NSIS installer compiled successfully.
- Silent installation into a custom folder containing Chinese characters and spaces returned exit code **0**.
- **121 installed files** matched the built application files.
- Executable FileVersion and ProductVersion: **1.1.0.0**.
- Interface version: **1.1.0**; About version: **v1.1.0**.
- Vanilla page: **57 visible elements**, with a visible launch button; returning to Northstar retained its launch button.
- Uninstall returned exit code **0**, removed the application, and preserved the test profile and a separately added file.
- Version baseline / modified / rollback checks observed **1.0.7 → 1.1.0 → 1.0.7** on separate copies; rollback hashes matched the baseline. HTML checks reproduced the nested-container fault, passed after the closing-tag fix, and reproduced it on a restored copy.

These checks did **not** start an EA service or complete an actual game session. Desktop screenshot capture timed out during installer visual checks; the five compiled language tables and custom-path installation were verified, while every interactive wizard language was not exercised end to end.

## Existing automated suite / 历史测试结果

The retained tests are **not fully passing** on this synchronization. No failing tests were removed or rewritten to hide these results.

| Checkout / command | Observed outcome |
|---|---|
| Original repository, `npm test` | 891 tests: **851 passed, 40 failed** |
| Synchronized source, `node --test --test-timeout=30000 test/*.test.js` | 891 tests: **734 passed, 156 failed, 1 cancelled** |

The original checkout contained converted text files that failed some payload/hash expectations. The synchronized tree preserves the release bytes through `.gitattributes`. Further failures include old renderer/layout expectations and mocked module interfaces that differ from the newer directory and launch implementation. These categories do not establish that every failure is harmless; they require separate investigation before a claim of a clean full-suite result.

An initial unbounded synchronized run stalled in `test/northstar-install.test.js` and was terminated. The bounded run timed out a test that waits for an older mocked `ensure` call; its worker retained a live polling loop and was stopped so the runner could report the outcome above. The reported result includes that interruption, rather than treating it as a pass.

历史测试存在失败，不能据此声称 1.1.0 全部功能通过。此次同步按发布包保留应用源码，未为了让旧断言通过而修改游戏逻辑。后续开发应逐项排查失败，更新适用的测试夹具，并补充实际登录、安装和游戏会话验证。

## Documentation accuracy / 文档口径

- Main README screenshots remain explicitly labeled **historical 1.0.3** screenshots.
- The current EA implementation stores a current account and offers sign-out/sign-in. The README describes that workflow; it does not claim a persistent list of multiple saved accounts or one-click account selection.
- Bundled fallback manifests identify **NorthstarCN 1.17.7** and **Global 1.31.13**. The launcher release version 1.1.0 is separate from those client versions.
- Icepick campaign mods use an existing Icepick installation. The external campaign framework is not claimed as bundled TFX code.
- For the exact published source delivery, use the manually attached **TFX-Launcher-1.1.0-Source.zip**, rather than assuming GitHub's tag-generated archives contain the same tree.

## Distributed artifact hashes / 已发布文件校验

```text
E721B7DF5F89CF1D0D8B133CCD59A6C0084A82CD2EB402CABDA1E600AF334EE3  TFX-Launcher-1.1.0-Setup.exe
A05B1CB6CA875551900765A474D5769F21549CABFE1879B4263F03A260733742  TFX-Launcher-1.1.0-Source.zip
```

The installer is unsigned. The original release ZIP and the locally delivered 1.1.0 artifacts were not modified by the repository synchronization.
