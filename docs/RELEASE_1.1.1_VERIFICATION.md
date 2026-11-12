# TFX Launcher 1.1.1 Release Verification

## Delivered build

- Windows x64 installer: `TFX-Launcher-1.1.1-Setup.exe`.
- The installer contains Simplified Chinese, Traditional Chinese, English, German and French language tables, a selectable installation directory, optional desktop shortcut, Start Menu shortcuts and an uninstaller.
- Setup was run silently with `/LANG=1033 /D=D:\TFX-111-Install-QA\自选目录`; it returned exit code 0. All 121 installed application files matched the staged build, and `Uninstall.exe` was present.
- Renderer smoke tests on both the staged app and installed app passed 18/18 checks, including five interface languages, directory selection, integrated Icepick format recognition and hidden legacy route behavior.

## Regression checks

- Original-game Mod framework checks passed 67 targeted source tests, 14 package-backed behavior tests and 32 renderer checks covering five-language actions and canceled replacement. The launcher requires Global Northstar in the original game folder, confirms CN replacement, preserves personal Mods and supports a fresh profile directory. See `OFFICIAL_MOD_RUNTIME_FIX.md` for the tested scope.
- The original supplied application directory's 126 recorded file hashes remained unchanged.
- Installation tests passed for nested and non-empty directories, same and cross-volume targets, and targets where filesystem metadata could not be queried. The CN and Global clients remain prevented from sharing the same physical destination.
- Space-plan tests passed for excluding captured screenshots and movie frames while retaining nested game resources. A real Steam source estimate with a 100 GiB budget stopped at the pre-copy gate; no full game copy was performed.
- Icepick format, import recognition and removal of the standalone Icepick page passed targeted checks.
- Baseline / modified / rollback checks reproduced the old failure, observed the corrected behavior, and reproduced the old failure after rollback. Restored archive SHA-256 matched the pristine baseline; the binary patch reconstructed the modified archive exactly.

## Full test suite

`node --test --test-timeout=15000 test/*.test.js` reported 891 tests: 734 passed, 156 failed and 1 cancelled. This is the same result recorded for the synchronized 1.1.0 source. The legacy suite is not clean; the targeted 1.1.1 checks above are reported separately.

The launcher UI was exercised in isolated Electron profiles. No EA service, network client installation or actual game session was started.
