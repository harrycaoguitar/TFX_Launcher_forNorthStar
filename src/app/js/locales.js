/* Product copy is kept separate from rendering and from user package content. */
window.VyraLocales = {
  messages: {
    "browser.loadMore":["加载更多…","Load more…"],
    "browser.allLoaded":["已显示全部模组。","All mods loaded."],
    "browser.resolving":["正在检查依赖…","Checking dependencies…"],
    "browser.connecting":["正在连接下载…","Connecting to download…"],
    "mods.changedExternally":["已安装的模组已被其他程序修改，请刷新后重试。未覆盖当前文件。","An installed mod was changed by another program. Refresh and retry. Current files were preserved."],
    "mods.confirmToggleAll":["切换所有可管理模组的启用状态？核心组件与仅包含插件的安装包保持原状。","Toggle all controllable mods? Core components and plugin-only packages will keep their current state."],
    "mods.confirmRemoveAll":["移除全部用户模组？北极星核心组件会保留；移除后需要重新安装这些模组。","Remove all user mods? Northstar core components will be kept. Removed mods will need to be installed again."],
    "browser.retry":["重试","Retry"],
    "browser.preparing":["正在展开文件","Preparing files"],
    "browser.checkingPackage":["正在检查模组","Checking package"],
    "browser.installing":["正在安装","Installing"],
    "browser.downloadProgress":["正在下载 {amount}","Downloading {amount}"],
    "browser.loadFailed":["未能读取社区模组，请重试。","Could not load community mods. Try again."],
    "settings.savePending":["正在保存偏好…","Saving preferences…"],
    "settings.saveFailed":["未能保存偏好，请重试；原设置已保留。","Could not save preferences. Your previous settings are unchanged. Try again."],
    "skin.resourcePath":["皮肤资源路径包含链接或非普通文件，已停止资源读写。","Skin resource paths contain links or non-regular files. Resource access has been stopped."],
    'settings.restore.title':['恢复默认偏好','Restore default preferences'],
    'settings.restore.description':['立即保存界面、语言与启动偏好，保留游戏目录、缓存路径和已安装内容。','Immediately save default appearance, language and launch preferences. Keep your game directory, cache paths and installed content.'],
    'settings.restore.button':['按住 2 秒恢复默认','Hold for 2 seconds to restore'],
    'settings.restore.holding':['继续按住以恢复默认','Keep holding to restore'],
    'settings.restore.release':['松开即可取消；完成后立即保存。','Release to cancel. Completion saves immediately.'],
    'settings.restore.saving':['正在恢复并保存…','Restoring and saving…'],
    'settings.restore.success':['已恢复并保存默认偏好。取消不会撤销这次恢复。','Default preferences restored and saved. Cancel will not undo this restore.'],
    'settings.restore.failure':['未能保存，原设置已保留。请重试。','Could not save. Your previous settings are unchanged. Try again.'],
    'settings.restartOnly':['重新启动 TFX。','Restart TFX.'],
    'settings.previewSaveHint':['取消只撤销未保存的预览；恢复默认会立即保存。','Cancel discards unsaved previews. Restoring defaults saves immediately.'],
    'app.preview':['—','—'],
    'appUpdate.title':['应用更新','App updates'],
    'appUpdate.ready':['从 GitHub Releases 检查 TFX 的正式版本。','Check GitHub Releases for a stable TFX release.'],
    'appUpdate.check':['检查更新','Check for updates'],
    'appUpdate.checking':['正在检查…','Checking…'],
    'appUpdate.available':['发现新版 {version}。','Version {version} is available.'],
    'appUpdate.current':['当前已是最新正式版本。','You have the latest stable release.'],
    'appUpdate.noRelease':['仓库暂未发布正式版本。','No stable release has been published yet.'],
    'appUpdate.failed':['未能检查更新，请稍后重试。','Could not check for updates. Try again later.'],
    'appUpdate.rateLimit':['GitHub 请求次数已达上限，请稍后重试。','GitHub rate limit reached. Try again later.'],
    'appUpdate.offline':['无法连接 GitHub，请检查网络后重试。','Could not connect to GitHub. Check your connection and retry.'],
    'appUpdate.invalid':['发布信息不完整，暂时无法确认新版。','The release data is incomplete. A new version could not be confirmed.'],
    'appUpdate.download':['下载新版','Download update'],
    'appUpdate.release':['查看发布页','View release'],
    'appUpdate.checked':['上次检查：{time}','Last checked: {time}'],
    'appUpdate.openFailed':['未能打开发布页，请重试。','Could not open the release page. Try again.'],
    'network.label':['服务器网络','Server network'],
    'network.aria':['下次北极星启动使用的网络','Network for the next Northstar launch'],
    'network.cn':['国服','China'],
    'network.global':['全球服','Global'],
    'network.hint':['分别安装客户端，启动时切换','Install each client, then switch on launch'],
	'mods.importFailed':['模组未导入','Mod import failed'],
	'mods.importOne':['一次导入一个模组压缩包；多个模组请放在同一个完整文件夹中。','Import one archive at a time. Put a collection of mods in one complete folder.'],
	'mods.importError.format':['不是可导入的北极星模组。请选择包含 mod.json 的 ZIP 压缩包或完整模组文件夹。','This is not an importable Northstar mod. Choose a ZIP archive or complete mod folder containing mod.json.'],
	'mods.importError.skin':['这是皮肤资源，不是北极星模组。DDS 或 VTF 皮肤请到对应的安装页面导入。','These are skin resources, not a Northstar mod. Import DDS or VTF skins on their respective installer page.'],
	'mods.importError.missing':['文件或文件夹不存在，请重新选择。','The file or folder no longer exists. Select it again.'],
	'mods.importError.definition':['模组说明文件无效。mod.json 需要有效的 Name 和文本格式的 Version（如有填写），请检查文件结构后重试。','Invalid mod definition. mod.json needs a valid Name and a text Version if provided. Check the package structure and try again.'],
	'mods.importError.zip':['ZIP 压缩包损坏或格式不受支持，请重新下载或解压后选择完整模组文件夹。','This ZIP is damaged or unsupported. Download it again, or extract it and choose the complete mod folder.'],
	'mods.importError.unsafe':['模组包含不安全或重复的文件路径，无法导入。','The mod contains unsafe or duplicate file paths and cannot be imported.'],
	'mods.importError.limit':['模组超过导入限制（2 GB 或 20000 个文件）。','The mod exceeds the import limit of 2 GB or 20,000 files.'],
	'mods.importError.duplicate':['压缩包中存在重复的模组名称，请拆分后分别导入。','This package contains duplicate mod names. Separate the mods and import them individually.'],
	'mods.importError.game':['请先选择已安装北极星的 Titanfall 2 游戏目录。','Choose a Titanfall 2 game folder with Northstar installed first.'],
	'mods.importError.busy':['另一个模组正在导入，请等待完成后再试。','Another mod is being imported. Wait for it to finish and try again.'],
	'mods.importError.dialog':['文件选择器未能打开，请重试或将模组 ZIP 拖入窗口。','The file picker could not open. Try again or drop a mod ZIP into the window.'],
	'mods.catalogError.CLIENT_MISSING':['此游戏目录尚未安装北极星客户端。请先在开始游戏页面安装所选客户端，再安装社区模组。','Northstar is not installed in this game folder. Install the selected client on the Play page before adding community mods.'],
	'mods.catalogError.GAME_PATH':['请先在偏好设置中选择有效的 Titanfall 2 游戏目录。','Choose a valid Titanfall 2 game folder in Preferences first.'],
	'mods.catalogError.PROFILE_CHANGED':['所选游戏目录或配置已变化，请重新开始安装。','The selected game folder or profile changed. Start the installation again.'],
	'mods.catalogError.PROCESS_QUERY':['暂时无法确认游戏是否运行，请关闭游戏后重试。','The game process could not be checked. Close the game and try again.'],
	'mods.catalogError.GAME_RUNNING':['请先关闭 Titanfall 2，再安装或修改模组。','Close Titanfall 2 before installing or changing mods.'],
	'mods.catalogError.DOWNLOAD_URL':['下载地址不受支持，请从社区模组目录重新选择。','This download address is unsupported. Select the mod again from the community catalog.'],
	'mods.catalogError.PACKAGE_CASE_CONFLICT':['已安装的模组包名称仅大小写不同，Windows 无法同时存放。请先移除存在冲突的包，再重试。','An installed package differs only by letter case. Windows cannot store both. Remove the conflicting package and try again.'],
	'mods.catalogError.DEPENDENCY_CYCLE':['模组依赖存在循环，无法安全安装。请联系模组作者检查依赖。','The mod has a dependency cycle and cannot be installed safely. Ask the mod author to check its dependencies.'],
    'browser.install':['安装此模组','Install mod'],
    'browser.details':['查看详情','Details'],
    'browser.back':['返回模组列表','Back to mods'],
    'browser.website':['完整说明与更新记录','Full description & changelog'],
    'browser.detailHint':['在 TFX 中下载并安装，依赖模组会一同处理。','Download and install in TFX, including required dependencies.'],
    'ddsOriginal.title':['材质完整替换','Complete material replacement'],
    'ddsOriginal.ready':['原版补齐资源已就绪','Original repair resources ready'],
    'ddsOriginal.needsSource':['需要原版资源','Original resources needed'],
    'ddsOriginal.unknown':['材质范围待确认','Material scope needs checking'],
    'ddsOriginal.error':['原版资源检查未完成','Original resource check did not complete'],
    'ddsOriginal.count':['皮肤覆盖 {covered} / {total} 个材质位置','Skin covers {covered} / {total} material slots'],
    'ddsOriginal.completeHint':['皮肤已覆盖所需材质位置，无需补齐。','The skin covers all required material slots. No original slots need filling.'],
    'ddsOriginal.readyHint':['本包缺少 {count} 个材质位置；安装时会先用原版资源补齐同一武器，再写入新皮肤，清除旧字体与配件残留。','This package omits {count} material slots. Installation first fills this weapon with original resources, then applies the new skin to clear leftover lettering and attachments.'],
    'ddsOriginal.needsSourceHint':['旧安装工具可能把上一套皮肤留在本包未包含的材质里。先提供未改动的原版资源，补齐同一武器后才能干净换肤。','Older installers can leave the previous skin in materials omitted by this package. Supply unmodified original resources to complete this weapon before replacing its skin.'],
    'ddsOriginal.select':['选择原版资源备份','Choose original resource backup'],
    'ddsOriginal.steam':["单独下载原版资源","Download original resources separately"],
    'ddsOriginal.steamUnavailable':['未找到受支持的 Steam 资源清单，请选择原版资源备份','No supported Steam resource manifest was found. Choose an original resource backup.'],
    'ddsOriginal.check':['修复完成，重新检查','Repair finished · Check again'],
    'ddsOriginal.confirmText':["仅下载所需的原版资源到独立缓存，不执行 Steam 整体验证，不重置已有皮肤。下载完成后校验资源，再继续安装当前皮肤。","Only required original resources are downloaded to an isolated cache. Steam does not verify the whole installation or reset existing skins. After verification, installation of the selected skin continues."],
    'ddsOriginal.confirm':["开始单独下载","Start separate download"],
    'ddsOriginal.cancel':['取消','Cancel'],
    'ddsOriginal.installBlocked':['缺少可验证的原版补齐资源，暂不能安装','Verified original repair resources are needed before installation'],
    'ddsOriginal.installBlockedHint':["选择原版资源来源，或单独下载所需资源后继续安装。","Choose an original resource source, or download the required resources separately to continue installation."],
    'ddsOriginal.operationError':['原版资源检查未完成','Original resource check did not complete'],
    'ddsGuard.coverageTitle':['皮肤分辨率覆盖','Skin resolution coverage'],
    'ddsGuard.coverageComplete':['受支持的分辨率已覆盖','Supported resolutions covered'],
    'ddsGuard.coveragePartial':['部分分辨率缺失','Some resolutions are missing'],
    'ddsGuard.coverageUnknown':['覆盖情况待确认','Coverage could not be confirmed'],
    'ddsGuard.coverageCount':['已覆盖 {covered} / {expected} 个皮肤位置','{covered} / {expected} skin slots covered'],
    'ddsGuard.coverageMissing':['查看 {count} 个缺失位置','View {count} missing slots'],
    'ddsGuard.coveragePartialHint':['仍可安装；游戏使用未替换的分辨率时，可能显示原版皮肤。','You can still install. The game may show original skin files when it uses an unmodified resolution.'],
    'ddsGuard.coverageCompleteHint':['已检查安装工具支持的皮肤位置；游戏内效果仍取决于皮肤内容与皮肤兼容性设置。','Skin slots supported by the installer have been checked. In-game results still depend on the skin and skin compatibility settings.'],
    'ddsGuard.coverageUnknownHint':['无法确认所有受支持位置的覆盖情况，安装后请检查游戏内效果。','Coverage of all supported skin slots could not be confirmed. Check the result in-game after installation.'],
    'ddsGuard.title':['皮肤启动保护','Skin launch protection'],
    'ddsGuard.subtitle':['适用于 DDS 与 VTF 皮肤。','Applies to DDS and VTF skins.'],
    'ddsGuard.toggle':['启动前恢复已记录的皮肤兼容性设置','Restore recorded skin compatibility settings before launch'],
    'ddsGuard.howItWorks':['首次安装 DDS 或 VTF 皮肤时记录当前皮肤兼容性设置。开启后，TFX 会在启动前恢复记录值；游戏内的画面选项仍可调整。','Your current skin compatibility settings are recorded when you first install a DDS or VTF skin. When enabled, TFX restores those values before launch. You can still change graphics options in-game.'],
    'ddsGuard.immediate':['此开关立即保存；关闭设置或取消不会撤销。','This switch saves immediately. Closing settings or choosing Cancel will not undo it.'],
    'ddsGuard.refresh':['刷新状态','Refresh status'],
    'ddsGuard.noGame':['尚未选择游戏目录','No game folder selected'],
    'ddsGuard.noGameHint':['请先在游戏启动设置中选择 Titanfall 2 游戏目录。','Choose your Titanfall 2 game folder in the launch settings first.'],
    'ddsGuard.choiceNote':['记录值来自你的当前选择，不代表已经验证的兼容值。确认皮肤显示正常后，可重新记录。','Recorded values reflect your current choices, not a verified compatible preset. You can record them again after checking that the skin displays correctly.'],
    'ddsGuard.stateInactive':['等待皮肤安装','Waiting for skin installation'],
    'ddsGuard.stateReady':['设置与记录一致','Settings match the record'],
    'ddsGuard.stateChanged':['皮肤兼容性设置已变化','Skin compatibility settings have changed'],
    'ddsGuard.stateMissing':['未找到画面配置','Graphics config not found'],
    'ddsGuard.stateUnrecorded':['尚未记录皮肤兼容性设置','No skin compatibility settings recorded'],
    'ddsGuard.stateError':['需要检查配置','Config needs attention'],
    'ddsGuard.disabled':['保护已关闭','Protection is off'],
    'ddsGuard.loading':['正在读取保护状态…','Loading protection status…'],
    'ddsGuard.inactiveHint':['首次安装 DDS 或 VTF 皮肤后自动建立记录；恢复全部皮肤备份后，保护不再应用。','A record is created when you first install a DDS or VTF skin. Protection no longer applies after all skin backups are restored.'],
    'ddsGuard.readyHint':['启动时会检查皮肤兼容性设置，有变化才恢复记录值。','Skin compatibility settings are checked at launch and restored only if they have changed.'],
    'ddsGuard.changedHint':['下次从 TFX 启动游戏前，将恢复已记录的皮肤兼容性设置。','Your recorded skin compatibility settings will be restored before the next game launch from TFX.'],
    'ddsGuard.missingHint':['请先运行游戏并保存画面设置，再回到这里刷新。','Run the game and save your graphics settings, then return here and refresh.'],
    'ddsGuard.unrecordedHint':['此前安装的皮肤没有设置记录。确认皮肤在游戏中显示正常后，记录当前设置。','Earlier skin installations have no settings record. Check that the skin displays correctly in-game, then record your current settings.'],
    'ddsGuard.errorHint':['无法读取或记录皮肤兼容性设置，请检查画面配置后刷新。','Skin compatibility settings could not be read or recorded. Check the graphics config, then refresh.'],
    'ddsGuard.disabledHint':['下次启动保留游戏中的当前皮肤兼容性设置。','Your current in-game skin compatibility settings will be kept at the next launch.'],
    'ddsGuard.activeCount':['当前有 {count} 份皮肤安装记录生效','{count} active skin installation records'],
    'ddsGuard.formatCount':['{count} 份生效记录 · DDS {dds} / VTF {vtf}','{count} active records · DDS {dds} / VTF {vtf}'],
    'ddsGuard.capture':['记录当前设置','Record current settings'],
    'ddsGuard.captureRunning':['退出游戏后可记录皮肤兼容性设置。','Close the game to record skin compatibility settings.'],
    'ddsGuard.captureConfirm':['当前记录会被替换。请确认游戏中的皮肤显示正常，再记录当前设置。','This replaces the existing record. Confirm that your skins display correctly in-game before recording the current settings.'],
    'ddsGuard.captureConfirmButton':['确认记录','Record settings'],
    'ddsGuard.captureCancel':['取消','Cancel'],
    'ddsGuard.snapshotDetails':['查看已记录设置','View recorded settings'],
    'ddsGuard.snapshotAt':['记录于 {date}','Recorded {date}'],
    'ddsGuard.streamMemory':['皮肤显存预算','Skin memory budget'],
    'ddsGuard.picmip':['皮肤细节值','Skin detail value'],
    'ddsGuard.configLocation':['配置位置','Config location'],
    'ddsGuard.saved':['皮肤启动保护已更新','Skin launch protection updated'],
    'ddsGuard.captured':['当前皮肤兼容性设置已记录','Current skin compatibility settings recorded'],
    'ddsGuard.operationFailed':['皮肤保护操作未完成','Skin protection action incomplete'],
    'ddsGuard.operationError':['无法更新皮肤启动保护','Unable to update skin launch protection'],
    'ddsGuard.restored':['已恢复记录的皮肤兼容性设置','Recorded skin compatibility settings restored'],
    'ddsGuard.launchFailed':['皮肤启动保护未完成','Skin launch protection incomplete'],
    'mods.sortLabel':['排列','Sort by'],
    'mods.searchLabel':['搜索我的模组','Search my mods'],
    'mods.searchPlaceholder':['搜索名称、作者或说明','Search names, authors or descriptions'],
    'mods.searchClear':['清除搜索','Clear search'],
    'mods.searchCount':['匹配 {matched} / {total} 个模组','{matched} / {total} mods match'],
    'mods.totalCount':['共 {total} 个模组','{total} mods installed'],
    'mods.searchEmpty':['没有匹配的模组','No matching mods'],
    'mods.searchHint':['试试名称、作者或说明中的关键词。','Try a keyword from a name, author or description.'],
    'mods.libraryEmpty':['还没有安装模组','No mods installed yet'],
    'mods.libraryHint':['从右上角导入模组，或打开“发现模组”。','Import a mod or open Discover mods above.'],
    'mods.enabled':['已启用','Enabled'],
    'mods.disabled':['已停用','Disabled'],
    'mods.coreComponent':['核心组件','Core component'],
    'mods.coreHint':['北极星启动和主菜单需要此组件，保持启用。','Northstar needs this component for startup and its main menu. It stays enabled.'],
    'mods.enabling':['正在启用','Enabling'],
    'mods.disabling':['正在停用','Disabling'],
    'mods.waiting':['等待响应','Waiting'],
    'mods.saveFailed':['未保存 · 重试','Failed · Retry'],
    'mods.enableLabel':['启用','Enable'],
    'mods.disableLabel':['停用','Disable'],
    'mods.sortAdded':['添加时间','Date added'],
    'mods.sortName':['名称首字母','Name'],
    'mods.sortEnabled':['启用状态','Enabled status'],
    'settings.exitAfterLaunch':['游戏启动后退出 TFX','Exit TFX after the game starts'],
    'settings.exitAfterLaunchDesc':['确认游戏进程启动后自动退出，释放启动器占用；启动失败时保留窗口。','Quit once the game process is confirmed to free launcher memory. Keep the window open if launch fails.'],
    'settings.independentServerMods':['三服模组独立','Separate Mod states for three servers'],
    'settings.independentServerModsDesc':['分别保存官服、国服与全球服的 Mod 开关，切换时自动应用。安装文件、插件及 DDS/VTF 皮肤仍共用。','Save separate Mod enabled states for Official, China and Global, and apply them when switching. Installed files, plugins and DDS/VTF skins remain shared.'],
    'settings.independentServerModsNote':['首次开启将当前状态复制到三服，此后各自记忆。此开关立即保存，取消不会撤销。','On first use, copy the current states to all three servers, then remember each separately. This switch saves immediately; Cancel does not undo it.'],
    'settings.independentServerModsPending':['正在保存并同步 Mod 开关状态…','Saving and synchronizing Mod states…'],
    'settings.independentServerModsSaved':['已保存三服 Mod 偏好。','Three-server Mod preferences saved.'],
    'settings.independentServerModsFailed':['三服 Mod 偏好更改未完成，请重试。','Three-server Mod preferences could not be changed. Try again.'],
    'settings.modStateChangeBlocked':['请先退出游戏，并等待当前操作完成后重试。','Close the game and wait for the current operation to finish, then try again.'],
    'settings.modStateProcessUnknown':['无法确认游戏是否运行，请检查进程后重试。','The game process state could not be confirmed. Check running processes and try again.'],
    'settings.modStateContextChanged':['游戏目录或客户端选择已改变，请重新操作。','The game folder or client selection changed. Try the operation again.'],
    'settings.modStateDuplicates':['同一 Mod 的多个已安装版本开关不一致，请先移除重复版本或统一开关。','Multiple installed versions of the same Mod have different enabled states. Remove duplicate versions or give them matching states first.'],
    'settings.modStateInvalid':['Mod 配置无法安全读取或写入，请检查游戏目录中的 Mod 配置后重试。','The Mod configuration could not be read or written safely. Check the Mod configuration in the game folder and try again.'],
    'settings.modStateRecoveryNeeded':['Mod 配置回滚未完成，请检查游戏目录中的 Mod 开关状态后再启动游戏。','Mod configuration rollback did not complete. Check Mod enabled states in the game folder before launching the game.'],
    'settings.regionChangeFailed':['未能切换服务器，已保留原选择。','The region could not be switched. Your previous selection was kept.'],
    'settings.unsaved.title':['保存设置后再退出？','Save your changes before leaving?'],
    'settings.unsaved.description':['还有未保存的更改。你可以保存后退出，放弃更改，或继续编辑。','You have unsaved changes. Save them before leaving, discard them, or keep editing.'],
    'settings.unsaved.save':['保存并退出','Save and leave'],
    'settings.unsaved.discard':['不保存退出','Discard and leave'],
    'settings.unsaved.stay':['继续编辑','Keep editing'],
    "servers.nameColumn":["服务器","Server"],
    "servers.mapColumn":["地图","Map"],
    "servers.modeColumn":["玩法","Mode"],
    "servers.playersColumn":["人数","Players"],
    "servers.title":["社区服务器","Community servers"],
    "servers.source":["服务器来源","Server source"],
    "servers.cn":["国内","China"],
    "servers.global":["全球","Global"],
    "servers.refresh":["刷新服务器","Refresh servers"],
    "servers.search":["搜索服务器、地图或玩法","Search servers, maps or modes"],
    "servers.searchLabel":["搜索服务器","Search servers"],
    'settings.title':['设置','Settings'],
    'settings.about.title':['关于','About'],
    'settings.about.author':['作者','Author'],
    'settings.about.thanks':['特别鸣谢','Special thanks'],
    'settings.about.teams':['感谢全体 NorthstarCN 和 Northstar 制作团队。','Thanks to the entire NorthstarCN and Northstar teams.'],
    'settings.about.issue':['提交 GitHub Issue','Open a GitHub issue'],
    'settings.about.version':['版本','Version'],
    'settings.subtitle':['把 TFX 调整成你习惯的样子。','Make TFX feel right for you.'],
    'settings.close':['关闭设置','Close settings'],
    'settings.search':['查找语言、主题或启动选项','Find language, theme or launch options'],
    'settings.searchLabel':['搜索设置','Search settings'],
    'settings.appearance':['外观与语言','Appearance & language'],
    'settings.language':['界面语言','Interface language'],
    'settings.languageDesc':['首次使用按系统语言选择：中文系统显示中文，其他系统显示英语。保存后记住你的选择。','On first use, Chinese systems use Chinese and other systems use English. Save a language to keep your choice.'],
    'settings.theme':['主题配色','Color theme'],
    'settings.themeDesc':['选择一组光感与色彩，玻璃界面会随之变化。','Choose your colors and light. Glass surfaces adapt to the palette.'],
    'settings.themeLabel':['选择主题配色','Choose color theme'],
    'settings.launch':['游戏启动','Game launch'],
    'settings.gameDirectory':['游戏位置','Game location'],
    'settings.openDirectory':['打开文件夹','Open folder'],
    'settings.chooseDirectory':['选择目录','Choose folder'],
    'settings.arguments':['北极星启动参数','Northstar launch arguments'],
    'settings.argumentsDesc':['每个参数以空格分隔，例如 -multiple。','Separate arguments with spaces, for example -multiple.'],
    'settings.closeOrigin':['退出后关闭 Origin','Close Origin when TFX exits'],
    'settings.closeOriginDesc':['关闭 TFX 时一并结束 Origin 进程。','End the Origin process when you close TFX.'],
    'settings.updates':['北极星更新','Northstar updates'],
    'settings.autoUpdate':['自动保持最新','Keep Northstar up to date'],
    'settings.autoUpdateDesc':['打开 TFX 时检查并更新北极星客户端。','Check for Northstar updates when TFX opens.'],
    'settings.excludes':['更新时保留的文件','Files to preserve'],
    'settings.excludesDesc':['这些文件不会被覆盖，文件名以空格分隔。','These files will not be overwritten. Separate names with spaces.'],
    'settings.repairUpdate':['更新遇到问题？','Trouble updating?'],
    'settings.repairUpdateDesc':['重新获取版本信息，或下载并重装北极星客户端。','Refresh version information or download and reinstall Northstar.'],
    'settings.refreshVersion':['刷新版本信息','Refresh version information'],
    'settings.reinstall':['重新安装北极星','Reinstall Northstar'],
    'settings.network':['连接与网络','Connection & network'],
    'settings.dns':['DNS 连接工具','DNS tools'],
    'settings.dnsDesc':['连接异常时可尝试清理缓存。更换 DNS 会修改系统网络设置，并需要管理员权限。','Try clearing the cache for connection issues. Changing DNS modifies system network settings and requires administrator access.'],
    'settings.dnsService':['DNS 服务','DNS service'],
    'settings.flushDns':['清理 DNS 缓存','Clear DNS cache'],
    'settings.applyDns':['使用此 DNS','Use this DNS'],
    'settings.maintenance':['维护工具','Maintenance'],
    'settings.cache':['安装缓存','Installer cache'],
    'settings.cacheDesc':['移除已下载的安装包，下次更新会重新下载。','Remove downloaded installers. The next update downloads them again.'],
    'settings.clearCache':['清理安装缓存','Clear installer cache'],
    'settings.processes':['结束游戏进程','End game processes'],
    'settings.processesDesc':['游戏或 Origin 无响应时使用，未保存的进度可能丢失。','Use if the game or Origin is unresponsive. Unsaved progress may be lost.'],
    'settings.endGame':['结束游戏','End game'],
    'settings.endOrigin':['结束 Origin','End Origin'],
    'settings.launcher':['启动器','Launcher'],
    'settings.launcherDesc':['重启 TFX，或将设置恢复为初始状态。','Restart TFX or restore the default preferences.'],
    'settings.restart':['重启 TFX','Restart TFX'],
    'settings.reset':['重置设置','Reset settings'],
    'settings.authorLabel':['TFX 作者','Created by'],
    'settings.authorDesc':['如遇使用问题或有改进建议，欢迎通过邮件联系作者，或在 GitHub 提交 Issue。','For support or suggestions, contact the author by email or submit a GitHub issue.'],
    'settings.saveHint':['预览满意后保存，取消会恢复原设置。','Save when the preview feels right. Cancel restores your previous settings.'],
    'settings.cancel':['取消','Cancel'],
    'settings.save':['保存更改','Save changes']
  },
  pairs: [
    ["皮肤层级检查输入无效","Invalid input for the skin resolution check"],
    ["无法确认皮肤压缩格式和尺寸比例","The skin compression format and size ratio could not be confirmed"],
    ["皮肤层级查询超过支持范围","The skin resolution check exceeds the supported limit"],
    ["皮肤层级元数据响应数量不匹配","The skin resolution response contains an unexpected number of entries"],
    ["皮肤层级元数据响应路径无效","The skin resolution response contains an invalid path"],
    ["皮肤层级元数据响应不完整","The skin resolution response is incomplete"],
    ["正在检查皮肤分辨率覆盖","Checking skin resolution coverage"],
    ["请先导入要安装的 DDS 皮肤","Import the DDS skin you want to install first"],
    ["正在检查旧皮肤与覆盖安装范围","Checking the previous skin and replacement coverage"],
    ["这份旧备份已被原版资源验证替代，不能再恢复旧皮肤残留","Game verification has superseded this backup. It cannot restore remnants of the previous skin."],
    ["未完成安装的皮肤区域已被其他程序修改，请先处理冲突后再恢复","Another program changed skin data from an unfinished installation. Resolve the conflict before restoring."],
    ["原版皮肤缓存与当前游戏版本不匹配或已损坏，请重新选择原版资源","The original skin cache is damaged or does not match this game version. Choose the original resources again."],
    ["皮肤兼容性设置恢复失败且撤销未通过校验，原文件备份已保留：","Skin compatibility settings could not be restored or rolled back. The original file backup is retained: "],
    ["覆盖安装的旧皮肤元数据响应不完整","The metadata response for the previous skin is incomplete"],
    ["覆盖安装的旧皮肤元数据路径无效","The metadata response for the previous skin contains an invalid path"],
    ["覆盖安装的旧皮肤元数据无效","The metadata for the previous skin is invalid"],
    ["上次 DDS 操作尚未完成，请先恢复对应备份，再安装新皮肤","The last DDS operation did not finish. Restore its backup before installing another skin."],
    ["覆盖安装涉及的皮肤区域超过 512 MB，请先恢复旧皮肤","The replacement would modify more than 512 MB of skin data. Restore the previous skin first."],
    ["旧皮肤与新皮肤的皮肤区域不完全对应，请先恢复旧备份","The previous and new skins do not cover matching resource locations. Restore the previous backup first."],
    ["旧 DDS 备份包含不兼容的皮肤区域，请先恢复旧备份","The previous DDS backup contains incompatible skin data. Restore it first."],
    ["旧皮肤区域已被其他程序修改，覆盖安装已取消；请先处理冲突或恢复游戏文件","Another program changed the previous skin data, so replacement was cancelled. Resolve the conflict or repair the game files first."],
    ["选择 DDS 皮肤文件夹","Choose a DDS skin folder"],
    ["选择 DDS 皮肤或 ZIP 皮肤包","Choose a DDS skin file or ZIP skin package"],
    ["DDS 皮肤包","DDS skin package"],
    ["临时皮肤路径不属于当前导入会话，已保留","The temporary skin folder belongs to another import session and has been kept"],
    ["暂不支持带体积深度的 VTF 立方体皮肤","VTF cubemap skins with 3D depth are not supported"],
    ["VTF 声明的皮肤数据长度超过支持范围","The declared VTF skin data size exceeds the supported limit"],
    ["VTF 缩略皮肤尺寸无效","Invalid dimensions for the VTF skin preview"],
    ["VTF 缩略皮肤格式无效","Invalid format for the VTF skin preview"],
    ["缩略皮肤","Skin preview data"],
    ["主皮肤","Main skin data"],
    ["VTF 资源字典长度无效或缺少主皮肤资源","The VTF resource directory has an invalid size or is missing the main skin data"],
    ["VTF 主皮肤不能使用内联资源标志","The main VTF skin data cannot use an inline resource flag"],
    ["VTF 缩略皮肤资源与标头不一致","The VTF skin preview does not match its header"],
    ["VTF 资源字典缺少主皮肤或缩略皮肤","The VTF resource directory is missing the main skin data or its preview"],
    ["发布后的皮肤归档校验失败","The published skin archive failed verification"],
    ["安装后的皮肤归档已被修改，恢复已停止以保留当前文件","The installed skin archive was modified. Restoration stopped to preserve the current file."],
    ["校验后的皮肤文件发生了变化，请重新导入","The skin file changed after verification. Import it again."],
    ["写入后的 VPK 缺少皮肤资源","The written VPK is missing skin resources"],
    ["写入后的皮肤数据或校验码不一致","The written skin data or checksum does not match"],
    ["选择 VTF 皮肤文件夹","Choose a VTF skin folder"],
    ["选择 VTF 皮肤压缩包","Choose a VTF skin archive"],
    ["VTF 皮肤压缩包","VTF skin archive"],
    ['没有匹配到受支持的皮肤名称与尺寸','No supported skin filename and dimensions matched.'],
    ['不支持的皮肤尺寸目录','This skin resolution folder is not supported.'],
    ["游戏目录已失效或缺少 Titanfall2.exe，请重新选择游戏安装目录。","The game folder is unavailable or missing Titanfall2.exe. Choose the installation folder again."],
    ["游戏目录缺少 r2 资源目录，请验证游戏文件后再启动。","The game folder is missing the r2 resources folder. Verify the game files before launching."],
    ["无法读取 Windows 游戏进程，已重试三次。请稍后重试启动。","Windows game processes could not be read after three attempts. Try again shortly."],
    ["游戏正在启动，请等待当前请求完成","The game is starting. Wait for the current request to finish."],
    ["游戏或北极星启动进程已经运行，请等待启动完成或先退出游戏。","The game or Northstar is already running. Wait for it to start or close the game first."],
    ["游戏已由其他程序启动，请等待启动完成或先退出游戏。","Another application has started the game. Wait for it to start or close it first."],
    ["等待游戏启动超时。请检查 EA App / Steam 是否已登录、是否有弹窗，确认游戏未启动后再重试；详情见启动诊断。","Game launch confirmation timed out. Check EA App / Steam login and any dialogs. Confirm the game is closed before retrying; details are saved in the launch diagnostics."],
    ["游戏启动未完成","Game launch did not complete"],
    ["启动失败，请重试。","Launch failed. Try again."],
    ["单独的 VTF 文件无法确定游戏资源路径。请选择保留 materials / models 结构的完整皮肤文件夹或压缩包。","A single VTF file does not identify its game path. Select a complete skin folder or archive preserving materials / models."],
    ["这个文件不是可读取的皮肤压缩包，或压缩包已损坏。请选择包含兼容 VTF 资源的压缩包或完整文件夹。","This file is not a readable skin archive, or it is damaged. Select an archive or complete folder containing compatible VTF assets."],
    ["请选择完整的 VTF 皮肤文件夹或可读取的压缩包。","Select a complete VTF skin folder or a readable archive."],
    ['支持 ZIP、7Z、RAR 等压缩包与完整皮肤文件夹','ZIP, 7Z, RAR and other archives, or complete skin folders'],
    ['启动参数无效','Invalid launch arguments'],
    ['启动参数中的引号没有闭合','A quote in the launch arguments is not closed'],
    ['管理北极星模组；支持导入 ZIP 安装包与模组文件夹。','Manage Northstar mods. Import ZIP packages or mod folders.'],
    ['皮肤安装完成，但启动保护需要处理','Skin files installed; launch protection needs attention'],
    ['安装此模组','Install mod'],['查看详情','Details'],['返回模组列表','Back to mods'],['完整说明与更新记录','Full description & changelog'],['在 TFX 中下载并安装，依赖模组会一同处理。','Download and install in TFX, including required dependencies.'],
    ['正在恢复安装前皮肤…','Restoring pre-installation skin files…'],['安装前皮肤已恢复','Pre-installation skin files restored'],['资源已恢复到这份安装记录之前，哈希校验通过。','Resources restored to their pre-installation state and hashes verified.'],
    ['另一个皮肤操作正在执行','Another skin operation is running'],['请选择本地 DDS 皮肤包','Choose a local DDS skin package'],['皮肤包解压后超过 512 MB','The extracted skin package exceeds 512 MB'],['皮肤包读取已取消','skin package reading cancelled'],['游戏包内的皮肤区域不完整','The skin region in the game archive is incomplete'],['皮肤区域写入失败','Failed to write the skin region'],['正在读取皮肤包','Reading skin package'],['请选择 DDS 文件、ZIP 皮肤包或皮肤文件夹','Choose a DDS file, ZIP skin package or skin folder'],['所选项目中没有 DDS 皮肤','No DDS skin files found in the selected item'],['皮肤包体积超过支持范围','skin package exceeds the supported size'],['请先选择泰坦陨落 2 游戏目录','Choose the Titanfall 2 game folder first'],['目录中未找到 Titanfall2.exe','Titanfall2.exe was not found in this folder'],['游戏包大小不匹配','Game archive size does not match'],['目录中未找到 r2/paks/Win64','r2/paks/Win64 was not found in this folder'],['请先退出游戏，再安装或恢复皮肤','Close the game before installing or restoring skin files'],['请重新选择并校验皮肤包','Select and inspect the skin package again'],['正在备份所有将被修改的皮肤区域','Backing up all skin regions that will be changed'],['校验后的皮肤文件已发生变化，请重新选择','The inspected skin file has changed. Select it again.'],['游戏皮肤在备份后被其他程序修改，操作已取消','Another program changed the game skin files after backup. Operation cancelled.'],['安装后的皮肤校验失败','Installed skin verification failed'],['备份编号无效','Invalid backup ID'],['备份与当前游戏目录不匹配','The backup does not match the current game folder'],['这个备份已经恢复或没有完成安装','This backup is already restored or its installation is incomplete'],['备份记录无效','Invalid backup record'],['备份已损坏，无法恢复','The backup is damaged and cannot be restored'],['这部分皮肤已被后续安装修改。请先恢复较新的备份，再恢复这个备份','These skin files were changed by a later installation. Restore the newer backup first.'],['备份校验通过，正在恢复皮肤','Backup validated. Restoring skin files.'],['恢复后的皮肤校验失败','Restored skin verification failed'],['安装前的皮肤已恢复，校验通过','Pre-installation skin files restored and verified'],
    ['启动器正在退出','The launcher is closing'],['另一个 VTF 操作正在执行','Another VTF operation is running'],['皮肤已导入，旧临时缓存将在退出后重试清理','Skin imported. Old temporary files will be cleaned up on exit.'],['请选择本地 VTF 皮肤包','Choose a local VTF skin package'],['选择已清除，临时缓存将在退出后重试清理','Selection cleared. Temporary files will be cleaned up on exit.'],['另一个启动器正在安装或恢复 VTF 皮肤，请等待该操作完成','Another launcher is installing or restoring VTF skins. Wait for it to finish.'],['VTF 资源正在被另一个程序操作，请稍后重试','VTF resources are being used by another program. Try again later.'],['磁盘剩余空间不足，请至少预留皮肤解压体积的两倍空间','Not enough disk space. Keep at least twice the extracted skin size free.'],['压缩包路径无效','Invalid archive path'],['VTF 皮肤必须保留 materials / models 的原始文件夹结构','VTF skins must keep their original materials / models folder structure'],['皮肤和材质必须位于 materials 文件夹内','Skin files and materials must be inside the materials folder'],['模型必须位于 models 文件夹内','Models must be inside the models folder'],['皮肤文件不完整','Skin file is incomplete'],['VTF 的标头、尺寸、帧数或文件长度无效','Invalid VTF header, dimensions, frame count or file length'],['VTF 的深度或 mipmap 层数无效','Invalid VTF depth or mipmap count'],['皮肤文件夹层级过深','Skin folder hierarchy is too deep'],['皮肤包不支持链接文件','Linked files are not supported in skin packages'],['皮肤包包含非普通文件','Skin package contains a non-regular file'],['压缩包包含重复路径','Archive contains duplicate paths'],['压缩包不支持符号链接或硬链接','Symbolic and hard links are not supported in archives'],['暂不支持带密码的皮肤包','Password-protected skin packages are not supported'],['压缩包文件数量过多','Archive contains too many files'],['压缩包文件长度无效','Invalid archive file length'],['皮肤包解压后超过 4 GB','Extracted skin package exceeds 4 GB'],['压缩包中没有皮肤文件','No skin files found in the archive'],['解压后的皮肤包超过 4 GB','Extracted skin package exceeds 4 GB'],['请选择 ZIP / 7Z 皮肤包，或含 materials / models 的文件夹','Choose a ZIP / 7Z skin package or a folder containing materials / models'],['皮肤包包含重名游戏资源','Skin package contains duplicate game resources'],['皮肤包包含空资源文件','Skin package contains an empty resource file'],['皮肤包资源总大小超过 4 GB','Skin resources exceed 4 GB in total'],['所选项目中没有 VTF 皮肤','No VTF skin files found in the selected item'],['请选择一个皮肤包；当前文件夹中存在多个不同的皮肤根目录','Choose one skin package. The folder contains several skin root directories.'],['导入过程中皮肤文件发生了变化','A skin file changed during import'],['请先退出游戏，再安装或恢复皮肤','Close the game before installing or restoring skins'],['请重新导入并校验 VTF 皮肤包','Import and inspect the VTF skin package again'],['检测到上次未完成的 VTF 操作，请先恢复该备份','An incomplete VTF operation was found. Restore that backup first.'],['游戏已启动，安装已取消','The game started. Installation cancelled.'],['common 索引被其他程序修改，安装已取消','Another program changed the common index. Installation cancelled.'],['common 索引已被后续安装或其他程序修改。请先恢复较新的 VTF 备份','The common index was changed by a later installation or another program. Restore newer VTF backups first.'],['游戏已启动，请先退出游戏再恢复皮肤','The game is running. Close it before restoring skins.'],['这个 VTF 备份已经恢复或没有完成安装','This VTF backup is already restored or its installation is incomplete'],['VTF 备份编号无效','Invalid VTF backup ID'],['恢复后的 common 索引校验失败','Restored common index verification failed'],
    ['正在读取 VTF 皮肤包','Reading VTF skin package'],['原 common 索引已备份；正在构建新的皮肤归档','Original common index backed up. Building the new skin archive.'],['正在逐块校验 VTF、材质和模型','Verifying VTF skin files, materials and models block by block'],['备份校验通过，正在恢复原 common 索引','Backup validated. Restoring the original common index.'],['安装前的 common 索引已精确恢复，新增归档已移除','Original common index restored exactly. Added archive removed.'],
    ['游戏版本','Game version'],['强制退出','Force quit'],['原版游戏','Vanilla game'],['单人战役 · 官方多人','Campaign · Official multiplayer'],['原版游戏 · 本地安装','Vanilla game · Local installation'],['松开文件以导入模组','Drop the file to import a mod'],['安装方式和安装前备份信息。','Installation method and backup details appear here.'],['资源文件','Resource files'],['保留原数据包，备份索引并写入独立皮肤包。可在武器库选中武器还原备份。','Original archives are preserved. The index is backed up and a separate skin archive is added. Select a weapon in the Arsenal to restore a backup.'],['VTF 安装已就绪。请先退出游戏。','VTF installer ready. Close the game before installing.'],
    ['TFX','TFX'],['启动器','Launcher'],['最小化','Minimize'],['关闭启动器','Close launcher'],
    ['开始游戏','Play'],['我的模组','My Mods'],['DDS 安装','DDS installer'],['VTF 安装','VTF installer'],['发现模组','Discover mods'],['北极星更新记录','Northstar updates'],['偏好设置','Preferences'],
    ['北极星社区服','Northstar community servers'],['社区服务器 · 自定义模组','Community servers · Custom mods'],['社区服务器','Community servers'],['北极星','Northstar'],['社区服','Community'],['原版','Vanilla'],['战役 / 官方','Campaign / Official'],['启动方式','Game mode'],['选择游戏版本','Choose game mode'],['客户端版本','Client version'],['读取中','Loading'],['检查更新','Check for updates'],['启动游戏','Play'],['游戏目录','Game folder'],['正在读取游戏目录…','Loading game folder…'],['打开游戏目录','Open game folder'],['更改目录','Change folder'],['更改游戏目录','Change game folder'],['正在连接社区服务器…','Connecting to community services…'],
    ['管理已安装模组','Manage installed mods'],['启用、停用或移除北极星模组。DDS 与 VTF 皮肤请前往对应安装页面。','Enable, disable or remove Northstar mods. Install DDS and VTF skins on their own pages.'],['导入模组','Import mod'],['正在读取模组…','Loading mods…'],['切换全部','Toggle all'],['移除全部','Remove all'],
    ['安装 DDS 皮肤','Install DDS skin files'],['将 DDS 皮肤注入游戏资源，安装前自动保留原版备份。','Install DDS skin files into game resources. Original skin files are backed up before installation.'],['安装与恢复','Install & restore'],['导入皮肤','Import skin files'],['选择 DDS 文件或皮肤安装包','Choose DDS files or a skin package'],['选择 DDS 皮肤文件或安装包','Choose a DDS skin file or package'],['支持单个 DDS 文件与 ZIP 安装包','Supports individual DDS files and ZIP packages'],['也可在此拖入文件','You can also drop a file here'],['尚未选择','Nothing selected'],['等待检查皮肤','Waiting to inspect skin files'],['清除选择','Clear selection'],['目标游戏目录','Target game folder'],['正在读取…','Loading…'],['根据文件名匹配目标材质与资源包。','File names are used to match target materials and archives.'],['保留原文件名，以便正确识别安装位置。','Keep the original file names so targets can be identified.'],['检查与安装','Inspect & install'],['导入皮肤后，在这里预览安装计划','Import skin files to preview the installation plan'],['尚未导入 DDS 文件','No DDS file imported'],['导入后显示格式检查结果、','The format, target resources and backup details'],['目标资源和安装前备份信息。','appear here after you import a package.'],['皮肤文件数','Skin files'],['目标资源','Target resources'],['检查结果','Validation'],['待检查','Pending'],['安装前自动备份，可在武器库选中武器还原备份。','Backed up before installation. Select a weapon in the Arsenal to restore a backup.'],['正在准备…','Preparing…'],['先导入，再检查，最后安装。','Import a package, review the plan, then install.'],['安装皮肤','Install skin files'],['备份与记录','Backups & history'],['刷新','Refresh'],['打开备份目录','Open backup folder'],['正在读取安装记录…','Loading installation records…'],['查看操作日志','Operation log'],['DDS 安装已就绪。','DDS installer ready.'],
    ['安装 VTF 皮肤','Install VTF skins'],['导入材质与模型皮肤，支持动态 VTF。安装前备份游戏资源索引。','Import materials and models, including animated VTF skin files. The game resource index is backed up before installation.'],['选择皮肤文件夹或压缩包','Choose a skin folder or archive'],['选择 VTF 皮肤安装包','Choose VTF skin package'],['支持 7Z、ZIP 与含 materials / models 的文件夹','Supports 7Z, ZIP and folders containing materials / models'],['保持 materials / models 的原始目录结构。','Keep the original materials / models folder structure.'],['动态皮肤与关联模型会一同打包。','Animated skin files and related models are packaged together.'],['导入皮肤后，在这里预览安装计划','Import a skin to preview the installation plan'],['尚未导入 VTF 皮肤','No VTF skin imported'],['导入后显示资源列表、','Resource files, target archive and backup details'],['目标资源包和索引备份信息。','appear here after you import a skin.'],['资源数量','Resources'],['安装皮肤','Install skin'],['VTF 安装已就绪。','VTF installer ready.'],['索引与恢复记录','Index backups & history'],['安装前自动备份资源索引，可在武器库中恢复。','The resource index is backed up before installation. Restore it in the Arsenal.'],
    ['官方客户端','Official client'],['战役与官方多人游戏','Campaign & official multiplayer'],['单人战役 · 官方多人游戏','Campaign · Official multiplayer'],['战役 / 官方多人','Campaign / Official multiplayer'],['官方服务器','Official servers'],['原版客户端','Vanilla client'],['泰坦陨落 2','TITANFALL 2'],['泰坦陨落2','TITANFALL 2'],['安装版本','Installed version'],['本地游戏','Local game'],['退出游戏','Quit game'],
    ['正在读取社区模组…','Loading community mods…'],['浏览、搜索并安装北极星社区模组。','Browse, search and install Northstar community mods.'],['玩法模组','Gameplay'],['外观','Skins'],['客户端','Client'],['服务器','Server'],['搜索模组名称、作者…','Search mod names or authors…'],['搜索模组','Search mods'],['筛选模组','Filter mods'],['筛选','Filters'],['关闭模组商店','Close mod browser'],['北极星客户端说明','Northstar client guide'],['知道了','Got it'],
    ['取消','Cancel'],['保存设置','Save preferences'],['关闭设置','Close preferences'],['重新启动 TFX','Restart TFX'],['主题配色','Color theme'],['界面与主题','Appearance'],['选择你的界面配色，浅色与深色均支持毛玻璃效果。','Choose a color palette. Light and dark themes both support glass surfaces.'],['主题可即时预览，其他更改保存后生效','Preview themes instantly; save to keep your changes'],['搜索设置…','Search preferences…'],['搜索偏好设置','Search preferences'],
    ['尚未选择游戏目录','No game folder selected'],['检查中','Checking'],['目录不可用','Folder unavailable'],['已自动识别','Automatically detected'],['已识别','Detected'],['待验证','Awaiting validation'],['未配置','Not configured'],['检查通过','Validated'],['需要处理','Action needed'],['格式与目标资源已检查，可以安装','Format and target resources validated. Ready to install.'],['请先选择有效的游戏目录','Choose a valid game folder first'],['安装前资源将自动备份。','Pre-installation resources will be backed up.'],['处理提示后即可安装。','Resolve the message above to continue.'],['请先选择游戏目录，再导入皮肤','Choose a game folder, then import skin files'],['暂无备份','No backups yet'],['安装后保存备份记录，可恢复对应的安装前状态。','Installation creates a backup record that can restore the previous state.'],['恢复原版','Restore original'],['已恢复','Restored'],['安装未完成','Installation incomplete'],['无法读取 DDS 安装状态','Unable to load DDS installer status'],['皮肤操作未能完成','Skin operation did not complete'],['皮肤操作未完成','Skin operation incomplete'],['正在选择皮肤…','Choosing skin files…'],['正在检查皮肤…','Inspecting skin files…'],['正在备份安装前资源…','Backing up pre-installation resources…'],['皮肤安装完成','Skin files installed'],['皮肤写入与校验完成，安装前备份已保存。','Skin files written and verified. Pre-installation backups saved.'],['正在恢复原版皮肤…','Restoring original skin files…'],['原版皮肤已恢复','Original skin files restored'],['原版资源已恢复，哈希校验通过。','Original resources restored and hashes verified.'],['选择 DDS 文件夹','Choose DDS folder'],['无法打开备份目录','Unable to open backup folder'],['正在处理皮肤…','Processing skin files…'],['请选择一个皮肤包','Choose one skin package'],['多个皮肤文件请放入同一文件夹或 ZIP 安装包，再导入。','Put multiple skin files in one folder or ZIP package, then import it.'],['游戏目录不可用','Game folder unavailable'],
    ['正在处理 VTF 皮肤…','Processing VTF skin…'],['检测到未完成的安装，请先在武器库中恢复','An incomplete installation was found. Recover it in the Arsenal first.'],['检查通过，可以安装','Validated. Ready to install.'],['游戏资源暂不可用','Game resources unavailable'],['请等待操作完成','Wait for the current operation to finish'],['恢复完成后即可继续安装。','You can install after restoration completes.'],['部分资源已安装过其他皮肤；本次会备份当前状态。','Some resources already contain other skins. Their current state will be backed up.'],['安装前请退出游戏。','Close the game before installing.'],['先确认有效目录与 common VPK 资源。','Check the game folder and common VPK resources first.'],['关联资源','Related resource'],['安装后的索引备份和恢复记录会保存在这里。','Index backups and restoration records will appear here.'],['VTF 皮肤','VTF skin'],['已安装','Installed'],['待恢复','Awaiting restore'],['需检查','Needs review'],['恢复安装前','Restore previous'],['另一个操作正在执行','Another operation is running'],['操作未完成','Operation incomplete'],['VTF 操作未完成','VTF operation incomplete'],['正在读取皮肤包与关联资源','Reading skin package and related resources'],['导入完成，安装计划已生成。','Import complete. Installation plan created.'],['选择 VTF 皮肤','Choose VTF skin'],['正在清除导入的临时皮肤','Clearing imported temporary skin files'],['已清除选择。','Selection cleared.'],['已清除选择并释放临时缓存。','Selection cleared and temporary cache released.'],['正在备份索引并生成皮肤资源包','Backing up index and creating skin archive'],['皮肤安装完成。重新启动游戏后生效。','Skin installed. Restart the game to apply it.'],['正在恢复安装前的游戏索引','Restoring the previous game index'],['索引与安装前一致，恢复完成。','Index matches the pre-installation state. Restoration complete.'],['或选择完整皮肤文件夹','Or choose a complete skin folder'],['正在处理…','Processing…'],['一次导入一个皮肤包；多个资源请放在完整皮肤文件夹中。','Import one skin package at a time. Put multiple resources in a complete skin folder.'],
    ['极光青','Aurora'],['青绿 · 夜色','Teal · Night'],['深海蓝','Abyss'],['蔚蓝 · 深海','Blue · Ocean'],['星云紫','Nebula'],['紫罗兰 · 星云','Violet · Nebula'],['绯樱粉','Sakura'],['玫瑰 · 薄暮','Rose · Dusk'],['熔金橙','Ember'],['琥珀 · 暖夜','Amber · Warm night'],['青柠绿','Grove'],['嫩绿 · 林荫','Green · Woodland'],['砂岩棕','Sandstone'],['沙金 · 岩层','Sand · Stone'],['岩墨灰','Graphite'],['银灰 · 低饱和','Silver · Muted'],['冰川蓝','Glacier'],['浅蓝 · 晨光','Ice blue · Morning'],['云雾白','Mist'],['珍珠 · 薄雾','Pearl · Fog']
  ]
};
// IPC error copy uses I18n.text; keyed DDS copy also joins that exact-text map.
// Keep the final twenty theme labels in place for the existing theme patterns.
window.VyraLocales.pairs.splice(window.VyraLocales.pairs.length-20,0,
  ['一次只能导入一个 DDS 皮肤包。多个皮肤文件请放入同一文件夹或 ZIP 安装包，再导入。','Import one DDS skin package at a time. Put multiple skin files in one folder or ZIP package, then import it.'],
  ['这不是 DDS 皮肤，而是 VTF 皮肤。请到「VTF 安装」导入。','This is a VTF skin, not a DDS skin. Import it in the VTF installer.'],
  ['这不是 DDS 皮肤或受支持的 DDS 安装包。仅支持 .dds 文件、包含 DDS 的 ZIP 或文件夹；VTF 皮肤请到「VTF 安装」导入。','This is not a DDS skin or a supported DDS package. Choose a .dds file, a ZIP containing DDS skin files, or a folder. Import VTF skins in the VTF installer.'],
  ['这不是 DDS 皮肤：所选项目中没有 DDS 皮肤。VTF 皮肤请到「VTF 安装」导入。','This is not a DDS skin: the selected item contains no DDS skin files. Import VTF skins in the VTF installer.'],
  ['请先重新导入并校验 DDS 皮肤，之前的选择已失效','Import and inspect a DDS skin again. The previous selection is no longer valid.'],
  ['DDS 选择已更新，请重新确认当前皮肤包','The DDS selection has changed. Inspect the current skin package again.'],
  ['这不是兼容的 VTF 皮肤，而是 DDS 皮肤。请到「DDS 安装」导入。','This is a DDS skin, not a compatible VTF skin. Import it in the DDS installer.'],
  ['这不是受支持的 VTF 安装包。请选择含 materials / models 结构的 ZIP、7Z 或文件夹；单独的 VTF 文件无法确定游戏资源路径。','This is not a supported VTF package. Choose a ZIP, 7Z or folder containing a materials / models structure. A standalone VTF file does not provide its game resource path.'],
  ['这不是兼容的 VTF 皮肤：所选项目中没有 VTF 皮肤。','This is not a compatible VTF skin: the selected item contains no VTF skin files.'],
  ['请先重新导入并校验兼容的 VTF 皮肤，之前的选择已失效','Import and inspect a compatible VTF skin again. The previous selection is no longer valid.'],
  ...Object.entries(window.VyraLocales.messages).filter(([key])=>key.startsWith('ddsOriginal.')).map(([,pair])=>pair),
  ['皮肤包未包含的部分缺少可靠的原版资源，直接覆盖会保留旧皮肤。请选择原版资源备份，或通过 Steam 验证游戏文件后刷新。','Verified original data is unavailable for skin files omitted by this package. Direct replacement would keep the old skin. Choose an original resource backup, or verify the game through Steam and check again.'],
  ['缺失的皮肤文件将用经校验的原版资源补齐，避免留下旧皮肤。','Missing skin files will be filled with verified original resources to remove the previous skin.'],
  ['所选资源不能通过当前 Steam 版本的原版校验，未修改游戏。请选择未安装 DDS 的原版资源备份。','The selected resource does not match the current Steam version. The game was not changed. Choose an original resource backup with no DDS skins installed.'],
  ['当前目录未找到受支持的 Steam 资源清单，请选择原版资源备份','No supported Steam resource manifest was found for this folder. Choose an original resource backup.'],
  ['请先退出游戏，再验证游戏文件','Close the game before verifying its files'],
  ...Object.entries(window.VyraLocales.messages).filter(([key])=>key.startsWith('ddsGuard.')).map(([,pair])=>pair),
  ['画面配置超过支持的大小','Graphics config exceeds the supported size'],
  ['画面配置不是有效的 UTF-8 文件','Graphics config is not valid UTF-8'],
  ['画面配置结构不完整，未修改文件','Graphics config structure is incomplete. The file was not changed.'],
  ['皮肤兼容性设置缺失、重复或格式不正确，未修改文件','Skin compatibility settings are missing, duplicated or invalid. The file was not changed.'],
  ['记录的皮肤兼容性设置无效','Recorded skin compatibility settings are invalid'],
  ['DDS 设置记录超过支持的大小','DDS settings record exceeds the supported size'],
  ['皮肤保护设置记录超过支持的大小','Skin protection settings record exceeds the supported size'],
  ['皮肤保护设置记录无法读取，请保留记录并重新检查','Skin protection settings record could not be read. Keep the record and check again.'],
  ['皮肤保护设置记录与当前目录不匹配','Skin protection settings record does not match the current game folder'],
  ['皮肤兼容性设置快照无效，请重新记录当前设置','Skin compatibility settings record is invalid. Record your current settings again.'],
  ['有未完成的皮肤安装，请先在“皮肤安装 → 武器库”恢复未完成的操作','An incomplete skin installation was found. Recover the unfinished operation in Skin installer → Arsenal first.'],
  ['有未完成的皮肤安装，请在“皮肤安装 → 武器库”恢复未完成的操作后再启动游戏','An incomplete skin installation was found. Recover the unfinished operation in Skin installer → Arsenal before launching the game.'],
  ['皮肤保护设置正在检查，请稍后重试','Skin protection settings are being checked. Try again shortly.'],
  ['安装 DDS 或 VTF 皮肤后才能记录当前皮肤兼容性设置','Install a DDS or VTF skin before recording current skin compatibility settings'],
  ['请先恢复未完成的皮肤安装','Restore the incomplete skin installation first'],
  ['皮肤保护开关无效','Invalid skin protection setting'],
  ['已安装皮肤，但尚未记录兼容性设置；可在偏好设置中记录当前设置','Skins are installed, but no compatibility settings are recorded. Record current settings in Preferences.'],
  ['DDS 设置记录无法读取，请保留记录并重新检查','DDS settings record could not be read. Keep the record and check again.'],
  ['DDS 设置记录与当前目录不匹配','DDS settings record does not match the current game folder'],
  ['DDS 皮肤兼容性设置快照无效，请重新记录当前设置','DDS skin compatibility settings record is invalid. Record your current settings again.'],
  ['未找到游戏画面配置，请先运行一次游戏再记录皮肤兼容性设置','Game graphics config was not found. Run the game once, then record skin compatibility settings.'],
  ['有未完成的 DDS 安装，请先恢复对应备份','An incomplete DDS installation was found. Restore its backup first.'],
  ['DDS 设置正在检查，请稍后重试','DDS settings are being checked. Try again shortly.'],
  ['皮肤兼容性设置快照无效','Skin compatibility settings record is invalid'],
  ['请先退出游戏，再记录皮肤兼容性设置','Close the game before recording skin compatibility settings'],
  ['安装 DDS 后才能记录当前皮肤兼容性设置','Install DDS skin files before recording current skin compatibility settings'],
  ['请先恢复未完成的 DDS 安装','Restore the incomplete DDS installation first'],
  ['游戏已启动，皮肤兼容性设置记录已取消','The game has started. Skin compatibility settings recording was cancelled.'],
  ['DDS 保护开关无效','Invalid DDS protection setting'],
  ['请先选择游戏目录','Choose a game folder first'],
  ['有未完成的 DDS 安装，请在 DDS 页面恢复对应备份后再启动游戏','An incomplete DDS installation was found. Restore its backup on the DDS page before launching the game.'],
  ['已安装 DDS，但尚未记录皮肤兼容性设置；可在 DDS 页面记录当前设置','DDS skin files are installed, but no skin compatibility settings are recorded. Record current settings on the DDS page.'],
  ['游戏正在运行，无法恢复皮肤兼容性设置；请先退出游戏','The game is running. Close it before restoring skin compatibility settings.'],
  ['画面配置被其他程序修改，请重试启动','Another program changed the graphics config. Try launching again.'],
  ['游戏已启动，设置恢复已取消','The game has started. Settings restoration was cancelled.'],
  ['皮肤兼容性设置恢复后校验失败，请检查配置文件','Skin compatibility settings failed verification after restoration. Check the config file.']
);

