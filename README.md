# TFX Launcher

**English** · [简体中文](README.zh-CN.md)

**Two Northstar networks. One launcher. DDS, VTF and Mods—drop them in and play.**

TFX brings **Northstar Global** and **NorthstarCN China** to one TITANFALL 2 installation. Choose a network, launch the matching client, and keep your community play in one place. A unified installer recognizes DDS skins, VTF skins and Northstar Mods automatically; the Arsenal organizes skins by weapon and lets you return directly to a valid historical skin or the original.

[Download TFX 1.0.7](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/releases/tag/v1.0.7) · [Report a problem](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/issues) · [Build from source](BUILD.md)

The latest stable release is **[1.0.7](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/releases/tag/v1.0.7)**. This release provides a Windows x64 installer for the launcher. The gallery shows the released 1.0.3 interface.

![TFX Northstar launch screen](docs/images/play.webp)

| Your next session | What TFX does |
|---|---|
| Global or China | Prepare both clients once, then select **Northstar** or **NorthstarCN** without managing client files by hand. |
| A new look | Drop a compatible **DDS, VTF or Mod** package into one installer. TFX identifies, checks and installs it automatically. |
| A previous skin | Open the **Arsenal**, select a weapon and restore a valid historical skin directly—even across linked DDS / VTF installations. |
| Different Mod setups | Optionally remember **enabled Mods separately for CN and Global**. The default remains a shared setup. |
| A server to join | Browse either network's public server directory, with search, maps, modes and player counts. |
| Your own workspace | Use searchable Mod cards, Thunderstore downloads, ten themes and five interface languages. |

### A closer look

These are actual **English TFX 1.0.3** screens. Numbered packages, servers, paths, counts and installation states are isolated demonstration data; the screenshots do not show live availability or users' content.

| Searchable Mod management | Community server browser |
|:---:|:---:|
| ![Search, sort and toggle Mods](docs/images/mods.webp) | ![Vertical server list with search and player counts](docs/images/servers.webp) |
| **DDS** · automatic checks and installation | **VTF** · the same unified drop zone |
| ![DDS package received and installation progress](docs/images/dds.webp) | ![VTF package received and installation progress](docs/images/vtf.webp) |
| **Arsenal** · skins and restoration by weapon | **Preferences** · themes, language and launch controls |
| ![Weapon catalogue and selectable historical skins](docs/images/arsenal.webp) | ![TFX preferences in English](docs/images/preferences.webp) |

## Get started

TFX is a **Windows x64 installer** that installs a portable launcher for the current user. The installed application folder uses about 316 MiB. You need a purchased, installed copy of TITANFALL 2, a working Steam / EA environment, and free space for client files, package staging and recovery data. The game is not included.

1. Run `TFX-Launcher-1.0.7-Setup.exe` from [Releases](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/releases/latest).
2. Let TFX detect the game, or select the game root containing `Titanfall2.exe`. Choose the actual game folder, rather than `steamapps`, `common` or a Mod subfolder.
3. Open **Northstar**, select **CN** or **Global**, and install that client if TFX reports it is missing.
4. Launch. Complete any platform sign-in or ownership confirmation in Steam / EA if requested.
5. To add content, open **Skin installer** and drop one package or folder on the left. TFX displays its name immediately, detects its contents, and starts the appropriate installation after validation.

Use the latest release's acceptance document for the exact tested scope. External services, packages and game installations can differ from the demonstration and test fixtures.

## Launching Northstar and NorthstarCN

TFX tracks the two client installations separately. A cached archive is not treated as an installed client. The bundled first-install data contains **NorthstarCN 1.17.7** and **Northstar 1.31.13**; internet access is still required for online play.

After both clients are prepared, switching uses the corresponding prepared core files rather than extracting the whole release again. Personal Mods and skin resources are retained. Recognized newer local clients are preserved; TFX does not silently replace them with an older bundled version. The selected client's actual version and installation status appear on the launch screen.

- **Install or repair:** The selected network has its own installation state and action. Install it first, then launch.
- **Client updates:** Check the selected Northstar client's releases, refresh its version or reinstall from Preferences. Client updates and TFX updates are separate.
- **Launch feedback:** TFX checks the game process and Northstar menu loading. Failure, platform handoff and an early game exit release the launch state with feedback.
- **File-operation protection:** Client replacement and skin writes are blocked while the game is running. A changed destination or profile stops an operation before it commits to the wrong location.
- **Lower background use:** **Exit TFX after the game starts** is off by default. When enabled, TFX exits after a confirmed successful launch and stays open if launching fails.

