# VanillaPlus 2.5.1 integration

- Package author / source: NachosChipeados, https://github.com/NachosChipeados/NP.VanillaPlus
- Distribution: https://thunderstore.io/c/northstar/p/NachosChipeados/VanillaPlus/2.5.1/
- Exact user-supplied ZIP SHA-256: c47af54902149be50f33fdc0f586424c0f91e42f0da7a152ff7833fd4cde8cd1
- Original package MIT license: Copyright (c) 2023 NanohmProtogen, preserved in payload/LICENSE.
- Package credits: Made by Nanohm, remastered by Cyn, further updated by NachosChipeados.
- TFX adapts two VanillaPlus UI scripts to Northstar 1.31.13's ModInfo API; all other
  package files are preserved byte-for-byte except its empty .gitignore is omitted.
  TFX adds TFX-INTEGRATION.json and the FONT-NOTICES / OFL supplemental files.
- Lato and Northstar Mono fonts are preserved unchanged. Their embedded font license
  statements were inspected; supplemental OFL copies and provenance are retained.
- Installation follows the supplied README: a package under the chosen profile's
  packages folder, with mods/NP.VanillaPlus beneath the package. Launching requires
  official Northstar compatible runtime and -northstar -vanilla -profile=<profile>.
  Northstar's three gameplay core Mods must be disabled for this mode.
- VanillaPlus compatibility code is third-party code. TFX's package validation,
  staged installer, state isolation and launch integration are separate additions.