// Backup deletion diagnostics preserve record names and local paths.
window.VyraLocales.pairs.push(
  ['这份备份仍用于跨格式皮肤恢复，请先恢复对应皮肤','This backup is still required for a cross-format skin restore. Restore the corresponding skin first.'],
  ['这份备份仍用于皮肤替换或恢复，请先恢复皮肤再删除','This backup is still required for skin replacement or restoration. Restore the skin before deleting it.'],
  ['这份记录保留原版皮肤边界，较早的皮肤备份仍依赖它','Earlier skin backups still depend on this record to identify the original skin data.'],
  ['备份目录包含链接，已停止删除以保护其他文件','The backup folder contains a link. Deletion stopped to protect other files.'],
  ['皮肤备份编号无效','Invalid skin backup ID'],
  ['皮肤备份目录无效','Invalid skin backup folder'],
  ['皮肤备份记录文件无效','Invalid skin backup record file'],
  ['皮肤备份记录无效','Invalid skin backup record'],
  ['备份与当前游戏目录不匹配','This backup does not belong to the current game directory.'],
  ['备份记录已变化，请刷新后重试','The backup record changed. Refresh and try again.'],
  ['备份目录包含不受支持的文件，已停止删除','The backup folder contains an unsupported file. Deletion stopped.'],
  ['备份文件已变化，已停止删除','A backup file changed. Deletion stopped.'],
  ['备份目录已变化，已停止删除','The backup folder changed. Deletion stopped.'],
  ['DDS 备份记录不存在','The DDS backup record does not exist.'],
  ['皮肤格式无效','Invalid skin format'],
  ['跨格式恢复记录无法读取，请保留备份并修复记录','The cross-format recovery record could not be read. Keep the backup and repair its record.'],
  ['这份备份仍用于皮肤恢复，请先恢复后再删除。','This backup is still needed for skin restoration. Restore it before deleting it.'],
  ['已删除所选备份及其恢复文件。','The selected backup and its recovery files have been deleted.'],
  ['备份已删除','Backup deleted'],
  ['部分恢复记录已保留','Recovery history retained']
);
window.VyraLocales.pairs.push(
  ['GitHub 没有返回可用的正式版本','GitHub did not return an available stable release.'],
  ['更新信息中的仓库或下载地址不匹配','The repository or download URL in the release data does not match.'],
  ['GitHub 更新检查超时，请稍后重试','The GitHub update check timed out. Try again later.'],
  ['GitHub 更新信息超过允许大小','The GitHub release response exceeded the allowed size.'],
  ['无法连接 GitHub，请检查网络后重试','Could not connect to GitHub. Check your connection and retry.'],
  ['GitHub 更新连接中断，请重试','The GitHub connection was interrupted. Try again.'],
  ['GitHub 请求次数达到限制，请稍后重试','GitHub rate limit reached. Try again later.'],
  ['GitHub 拒绝了更新检查请求','GitHub rejected the update check.'],
  ['GitHub 更新检查失败，请稍后重试','The GitHub update check failed. Try again later.'],
  ['当前启动器版本无法比较','The current launcher version could not be compared.'],
  ['GitHub 返回的更新信息无法读取','The GitHub release data could not be read.'],
  ['更新版本无法比较','The update version could not be compared.'],
  ['请选择版本页面或下载链接','Choose the release page or download link.'],
  ['请先重新检查更新，再打开官方链接','Check for updates again before opening the official link.'],
  ['这个版本没有可用的官方下载链接','This release does not have an available official download link.'],
  ['无法打开官方更新页面','Could not open the official update page.']
);