**Vanilla** remains available for the campaign and official multiplayer, through the normal Steam / EA launch environment.

### Official-server Mods and three-server states

**Included in stable 1.0.4.** On the **Vanilla** launch screen, choose **Without Mods** or **With Mods**, using the same selector style as Northstar's CN / Global choice. **Without Mods** uses the normal Steam / EA game launch. **With Mods** loads compatible client-side Mods while retaining official multiplayer; it does not connect to a Northstar community network.

Before the first **With Mods** launch, use the page's installation action to prepare **VanillaPlus 2.5.1** and a compatible **Northstar Global runtime, version 1.29.0 or newer**. A missing, damaged or outdated component is shown as needing installation or repair. Checking its status does not start a download or the game. The installer validates the bundled VanillaPlus files, prepares the global runtime and reports progress; installation and repair require the game to be closed. TFX selects the necessary core components for each launch mode, so switching back to Northstar restores its community menus.

Official Mod mode keeps the purchased game's Steam / EA launch identity. A strictly matched Steam installation is dispatched through Steam with the same controlled game arguments; other installations use `Titanfall2.exe`. TFX still waits for a new game process and evidence that VanillaPlus reached the main menu. A Steam / EA confirmation, if required by the platform, must be completed there.

VanillaPlus supports **compatible client-side Mods**, rather than every Northstar Mod. Mods that depend on a custom server, alter server-side gameplay or require Northstar-only services may fail in official multiplayer. Check each Mod's compatibility before enabling it. The framework, its authors and licenses are documented in [third-party notices](THIRD_PARTY_NOTICES.md).

**Preferences → Separate Mod states for three servers** replaces the preview's two-region setting and is **off by default**. When enabled, TFX remembers Mod switches separately for **Official**, **NorthstarCN** and **Northstar Global**. The three profiles start from the current choices; newly added Mods stay enabled on the current side and start disabled on the other sides. Only **Mod enabled states** are separated. Installed package files, native plugins, DDS skins and VTF skins remain shared; this is not three copies of the game or plugin-code isolation. Leaving the option off retains shared personal Mod choices, while the required compatibility components still follow the selected launch mode.

For **Without Mods**, TFX temporarily neutralizes the recognized Northstar autoload proxy and `run_northstar.txt` marker, then restores the prior files after launch handoff or a failed launch. A recovery journal covers interrupted operations and refuses to overwrite external changes. This choice controls loader-based Mods; it does not uninstall shared DDS / VTF skins. Keep externally configured Steam / EA launch options consistent with the selected mode.

## Community servers

**Community Servers** has a vertical public directory for the selected network. Search by server name, map or mode, and inspect players / capacity, descriptions and required Mods. More populated servers appear first. The page uses the same scrolling area as the rest of the app.

The visible directory can be refreshed manually and refreshes periodically while relevant pages are visible. Polling pauses when it is unnecessary. Unavailable results and cached data are distinguished. The Northstar home screen retains the selected public directory's player total; it is not a count of every player on the entire network. Times and refresh timestamps follow your computer's system clock.

Browse here, then join through the matching client's in-game server browser. The launcher does not directly join a server from this list.

## Mods: search, sort, download and separate region states

**My Mods** displays cards with names, authors, descriptions and enabled states. Search matches these fields. The app-styled sorting menu offers **Added date**, **Name** and **Enabled state**. Toggles provide saving feedback, restore the actual state after a failure, and preserve the list's search and scroll position. Bulk controls are available; required core components are protected.

