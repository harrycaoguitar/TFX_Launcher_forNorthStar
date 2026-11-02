# TFX Launcher

**English** · [简体中文](README.zh-CN.md)

### Northstar CN & Global. EA accounts. Mods and skins. One launcher.

TFX is a Windows launcher for **TITANFALL 2**, combining **Northstar**, **Northstar Global**, vanilla game launching, an integrated **EA Emulator**, and a unified **Icepick / Northstar Mod / DDS / VTF** installation workspace.

[**Download 1.1.0**](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/releases/tag/1.1.0) · [**Latest release**](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/releases/latest) · [Report an issue](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/issues) · [Build from source](BUILD.md)

![TFX Northstar launch screen](docs/images/play.webp)

> Screenshots in this README show the previously released **1.0.3** interface. They illustrate the workspace; newer 1.1.0 features are described below. Example servers, paths and counts are demonstration data.

## What's new in 1.1.0

- **Separate CN / Global installation folders:** choose dedicated folders on supported NTFS drives and prepare each client independently.
- **EA Emulator workspace:** sign in, switch accounts by signing out and signing in again, and manage the integrated service in its own page.
- **Icepick integration:** import campaign mods from the unified installation page; manage them separately at the bottom of My Mods.
- **Vanilla page fix:** switching to the original game retains its page content and launch controls.
- **New setup wizard:** branded artwork, a selectable installation folder, optional shortcuts and five installer languages.
- **Version consistency:** interface and executable metadata identify the launcher as 1.1.0.

[Read the bilingual release notes](RELEASE_NOTES_1.1.0.md).

## What you can do

| Workspace | Features |
|---|---|
| Start Game | NorthstarCN, Northstar Global and vanilla modes; client installation state and game-folder selection |
| Community Servers | Search the selected network's public directory by name, map or mode and inspect player counts |
| My Mods | Search, sort, enable and remove multiplayer mods; optional separate enabled-state profiles |
| Mod installation | Automatically identify compatible Icepick, Northstar Mod, DDS and VTF content dropped into one workspace |
| Icepick management | A dedicated campaign-mod section, separate from multiplayer mods |
| Arsenal | Browse skins by weapon and restore available DDS / VTF history or original resources |
| EA Emulator | EA sign-in, account status, service status and diagnostic actions |
| Preferences | Ten themes, five interface languages, launch settings, maintenance and update controls |

## Download and install

**Windows x64.** A purchased, installed copy of TITANFALL 2 is required. TFX does not include the game. Prepare a working Steam / EA environment and enough free space for client folders, caches and skin backups.

1. Open the [1.1.0 release](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/releases/tag/1.1.0) and download **`TFX-Launcher-1.1.0-Setup.exe`**.
2. Select **简体中文, 繁體中文, English, Deutsch or Français** in the installer.
3. Choose your installation folder and whether to create a Desktop shortcut. Start Menu shortcuts and an uninstaller are included.
4. Open TFX and confirm the existing game folder containing `Titanfall2.exe`.
5. Select a launch mode and network. Install the selected client when prompted, then launch.

The default launcher location is `%LOCALAPPDATA%\Programs\TFX Launcher`. **The launcher installation folder and the game/client folders are different settings.** Installer language is independent of the language saved inside TFX.

Close the old launcher before upgrading. Uninstall removes owned program files while retaining application-data settings and files you added separately. The current installer is unsigned.

## NorthstarCN and Global folders

Start from a valid installed game, then choose a **separate destination folder** for the CN or Global installation. An empty destination does not need to contain `Titanfall2.exe` in advance; TFX prepares it from the selected game source. Supported NTFS destinations can be on another drive. Keep the source and destination accessible, distinct and outside one another.

Prepare both clients once, then use the corresponding network and folder when launching. Separate client directories reduce repeated core-file replacement. Concurrent launches still depend on the platform, account session and the game's environment; separate folders do not guarantee every Steam / EA combination supports simultaneous play.

The launcher displays the actual selected client's version. **TFX 1.1.0 is the launcher version, not a Northstar client version.** The included fallback manifests identify NorthstarCN **1.17.7** and Global Northstar **1.31.13**; recognized newer local clients are handled separately. See [bundle provenance](src/tools/clients/SOURCE.md).