Object.assign(window.VyraLocales.messages,{
  "ddsResource.repairable": [
    "可自动修复",
    "Automatic repair available"
  ],
  "ddsResource.needsSource": [
    "需要补齐游戏资源",
    "Game resources need restoring"
  ],
  "ddsResource.repairHint": [
    "安装前会修复资源文件，再备份并安装皮肤。共享文件将建立独立副本。",
    "TFX will repair the resource files, then back up and install the skin. Shared files will be copied independently."
  ],
  "ddsResource.sourceHint": [
    "请选择完整的原版资源备份，TFX 校验后会补齐缺失或不完整的游戏文件；也可以通过 Steam 验证文件，完成后重新检查。",
    "Choose a complete original resource backup. TFX will verify it and restore missing or incomplete game files. You can also verify files through Steam, then check again."
  ],
  "ddsResource.installHint": [
    "修复可能需要额外磁盘空间；完成后自动继续安装。",
    "Repair may require additional disk space. Installation will continue automatically."
  ],
  "ddsResource.install": [
    "修复并安装皮肤",
    "Repair and install skin"
  ],
  "ddsResource.preparing": [
    "正在修复游戏资源…",
    "Repairing game resources…"
  ],
  "launch.eaStarting": [
    "正在打开 EA App…",
    "Opening EA App…"
  ],
  "launch.eaWaiting": [
    "正在等待 EA App 就绪…",
    "Waiting for EA App to be ready…"
  ],
  "launch.eaRetry": [
    "EA App 已就绪，正在继续启动游戏…",
    "EA App is ready. Continuing game launch…"
  ]
});
window.VyraLocales.pairs.push(...[
  [
    "可自动修复",
    "Automatic repair available"
  ],
  [
    "需要补齐游戏资源",
    "Game resources need restoring"
  ],
  [
    "安装前会修复资源文件，再备份并安装皮肤。共享文件将建立独立副本。",
    "TFX will repair the resource files, then back up and install the skin. Shared files will be copied independently."
  ],
  [
    "请选择完整的原版资源备份，TFX 校验后会补齐缺失或不完整的游戏文件；也可以通过 Steam 验证文件，完成后重新检查。",
    "Choose a complete original resource backup. TFX will verify it and restore missing or incomplete game files. You can also verify files through Steam, then check again."
  ],
  [
    "修复可能需要额外磁盘空间；完成后自动继续安装。",
    "Repair may require additional disk space. Installation will continue automatically."
  ],
  [
    "修复并安装皮肤",
    "Repair and install skin"
  ],
  [
    "正在修复游戏资源…",
    "Repairing game resources…"
  ],
  [
    "正在打开 EA App…",
    "Opening EA App…"
  ],
  [
    "正在等待 EA App 就绪…",
    "Waiting for EA App to be ready…"
  ],
  [
    "EA App 已就绪，正在继续启动游戏…",
    "EA App is ready. Continuing game launch…"
  ],
  [
    "DDS 资源范围无效",
    "Invalid DDS resource range"
  ],
  [
    "请先退出游戏，再修复皮肤资源。",
    "Close the game before repairing skin resources."
  ],
  [
    "游戏已启动，资源修复已取消。",
    "The game started. Resource repair was cancelled."
  ],
  [
    "原版资源的大小与当前 Steam 版本不匹配，未修改游戏。",
    "The original resource size does not match the current Steam version. The game was not changed."
  ],
  [
    "Steam 资源清单未覆盖整个游戏文件，无法安全补齐。",
    "The Steam resource manifest does not cover the entire game file. Restoration cannot proceed safely."
  ],
  [
    "原版资源未通过 Steam 完整校验，未修改游戏。",
    "The original resource failed full Steam verification. The game was not changed."
  ],
  [
    "原版资源不完整，未修改游戏。",
    "The original resource is incomplete. The game was not changed."
  ],
  [
    "没有找到完整且通过校验的原版资源。可选择原版资源备份，或让 Steam 恢复缺失文件后继续安装。",
    "No complete verified original resource was found. Choose an original resource backup, or let Steam restore missing files before continuing installation."
  ],
  [
    "未找到当前游戏的 Steam 资源清单，无法验证补齐文件。请选择 Steam 原版资源或先验证游戏文件。",
    "No Steam resource manifest was found for this game. Replacement files cannot be verified. Choose Steam original resources or verify the game files first."
  ],
  [
    "游戏资源在修复期间发生变化，请重试。",
    "Game resources changed during repair. Try again."
  ],
  [
    "复制期间原版资源发生变化，修复已取消。",
    "Original resources changed while copying. Repair was cancelled."
  ],
  [
    "修复副本校验失败，未修改游戏。",
    "The repair copy failed verification. The game was not changed."
  ],
  [
    "修复文件未通过最终检查。",
    "The repaired file failed the final check."
  ],
  [
    "原版资源在校验前发生变化，请重试。",
    "The original resource changed before verification. Try again."
  ],
  [
    "原版资源不完整或已变化，未修改游戏。",
    "The original resource is incomplete or has changed. The game was not changed."
  ],
  [
    "原版资源已变化，请重试。",
    "The original resource has changed. Try again."
  ],
  [
    "资源在复制前发生变化，请重试。",
    "The resource changed before copying. Try again."
  ],
  [
    "资源修复写入失败。",
    "Could not write the repaired resource."
  ],
  [
    "所选备份不含所需的原版资源。",
    "The selected backup does not contain the required original resources."
  ]
]);