Open **My Mods → Discover Mods** for [Thunderstore's Northstar directory](https://thunderstore.io/c/northstar/). Search and filter packages, inspect dependencies, download with progress, or cancel. TFX stages and checks the planned content before committing it, and preserves or restores existing content after a failed installation. Native plugin packages require explicit confirmation. Each package keeps its author and licensing information.

For a local package, use **Skin installer**. A compatible archive or complete folder containing valid `mod.json` definitions is identified as a **Mod** and installed automatically. After installation, manage its switches and removal in **My Mods**. Invalid definitions, unsafe paths, damaged archives and mixed incompatible content produce explicit errors.

### Separate Mod states for CN and Global — released 1.0.3

Enable **Preferences → Separate Mod states by region** when the two networks need different enabled Mods. It is **off by default**.

- On first enable, both sides start with the current enabled-state setup. Later changes are remembered for the selected side only.
- Selecting another network applies that network's remembered enabled states. Switching waits for the state change to succeed; a failure keeps the previous selection.
- A Mod newly added on one side starts enabled there and disabled on the other side.
- Turning this option off keeps the current side's enabled states as the shared setup. Restoring default preferences turns it off.

This option separates **Mod enabled states only**. Installed package files, native plugin binaries, DDS skins and VTF skins remain shared. It does not provide a separate game installation or isolate plugin code.

## One installer for DDS, VTF and Mods

Drag one file or folder into the left-hand drop zone, or use its file / folder chooser. The received name appears on the left immediately. TFX identifies the **contents**, selects DDS, VTF or Mod processing, validates them and installs automatically. The right side shows checks and progress. Estimated progress is marked `≈`; completion reaches 100% only after the operation reports success. A completion notification appears in the lower-right corner.

| Content | Compatible input | Keep intact |
|---|---|---|
| DDS skin | A DDS file, complete skin folder, or readable supported archive such as ZIP, 7z or RAR | DDS resource filenames |
| VTF skin | A complete skin folder or readable supported archive such as ZIP, 7z or RAR | Associated materials / models folder structure |
| Northstar Mod | A complete Mod folder or readable supported archive with valid `mod.json` definitions | Mod definition and its resource structure |

A standalone VTF file lacks the package structure needed for installation. A readable archive still needs compatible content; a filename extension alone is not accepted as proof. Import one package at a time. A rejected import clears the pending selection, so it cannot accidentally install the last valid package.

**DDS checks** include headers, compression formats, dimensions, resource matching and resolution coverage. **VTF checks** include materials, model assets and archive structure. DDS → VTF and VTF → DDS replacement coordinate the same weapon's previous resources, reducing retained lettering, sights or incompatible model entries. Support depends on recognized game resources and valid package contents.

### Missing originals and selective repair

TFX first looks for verified original resources in its own cache or usable backups. When the required originals are missing, its repair flow can obtain **only the required original resources** into an isolated cache and then resume the skin operation. It does not ask Steam to validate the whole game and erase unrelated installed skins.

A selective Steam download may require signing in with an account that owns TITANFALL 2. TFX displays the instructions and QR flow when needed. You do not type a Steam password into TFX. Authentication is handled by the download helper connecting to Steam; TFX does not upload sign-in data to the author's server or cloud. The helper uses an isolated temporary sign-in profile, and secrets are not included in normal progress logs. Review Steam's confirmation before approving a sign-in.

The repair plan is tied to verified resource metadata for the installed game. If the local manifest, ownership, connection or available space cannot be verified, TFX explains the blocking step instead of writing guessed game data. You can also supply a trusted original-resource backup through the repair flow.

## Arsenal: choose a weapon, choose a skin

The **Arsenal** is part of the Skin installer page. Its catalogue has **40 weapons**, including Titan weapons and Titan melee weapons. Simplified and Traditional Chinese names and categories follow the game's official localization. Each weapon card has a matching silhouette; search finds weapon and skin names.

DDS, VTF and recognized Mod skins appear together under the relevant weapon. Resource paths provide the strongest ownership evidence; a package name alone does not prove a weapon match. Mod skins retain their **Manage Mod** action, because enabling and removing them belongs in My Mods.

For DDS / VTF history, select a weapon and use **Use this skin** on any valid linked historical entry. Selecting skin **A restores A's installed state**, rather than the state before A was installed. TFX handles the required intermediate steps automatically; you do not restore each newer record manually. You can select another valid historical target afterwards. **Restore original skin** returns that weapon to the linked original state.

The current target is labeled **Current**. Usable history is labeled **Available to restore**. Targets detected as unavailable are disabled with an explanation. The list checks record metadata and required archive availability; full payload integrity is verified before restoration writes begin. The list initially fits its visible rows to the weapon grid; **Show more records** expands the rest. Restoration has a confirmation, progress and a success notification. Only the selected weapon's DDS / VTF resources are changed; other weapons are preserved. An enabled Mod can still override that weapon in-game, so disable it in My Mods if needed.

If an interrupted installation needs recovery, use its separate recovery prompt **inside the Arsenal** before installing another skin. Such a recovery may include several linked weapons from the interrupted operation. Keep the game closed during installation or restoration, and retain recovery data while it is in use. TFX can clean abandoned cancelled or rolled-back caches only when they have no live recovery references; usable historical targets are retained.

## Preferences, appearance and language

TFX uses frosted translucent panels, rounded cards, short page transitions and motion-aware feedback. The window can be moved using its blank title-bar area. The app uses rounded window corners where supported by Windows.

Preview **Aurora, Abyss, Nebula, Sakura, Ember, Grove, Sandstone, Graphite, Glacier or Mist**. Glacier and Mist are light themes. Five languages are available: **English, 简体中文, 繁體中文, Deutsch and Français**. First use follows the system language: Chinese systems use Chinese and other systems start in English. A saved manual selection takes priority. Language and sort menus use TFX's own interface.

Normal preference edits, including language and theme previews, are saved together. If you leave with unsaved changes, choose **Save and leave**, **Discard and leave** or **Keep editing**. Failed saves retain your input. Separately acknowledged immediate switches, including skin protection and regional Mod states, are saved when changed.

| Group | Main controls |
|---|---|
| Appearance & language | Five languages, ten themes, live preview |
| Game launch | Game folder, launch arguments, exit after launch, regional Mod states |
| Skin launch protection | Enable protection, inspect or recapture recorded settings |
| Client updates | Automatic checks, version refresh, retained files, reinstall selected client |
| Connection | DNS cache and explicit DNS provider changes |
| Maintenance | Installation cache cleanup, process controls, launcher restart |
| About | HarryCao, support links, special thanks, TFX version and update check |

**Skin launch protection** applies to both DDS and VTF. It restores your recorded `setting.stream_memory` and `setting.mat_picmip` choices before launching from TFX. Capture settings after confirming your skins display correctly; this is not a universal graphics preset. It does not lock game options or install an extra UI Mod.

**Restore defaults** requires a deliberate hold to prevent accidental activation. It resets preferences, including regional Mod separation, without deleting the game, installed skins or required recovery resources.

## Updates, storage and troubleshooting

TFX checks its own releases at [this GitHub repository](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/releases). Northstar client checks use the selected client's release source. Updating one does not mean the other has updated.

Preferences use the Windows application-data directory. Client and package caches may prefer `D:/TFX-Launcher-Data` when that drive is available; prepared client files also use the game's `.tfx` area. DDS / VTF caches and recovery data remain in managed application-data locations. Use the app's installation-cache cleanup for disposable downloads. Do not manually remove skin recovery chains you may still need.

| Situation | What to check |
|---|---|
| Game not detected | Select the folder containing `Titanfall2.exe`. |
| Selected network is not installed | Install that specific client, then launch. |
| Steam / EA opens without the game | Complete any pending platform confirmation, then read TFX's launch result before retrying. |
| Download or server list unavailable | Check connectivity and refresh; cached data has its own timestamp. |
| Package is rejected | Read the content error; keep original filenames / structure and import one compatible package. |
| Original resource is missing | Use the selective repair flow or supply a verified original backup. |
| Historical skin is unavailable | Required recovery data is missing, damaged or disconnected; reinstall that skin. |
| Interrupted operation reported | Recover it in the Arsenal before another installation. |
| Skin still looks like a Mod | Disable the overriding Mod in My Mods. |
| Lower resource use during play | Enable exit after a successful game launch. |

## Build, support and acknowledgments

On Windows x64 with Node.js **22.12 or newer**:

```powershell
npm ci
npm test
npm start
npm run dist
```

See [BUILD.md](BUILD.md) for build requirements and license handling. Keep required tools, client data and their licenses in `src/tools/`. The release acceptance document records the validation scope and known limits; automated checks do not replace every possible real-game combination.

**Author: HarryCao**. For a problem or suggestion, open a [GitHub Issue](https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/issues) or email **harrycaoguitar@gmail.com**. Include the TFX version, selected network, steps and error message. Review logs for personal paths before sharing.

**Special thanks**, in order:

- **Northstar**
- **NorthstarCN**
- **Glock-雨夜**
- **HK560**
- **zxcPandora**

Thank you to these teams and contributors, and to everyone who tested TFX or shared feedback.

TFX is a **GPL-3.0-or-later** derivative of ViperCN 1.11.3. Mod management, Thunderstore integration, skin installation and dual-client management include new implementations written for this project. Inherited attribution, license and corresponding-source obligations remain. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Official clients, Mods, Electron, fonts and archive tools retain their own licenses. The bundled Global client omits the optional Discord Rich Presence plugin whose redistribution license was not clearly declared; official online updates retain their official release contents.

TFX is a community project and is not affiliated with or endorsed by Respawn Entertainment or Electronic Arts. TITANFALL 2 names, identification artwork and game assets belong to their respective rights holders.