For the campaign and official multiplayer, choose **Vanilla**. Its **With Mods** mode uses VanillaPlus and compatible client-side mods. Prepare or repair the required components through the launch page; arbitrary Northstar server-side mods are not compatible with official multiplayer.

## Mods, Icepick and skins

Drop one compatible archive or complete folder into **Mod installation**, or use the file/folder selector. TFX inspects the contents, highlights the matching **Icepick / DDS / VTF / Mod** type and routes it to the appropriate installation flow.

| Content | What to keep |
|---|---|
| Icepick campaign mod | Its complete package structure and the correct Icepick destination |
| Northstar multiplayer mod | A valid `mod.json` and the associated resources |
| DDS skin | Original DDS filenames and all required files |
| VTF skin | The full materials / models structure and associated assets |

A readable ZIP, 7z or RAR still needs compatible contents. Import one package at a time and keep the game closed while resources are changed.

**Icepick mods have their own management section at the bottom of My Mods.** Select the Icepick directory there, then refresh, enable, disable or remove campaign mods independently. They are not mixed into the Northstar multiplayer list. The installer does not bundle the full Icepick campaign framework; select an appropriate existing installation.

For multiplayer mods, My Mods provides search, sorting, toggles and removal, alongside Thunderstore discovery. Optional server profiles remember enabled states for Official, CN and Global; they do not isolate every resource or native plugin into a separate game copy.

The **Arsenal** groups recognized skins by weapon. Select an available historical DDS / VTF state or restore original resources. Keep the required backups and finish any interrupted recovery before another installation. A mod can override a weapon's resource skin, so disable the overriding mod if needed.

## EA Emulator and accounts

Open **EA Emulator** from the navigation bar to sign in, inspect the current account and check service status. To use another account, sign out and sign in again. Complete sign-in in the provided EA login window. The integrated service uses a local connection; the page exposes diagnostic and repair actions for supported conditions.

When the service is active, the window's close action offers **exit and stop the service**, **keep running in the tray**, or **cancel**. A tray session keeps the service available; choose exit from its menu to stop it. Account validity, game ownership and platform requirements still apply.

## Interface gallery

These are historical 1.0.3 screenshots, not fresh 1.1.0 captures.

| Mod management | Community servers |
|:---:|:---:|
| ![Search and toggle mods](docs/images/mods.webp) | ![Browse community servers](docs/images/servers.webp) |
| DDS installation | VTF installation |
| ![DDS installation](docs/images/dds.webp) | ![VTF installation](docs/images/vtf.webp) |
| Arsenal | Preferences |
| ![Weapon skin history](docs/images/arsenal.webp) | ![Themes and preferences](docs/images/preferences.webp) |

## Development

The `main` branch contains the 1.1.0 application source. For the **exact distributed source package**, use the attached **`TFX-Launcher-1.1.0-Source.zip`** release asset.

On Windows x64 with **Node.js 22.12+** (Node.js 24 recommended):

```powershell
npm ci
npm start
```

```powershell
npm run build:win      # Branded NSIS setup installer
npm run dist:portable  # Existing electron-builder portable output
```

The runtime is pinned to **Electron 43.1.1**. The installer project includes its build tools, artwork and uninstall manifest generation. See [BUILD.md](BUILD.md) for the folder layout, offline-runtime build option and verification scope. Existing tests remain available through `npm test`; historical tests are not a claim of complete 1.1.0 game-session coverage.

## Help and contributors

For support, open a [GitHub Issue](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/issues) or email **harrycaoguitar@gmail.com**. Include the launcher version, selected mode/network, steps and the exact error. Omit account tokens and review personal paths before sharing logs.

**Author:** HarryCao  
**Partner:** southstar

**Special thanks**, in the original order:

- **Northstar**
- **NorthstarCN**
- **Glock-雨夜**
- **HK560**
- **zxcPandora**

Thanks also to **CrazyZhang666 / EAappEmulater**, the **Icepick** project, and all upstream developers, testers and players who contributed feedback.

TFX is a **GPL-3.0-or-later** derivative of ViperCN 1.11.3. Inherited attribution and source obligations remain. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); bundled clients, mods, fonts and tools retain their respective licenses.

TFX is a community project, with no affiliation with or endorsement by Respawn Entertainment or Electronic Arts. TITANFALL 2 names and assets belong to their respective rights holders.