window.VyraLocales.pairs.push(...[
  [
    "无法读取 EA App 进程，请稍后重试启动。",
    "Could not read EA App processes. Try launching again shortly."
  ],
  [
    "未找到 EA App 或 Origin，请先安装并登录 EA App，再启动游戏。",
    "EA App or Origin was not found. Install and sign in to EA App before launching the game."
  ],
  [
    "EA App 未能启动，请打开并登录 EA App 后重试。",
    "EA App could not start. Open EA App, sign in, and try again."
  ],
  [
    "EA App 尚未准备好，请检查它的登录或更新提示，处理后再启动游戏。",
    "EA App is not ready. Check its sign-in or update prompts, resolve them, and then launch the game again."
  ]
]);

window.VyraLocales.pairs.push(["游戏资源的写入权限无法自动恢复，请关闭占用该文件的程序或检查目录权限。","Write access to the game resource could not be restored automatically. Close programs using the file or check folder permissions."]);

Object.assign(window.VyraLocales.messages,{
  "skinRecovery.title": [
    "游戏资源恢复",
    "Restore game resources"
  ],
  "skinRecovery.source": [
    "从原版目录恢复并安装",
    "Restore from original folder and install"
  ],
  "skinRecovery.steam": [
    "下载缺失的原版资源",
    "Download missing original resources"
  ],
  "skinRecovery.continue": [
    "修复完成，继续安装",
    "Repair finished · Continue installation"
  ],
  "skinRecovery.cancel": [
    "取消",
    "Cancel"
  ],
  "skinRecovery.openSteam": [
    "打开 Steam 恢复",
    "Open Steam recovery"
  ],
  "skinRecovery.autoHint": [
    "已找到可用的恢复来源。选择“修复并安装皮肤”，会先补齐资源，再继续安装。",
    "A recovery source is available. Choose “Repair and install skin” to restore resources and continue installation."
  ],
  "skinRecovery.sourceHint": [
    "没有旧备份也可以恢复：选择另一份完整原版游戏目录，或让 Steam 下载缺失资源。恢复完成后，当前导入的皮肤可以继续安装。",
    "You can recover without an earlier backup: choose another complete original game folder, or let Steam download missing resources. You can then continue installing the currently imported skin."
  ],
  "skinRecovery.confirm": [
    "Steam 会从官方服务器验证并恢复原版游戏文件，可能需要下载资源，也可能还原已有皮肤。请等待 Steam 完成，再点“修复完成，继续安装”。当前导入包会保留。",
    "Steam will verify and restore original game files from its official servers. This may download resources and reset existing skins. Wait for Steam to finish, then choose “Repair finished · Continue installation”. Your imported package will be kept."
  ],
  "skinRecovery.steamOpened": [
    "Steam 恢复已打开。完成后回到这里继续安装，无需重新导入皮肤。",
    "Steam recovery is open. Return here when it finishes to continue installation without importing the skin again."
  ],
  "skinRecovery.selectionChanged": [
    "游戏目录或皮肤选择已改变，请重新确认后再安装。",
    "The game folder or selected skin has changed. Check your selection before installing."
  ],
  "skinRecovery.notReady": [
    "资源尚未恢复完整，请等待修复完成，或选择完整原版目录后重试。",
    "Resources have not been fully restored. Wait for repair to finish, or choose a complete original folder and try again."
  ]
});
window.VyraLocales.pairs.push(...[["游戏资源恢复","Restore game resources"],["从原版目录恢复并安装","Restore from original folder and install"],["下载缺失的原版资源","Download missing original resources"],["修复完成，继续安装","Repair finished · Continue installation"],["取消","Cancel"],["打开 Steam 恢复","Open Steam recovery"],["已找到可用的恢复来源。选择“修复并安装皮肤”，会先补齐资源，再继续安装。","A recovery source is available. Choose “Repair and install skin” to restore resources and continue installation."],["没有旧备份也可以恢复：选择另一份完整原版游戏目录，或让 Steam 下载缺失资源。恢复完成后，当前导入的皮肤可以继续安装。","You can recover without an earlier backup: choose another complete original game folder, or let Steam download missing resources. You can then continue installing the currently imported skin."],["Steam 会从官方服务器验证并恢复原版游戏文件，可能需要下载资源，也可能还原已有皮肤。请等待 Steam 完成，再点“修复完成，继续安装”。当前导入包会保留。","Steam will verify and restore original game files from its official servers. This may download resources and reset existing skins. Wait for Steam to finish, then choose “Repair finished · Continue installation”. Your imported package will be kept."],["Steam 恢复已打开。完成后回到这里继续安装，无需重新导入皮肤。","Steam recovery is open. Return here when it finishes to continue installation without importing the skin again."],["游戏目录或皮肤选择已改变，请重新确认后再安装。","The game folder or selected skin has changed. Check your selection before installing."],["资源尚未恢复完整，请等待修复完成，或选择完整原版目录后重试。","Resources have not been fully restored. Wait for repair to finish, or choose a complete original folder and try again."],["选择完整原版游戏目录或资源文件夹","Choose a complete original game or resource folder"]]);

