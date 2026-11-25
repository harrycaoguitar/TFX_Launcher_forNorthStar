# 从源码构建 TFX Launcher 2.0.0

## 环境要求

1. **Windows 10 / 11 (x64)**，已安装 Microsoft Edge WebView2 Runtime（Windows 11 默认自带）。
2. **Rust 工具链**（`rustc` >= 1.85，`cargo`）：
   - 支持 `x86_64-pc-windows-msvc` 或 `x86_64-pc-windows-gnullvm`（配合 `llvm-mingw-ucrt`）。
3. **打包 NSIS 安装器所需工具**（可选，仅执行 `Build-Tauri.ps1` 时需要）：
   - [NSIS 3.x](https://nsis.sourceforge.io/)（`makensis.exe`）
   - [rcedit](https://github.com/electron/rcedit)（`rcedit-x64.exe`，用于写入 `.exe` 版本元数据与图标）

## 1. 运行 Rust 单元测试

```powershell
cd src-tauri
cargo test --lib
```

## 2. 编译 Release 主程序

```powershell
cd src-tauri
cargo build --release
```

编译产物位于 `src-tauri\target\release\`：
- `tfx-launcher-tauri.exe`
- `WebView2Loader.dll`（使用 `gnullvm` 目标构建时必须与主程序位于同一目录）

## 3. 打包绿色版与 5 语言 NSIS 安装器

在项目根目录执行：

```powershell
# 自动查找 PATH 中的 makensis/rcedit 或同级 ..\TFX-Launcher\build-tools\
.\Build-Tauri.ps1

# 或手动指定工具目录（包含 build-tools\rcedit-x64.exe 与 build-tools\nsis\Bin\makensis.exe）
.\Build-Tauri.ps1 -ToolsRoot "D:\path\to\tools-root"
```

构建完成后将在 `dist\` 下生成：
- `dist\TFX-Launcher-2.0.0\`：免安装绿色版目录
- `dist\TFX-Launcher-2.0.0-Setup.exe`：5 语言图形化安装程序（支持简中 / 繁中 / EN / DE / FR）