Object.assign(window.VyraLocales.messages,{
  "skinRecovery.title": [
    "原皮资源与文件修复",
    "Original skin resources and file repair"
  ],
  "skinRecovery.source": [
    "选择原版资源并安装",
    "Choose original resources and install"
  ],
  "skinRecovery.steam": [
    "单独下载原版资源",
    "Download original resources separately"
  ],
  "skinRecovery.continue": [
    "重新检查并安装",
    "Check again and install"
  ],
  "skinRecovery.cancel": [
    "取消",
    "Cancel"
  ],
  "skinRecovery.openSteam": [
    "开始单独下载",
    "Start separate download"
  ],
  "skinRecovery.autoHint": [
    "已找到本地恢复来源。修复时保留现有内容，只补齐必要资源，再安装当前皮肤。",
    "A local recovery source is available. Repair preserves existing content, fills only the required resources, and then installs the selected skin."
  ],
  "skinRecovery.sourceHint": [
    "优先使用本地原皮缓存或原版资源。没有可用来源时，可选单独下载；文件存入独立缓存，不执行 Steam 整体验证。",
    "Local original-skin caches and original resources are used first. If no source is available, a separate download is optional. Files go into an isolated cache; Steam does not verify the whole installation."
  ],
  "skinRecovery.confirm": [
    "将下载 {count} 个原版资源文件，共约 {size}，另需约 32 MB 的可选 DepotDownloader 工具。下载到独立缓存，不重置已有皮肤。此第三方工具通过 Steam 手机应用扫码确认下载权限，不需要在 TFX 输入密码。完成后校验并安装当前皮肤。",
    "Download {count} original resource files, about {size}, plus an optional DepotDownloader tool of about 32 MB. Downloads use an isolated cache and do not reset existing skins. This third-party tool uses the Steam mobile app to confirm download access by QR code; TFX does not ask for your password. After verification, the selected skin will be installed."
  ],
  "skinRecovery.selectionChanged": [
    "游戏目录或皮肤选择已改变，请重新确认后再安装。",
    "The game folder or selected skin has changed. Check your selection before installing."
  ],
  "skinRecovery.notReady": [
    "资源尚未恢复完整，请选择可用的原版资源后重试。",
    "Resources have not been fully restored. Choose available original resources and try again."
  ],
  "skinRecovery.qr": [
    "使用 Steam 手机应用扫码确认下载权限",
    "Use the Steam mobile app to scan and confirm download access"
  ],
  "skinRecovery.stop": [
    "取消下载",
    "Cancel download"
  ],
  "skinRecovery.cancelled": [
    "下载已取消，当前皮肤选择已保留。",
    "Download cancelled. The selected skin has been kept."
  ],
  "skinRecovery.preparing": [
    "正在准备独立资源下载…",
    "Preparing the separate resource download…"
  ]
});
window.VyraLocales.pairs.push(...[["原皮资源与文件修复","Original skin resources and file repair"],["选择原版资源并安装","Choose original resources and install"],["单独下载原版资源","Download original resources separately"],["重新检查并安装","Check again and install"],["取消","Cancel"],["开始单独下载","Start separate download"],["已找到本地恢复来源。修复时保留现有内容，只补齐必要资源，再安装当前皮肤。","A local recovery source is available. Repair preserves existing content, fills only the required resources, and then installs the selected skin."],["优先使用本地原皮缓存或原版资源。没有可用来源时，可选单独下载；文件存入独立缓存，不执行 Steam 整体验证。","Local original-skin caches and original resources are used first. If no source is available, a separate download is optional. Files go into an isolated cache; Steam does not verify the whole installation."],["将下载 {count} 个原版资源文件，共约 {size}，另需约 32 MB 的可选 DepotDownloader 工具。下载到独立缓存，不重置已有皮肤。此第三方工具通过 Steam 手机应用扫码确认下载权限，不需要在 TFX 输入密码。完成后校验并安装当前皮肤。","Download {count} original resource files, about {size}, plus an optional DepotDownloader tool of about 32 MB. Downloads use an isolated cache and do not reset existing skins. This third-party tool uses the Steam mobile app to confirm download access by QR code; TFX does not ask for your password. After verification, the selected skin will be installed."],["游戏目录或皮肤选择已改变，请重新确认后再安装。","The game folder or selected skin has changed. Check your selection before installing."],["资源尚未恢复完整，请选择可用的原版资源后重试。","Resources have not been fully restored. Choose available original resources and try again."],["使用 Steam 手机应用扫码确认下载权限","Use the Steam mobile app to scan and confirm download access"],["取消下载","Cancel download"],["下载已取消，当前皮肤选择已保留。","Download cancelled. The selected skin has been kept."],["正在准备独立资源下载…","Preparing the separate resource download…"],["缺少游戏资源，请选择原版资源来源补齐缺失文件","Missing game resource. Choose an original resource source to restore the missing file."],["游戏资源不完整，将保留现有内容并补齐缺失部分","The game resource is incomplete. Existing content will be preserved and missing parts restored."],["未找到当前游戏的官方资源清单，无法验证补齐文件。请先获取对应版本的资源清单。","The official resource manifest for this game was not found. Obtain the manifest for the matching version before verifying replacement files."],["没有找到完整且通过校验的原版资源。请选择原版资源来源，或单独下载所需文件后继续安装。","No complete and verified original resources were found. Choose an original resource source, or download the required files separately before continuing installation."],["缺失的是自定义皮肤文件，请重新导入对应皮肤包；原版资源无法替代它。","The missing file belongs to a custom skin. Import its skin package again; original resources cannot replace it."],["皮肤包未包含的部分缺少可靠的原版资源，直接覆盖会保留旧皮肤。请选择原版资源来源，或单独下载所需资源。","Verified original resources are needed for files omitted by this skin package. Direct replacement would leave the old skin. Choose original resources or download the required resources separately."]]);

// Selective resource downloader diagnostics; no account data enters these maps.
window.VyraLocales.pairs.push(...[
  [
    "Steam 资源缓存包含链接或异常文件，已停止操作。",
    "Steam resource cache contains a link or unexpected file"
  ],
  [
    "请选择 1 至 20 个皮肤资源文件。",
    "Select between one and twenty skin resources"
  ],
  [
    "只能下载受支持的 Titanfall 2 皮肤资源。",
    "Only known Titanfall 2 skin resources may be downloaded"
  ],
  [
    "按文件下载 Steam 资源目前仅支持 Windows。",
    "Selective Steam downloads currently require Windows"
  ],
  [
    "资源下载已取消。",
    "Resource download cancelled"
  ],
  [
    "无法检查独立的 Steam 登录环境，请重试。",
    "The isolated Steam sign-in profile could not be checked"
  ],
  [
    "下载工具返回了无效信息，已停止下载。",
    "Download helper produced an invalid output line"
  ],
  [
    "下载工具未确认指定的资源文件列表，已停止下载。",
    "The Steam helper did not confirm the exact resource file list"
  ],
  [
    "请设置有效的资源缓存目录。",
    "An absolute resource cache directory is required"
  ],
  [
    "请先选择已安装的 Titanfall 2 游戏目录。",
    "Select the installed Titanfall 2 directory first"
  ],
  [
    "无法读取当前安装版本的 Steam 资源清单。",
    "The installed Steam resource manifest is unavailable"
  ],
  [
    "Steam 安装清单已改变，请重新检查修复方案。",
    "The installed Steam manifest changed; refresh the repair plan"
  ],
  [
    "Steam 资源清单未包含全部所选文件，无法继续下载。",
    "The Steam manifest does not contain every selected resource"
  ],
  [
    "Steam 资源清单中的文件区块不完整，无法验证下载。",
    "The Steam resource chunks are incomplete"
  ],
  [
    "所选资源的文件大小无效。",
    "The selected resource size is invalid"
  ],
  [
    "缓存中的下载工具已被修改，请删除该工具缓存后重试。",
    "The cached Steam helper was modified; remove its cache and retry"
  ],
  [
    "无法下载 DepotDownloader 工具，请检查网络后重试。",
    "The DepotDownloader helper could not be downloaded. Check your network and try again."
  ],
  [
    "DepotDownloader 工具未通过文件校验，已停止安装。",
    "The DepotDownloader helper did not match its pinned checksum"
  ],
  [
    "解压后的下载工具未通过文件校验，已停止安装。",
    "The extracted Steam helper did not match its pinned checksum"
  ],
  [
    "资源下载超过时间限制，请重试。",
    "The resource download exceeded its time limit"
  ],
  [
    "Steam 扫码登录超时，请重新扫码。",
    "Steam QR sign-in timed out; try again"
  ],
  [
    "Steam 资源下载长时间无响应，请重试。",
    "The Steam download stopped responding; try again"
  ],
  [
    "下载工具未能启动，请检查缓存目录后重试。",
    "The Steam download helper could not start"
  ],
  [
    "DepotDownloader 工具未能解压，请检查缓存目录后重试。",
    "The DepotDownloader helper could not be extracted. Check the cache folder and try again."
  ],
  [
    "Steam 未能下载所选资源，请确认账号拥有 Titanfall 2，并检查网络和磁盘空间。",
    "Steam could not download the selected resources. Check ownership, connection and free disk space."
  ],
  [
    "Steam 登录未完成，请用拥有 Titanfall 2 的账号在 Steam 手机应用中扫码确认。",
    "Steam sign-in was not completed. Use the Steam mobile app and an account that owns Titanfall 2."
  ],
  [
    "另一个资源正在下载，请等待完成或先取消。",
    "A resource download is already running"
  ],
  [
    "资源下载缓存必须放在游戏安装目录之外。",
    "Resource downloads must be stored outside the installed game"
  ],
  [
    "无法检查资源缓存所在磁盘的可用空间。",
    "Free space in the resource cache could not be checked"
  ],
  [
    "磁盘空间不足，无法存放所选资源及下载过程中的临时副本。",
    "There is not enough free space for the selected resources and their temporary download copies"
  ],
  [
    "Windows 将独立登录环境重定向到了其他目录，已在登录前停止下载。",
    "Windows redirected the isolated Steam sign-in profile; the download was stopped before login"
  ],
  [
    "缺少经校验的原版 VTF 资源索引。请选择原版资源来源，补齐同一武器的缺失皮肤部分。",
    "A verified original VTF resource index is missing. Choose original resources to restore omitted skin parts for the same weapon."
  ],
  [
    "原版 VTF 索引缓存与当前游戏版本不匹配或已损坏，请重新选择原版资源。",
    "The original VTF index cache is damaged or does not match the installed game version. Choose original resources again."
  ],
  [
    "所选资源未通过当前 Steam 版本的原版 VTF 索引校验，未修改游戏。",
    "The selected resources failed original VTF index verification for the installed Steam version. The game was not changed."
  ],
  [
    "原版皮肤缓存路径包含链接，已停止读取",
    "The original skin cache path contains a link. Reading was stopped."
  ],
  [
    "单独下载原版资源",
    "Download original resources separately"
  ],
  [
    "仅下载所需的原版资源到独立缓存，不执行 Steam 整体验证，不重置已有皮肤。下载完成后校验资源，再继续安装当前皮肤。",
    "Only required original resources are downloaded to an isolated cache. Steam does not verify the whole installation or reset existing skins. After verification, installation of the selected skin continues."
  ],
  [
    "开始单独下载",
    "Start separate download"
  ],
  [
    "选择原版资源来源，或单独下载所需资源后继续安装。",
    "Choose an original resource source, or download the required resources separately to continue installation."
  ]
]);

window.VyraLocales.pairs.push(["当前游戏资源版本与 DDS 安装位置不匹配。请更新 TFX 以匹配当前游戏资源版本，未修改游戏。","The game resource version does not match the DDS installation layout. Update TFX for the current game resources. The game was not changed."]);

window.VyraLocales.pairs.push(["离线原皮包已损坏或与当前游戏资源版本不兼容，未修改游戏。","The offline original skin pack is damaged or incompatible with the current game resources. The game was not changed."],["离线原皮包路径包含链接或非普通文件，已停止读取。","The offline original skin pack path contains a link or a non-regular file. Reading was stopped."]);




// Public one-click skin recovery guidance.
Object.assign(window.VyraLocales.messages,{
  "skinRecovery.steamPrivacyTitle": [
    "Steam 授权与隐私",
    "Steam authorization and privacy"
  ],
  "skinRecovery.steamPrivacyData": [
    "无需在 TFX 输入 Steam 账号或密码。TFX 不会将 Steam 登录凭证上传到作者或其他第三方云端；扫码登录和游戏所有权验证仍需连接 Steam 服务器。",
    "You do not enter a Steam account name or password in TFX. TFX does not upload Steam sign-in credentials to the developer or any other third-party cloud service. QR sign-in and game ownership verification still require a connection to Steam servers."
  ],
  "skinRecovery.steamPrivacySession": [
    "本次会话由下载助手在本机隔离环境中临时使用，不启用“记住登录”，正常完成后清理临时认证数据。TFX 不将密码、令牌或二维码写入应用日志。",
    "The download helper uses this session temporarily in an isolated local environment. Persistent sign-in is not enabled, and temporary authentication data is removed after normal completion. TFX does not write passwords, tokens or QR codes to application logs."
  ],
  "skinRecovery.autoInstall": [
    "自动修复并安装",
    "Repair and install automatically"
  ],
  "skinRecovery.downloadInstall": [
    "下载并安装皮肤",
    "Download and install skin"
  ],
  "skinRecovery.fileDetails": [
    "查看所需文件",
    "View required files"
  ],
  "skinRecovery.guideTitle": [
    "仅在本地资源不足时需要 Steam 授权",
    "Steam authorization is needed only when local resources are insufficient"
  ],
  "skinRecovery.guide1": [
    "保持游戏关闭，确认下载量与可用空间，然后点“下载并安装皮肤”。TFX 会自动准备下载工具。",
    "Keep the game closed, check the download size and free space, then choose “Download and install skin”. TFX prepares the download helper automatically."
  ],
  "skinRecovery.guide2": [
    "打开 Steam 手机应用，在 Steam 令牌（Steam Guard）中扫描下方二维码，并用拥有 Titanfall 2 的账号确认登录。不需要在 TFX 输入账号或密码。",
    "Open the Steam mobile app, scan the QR code below from Steam Guard, and approve sign-in with an account that owns Titanfall 2. You do not enter an account name or password in TFX."
  ],
  "skinRecovery.guide3": [
    "授权后自动下载、校验、补齐资源并安装当前皮肤，无需重新导入。分阶段恢复时如再次出现二维码，用同一账号确认即可。",
    "After authorization, TFX downloads, verifies, repairs resources and installs the selected skin automatically. No new import is needed. If staged recovery shows another QR code, approve it with the same account."
  ],
  "skinRecovery.authHint": [
    "二维码由 Steam 登录流程生成。若超时，请取消后重试；没有手机扫码条件时，可改选完整原版资源目录。TFX 不保留本次登录会话。",
    "The QR code comes from the Steam sign-in flow. If it expires, cancel and retry. If you cannot scan it with the mobile app, choose a complete original resource folder instead. TFX does not retain this sign-in session."
  ],
  "skinRecovery.budget": [
    "缓存所在磁盘至少需要 {space} 可用空间（包含下载临时副本）。",
    "The cache drive needs at least {space} of free space, including temporary download copies."
  ],
  "skinRecovery.stagedBudget": [
    "先恢复小型索引，再只下载实际缺失的文件。总下载上限为 {size}，缓存至少预留 {space}；健康文件会跳过。",
    "The small index is restored first, then only files actually missing are downloaded. The total download upper limit is {size}; reserve at least {space} for the cache. Healthy files are skipped."
  ],
  "skinRecovery.stagedConfirm": [
    "分两阶段恢复：先下载 {count} 个已知资源文件，约 {size}，其中包含用于确定后续文件的小型索引。首次使用还需约 32 MB 的下载工具。全部下载存入独立缓存，不执行游戏整体验证。",
    "Recovery has two stages: first download {count} known resource files, about {size}, including the small index used to identify remaining files. First use also needs a download helper of about 32 MB. All downloads go into a separate cache; the whole game is not validated."
  ],
  "skinRecovery.sourceHint": [
    "TFX 会先检查本机资源和可信备份。此前装过皮肤也可以使用；已被修改的内容不会当成原皮。没有可靠来源时，仅下载所需原版资源到独立缓存。",
    "TFX checks local resources and verified backups first. Previously installed skins are supported; modified data is never treated as original. If no trusted source exists, only required original resources are downloaded to a separate cache."
  ],
  "skinRecovery.confirm": [
    "需下载 {count} 个原版资源文件，约 {size}；首次使用还需约 32 MB 的下载工具。文件存入独立缓存，仅替换当前皮肤涉及的武器，不执行游戏整体验证。",
    "Download {count} original resource files, about {size}; first use also needs a download helper of about 32 MB. Files go into a separate cache. Only weapons affected by the selected skin are replaced; the whole game is not validated."
  ],
  "skinRecovery.checking": [
    "正在检查本地缓存与修复计划…",
    "Checking local caches and the repair plan…"
  ],
  "skinRecovery.helper": [
    "正在准备下载工具…",
    "Preparing the download helper…"
  ],
  "skinRecovery.authWaiting": [
    "正在获取 Steam 登录二维码…",
    "Getting a Steam sign-in QR code…"
  ],
  "skinRecovery.authenticated": [
    "Steam 授权完成，正在准备下载…",
    "Steam authorization complete. Preparing the download…"
  ],
  "skinRecovery.downloading": [
    "正在下载所需原版资源",
    "Downloading required original resources"
  ],
  "skinRecovery.verifying": [
    "正在校验下载文件",
    "Verifying downloaded files"
  ],
  "skinRecovery.repairing": [
    "正在补齐资源并保存原皮缓存…",
    "Repairing resources and saving original-skin caches…"
  ],
  "skinRecovery.installing": [
    "正在备份并安装当前皮肤…",
    "Backing up and installing the selected skin…"
  ],
  "skinRecovery.verified": [
    "资源校验完成，正在继续安装…",
    "Resource verification complete. Continuing installation…"
  ],
  "skinRecovery.stagePlan": [
    "正在按索引确定后续下载文件…",
    "Identifying remaining downloads from the index…"
  ],
  "skinRecovery.missingStock": [
    "当前武器缺少可信原皮资源，请使用自动修复并安装，或选择完整原版资源来源。",
    "Verified originals for this weapon are missing. Use automatic repair and installation, or choose a complete original resource source."
  ],
  "skinRecovery.legacyMissingStock": [
    "同一武器缺少经校验的 DDS 原版资源，请在 DDS 安装页面提供原版资源备份后重试",
    "Verified DDS originals for this weapon are missing. Use automatic repair and installation, or choose original resources."
  ],
  "skinRecovery.invalidRange": [
    "common 索引中的资源范围超出当前官方文件，未修改游戏。",
    "A common index resource range exceeds the current official file. The game was not changed."
  ],
  "skinRecovery.installUnavailable": [
    "皮肤安装操作不可用，请更新启动器后重试。",
    "Skin installation is unavailable. Update the launcher and try again."
  ],
  "skinRecovery.incompatible": [
    "皮肤资源版本不兼容，未修改游戏。",
    "The skin resource version is incompatible. The game was not changed."
  ],
  "skinRecovery.notComplete": [
    "所需皮肤资源尚未补齐，请重新检查后再安装。",
    "Required skin resources are still missing. Check again before installing."
  ],
  "skinRecovery.gameStarted": [
    "游戏已启动，皮肤安装已取消。",
    "The game started. Skin installation was cancelled."
  ],
  "skinRecovery.stageBudgetMissing": [
    "分阶段修复缺少后续资源预算，请重新检查。",
    "A staged repair must declare its additional resource budget"
  ],
  "skinRecovery.stageInvalid": [
    "后续修复文件列表无效，已停止下载。",
    "The additional repair resources are invalid"
  ],
  "skinRecovery.stageOverBudget": [
    "后续资源超出已确认的修复范围，已停止下载。",
    "The additional resource selection exceeded the confirmed repair budget"
  ]
});
window.VyraLocales.pairs.push(...[["Steam 授权与隐私","Steam authorization and privacy"],["无需在 TFX 输入 Steam 账号或密码。TFX 不会将 Steam 登录凭证上传到作者或其他第三方云端；扫码登录和游戏所有权验证仍需连接 Steam 服务器。","You do not enter a Steam account name or password in TFX. TFX does not upload Steam sign-in credentials to the developer or any other third-party cloud service. QR sign-in and game ownership verification still require a connection to Steam servers."],["本次会话由下载助手在本机隔离环境中临时使用，不启用“记住登录”，正常完成后清理临时认证数据。TFX 不将密码、令牌或二维码写入应用日志。","The download helper uses this session temporarily in an isolated local environment. Persistent sign-in is not enabled, and temporary authentication data is removed after normal completion. TFX does not write passwords, tokens or QR codes to application logs."],["自动修复并安装","Repair and install automatically"],["下载并安装皮肤","Download and install skin"],["查看所需文件","View required files"],["仅在本地资源不足时需要 Steam 授权","Steam authorization is needed only when local resources are insufficient"],["保持游戏关闭，确认下载量与可用空间，然后点“下载并安装皮肤”。TFX 会自动准备下载工具。","Keep the game closed, check the download size and free space, then choose “Download and install skin”. TFX prepares the download helper automatically."],["打开 Steam 手机应用，在 Steam 令牌（Steam Guard）中扫描下方二维码，并用拥有 Titanfall 2 的账号确认登录。不需要在 TFX 输入账号或密码。","Open the Steam mobile app, scan the QR code below from Steam Guard, and approve sign-in with an account that owns Titanfall 2. You do not enter an account name or password in TFX."],["授权后自动下载、校验、补齐资源并安装当前皮肤，无需重新导入。分阶段恢复时如再次出现二维码，用同一账号确认即可。","After authorization, TFX downloads, verifies, repairs resources and installs the selected skin automatically. No new import is needed. If staged recovery shows another QR code, approve it with the same account."],["二维码由 Steam 登录流程生成。若超时，请取消后重试；没有手机扫码条件时，可改选完整原版资源目录。TFX 不保留本次登录会话。","The QR code comes from the Steam sign-in flow. If it expires, cancel and retry. If you cannot scan it with the mobile app, choose a complete original resource folder instead. TFX does not retain this sign-in session."],["缓存所在磁盘至少需要 {space} 可用空间（包含下载临时副本）。","The cache drive needs at least {space} of free space, including temporary download copies."],["先恢复小型索引，再只下载实际缺失的文件。总下载上限为 {size}，缓存至少预留 {space}；健康文件会跳过。","The small index is restored first, then only files actually missing are downloaded. The total download upper limit is {size}; reserve at least {space} for the cache. Healthy files are skipped."],["分两阶段恢复：先下载 {count} 个已知资源文件，约 {size}，其中包含用于确定后续文件的小型索引。首次使用还需约 32 MB 的下载工具。全部下载存入独立缓存，不执行游戏整体验证。","Recovery has two stages: first download {count} known resource files, about {size}, including the small index used to identify remaining files. First use also needs a download helper of about 32 MB. All downloads go into a separate cache; the whole game is not validated."],["TFX 会先检查本机资源和可信备份。此前装过皮肤也可以使用；已被修改的内容不会当成原皮。没有可靠来源时，仅下载所需原版资源到独立缓存。","TFX checks local resources and verified backups first. Previously installed skins are supported; modified data is never treated as original. If no trusted source exists, only required original resources are downloaded to a separate cache."],["需下载 {count} 个原版资源文件，约 {size}；首次使用还需约 32 MB 的下载工具。文件存入独立缓存，仅替换当前皮肤涉及的武器，不执行游戏整体验证。","Download {count} original resource files, about {size}; first use also needs a download helper of about 32 MB. Files go into a separate cache. Only weapons affected by the selected skin are replaced; the whole game is not validated."],["正在检查本地缓存与修复计划…","Checking local caches and the repair plan…"],["正在准备下载工具…","Preparing the download helper…"],["正在获取 Steam 登录二维码…","Getting a Steam sign-in QR code…"],["Steam 授权完成，正在准备下载…","Steam authorization complete. Preparing the download…"],["正在下载所需原版资源","Downloading required original resources"],["正在校验下载文件","Verifying downloaded files"],["正在补齐资源并保存原皮缓存…","Repairing resources and saving original-skin caches…"],["正在备份并安装当前皮肤…","Backing up and installing the selected skin…"],["资源校验完成，正在继续安装…","Resource verification complete. Continuing installation…"],["正在按索引确定后续下载文件…","Identifying remaining downloads from the index…"],["当前武器缺少可信原皮资源，请使用自动修复并安装，或选择完整原版资源来源。","Verified originals for this weapon are missing. Use automatic repair and installation, or choose a complete original resource source."],["同一武器缺少经校验的 DDS 原版资源，请在 DDS 安装页面提供原版资源备份后重试","Verified DDS originals for this weapon are missing. Use automatic repair and installation, or choose original resources."],["common 索引中的资源范围超出当前官方文件，未修改游戏。","A common index resource range exceeds the current official file. The game was not changed."],["皮肤安装操作不可用，请更新启动器后重试。","Skin installation is unavailable. Update the launcher and try again."],["皮肤资源版本不兼容，未修改游戏。","The skin resource version is incompatible. The game was not changed."],["所需皮肤资源尚未补齐，请重新检查后再安装。","Required skin resources are still missing. Check again before installing."],["游戏已启动，皮肤安装已取消。","The game started. Skin installation was cancelled."],["分阶段修复缺少后续资源预算，请重新检查。","A staged repair must declare its additional resource budget"],["后续修复文件列表无效，已停止下载。","The additional repair resources are invalid"],["后续资源超出已确认的修复范围，已停止下载。","The additional resource selection exceeded the confirmed repair budget"]]);
