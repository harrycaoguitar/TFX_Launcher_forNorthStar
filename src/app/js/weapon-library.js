/* Weapon-first skin library. Installation remains in the shared intake above. */
(() => {
 'use strict';
 const dictionaries={
  'zh-CN':{title:'武器库',intro:'按武器整理 DDS、VTF 与 Mod 皮肤。Mod 的开关与卸载请到“我的模组”管理。',search:'搜索武器或皮肤',refresh:'刷新武器库',owned:'已有皮肤',all:'全部武器',unassigned:'未分类',rifle:'突击步枪',smg:'冲锋枪',lmg:'轻机枪',sniper:'狙击步枪',shotgun:'霰弹枪',pistol:'手枪',grenadier:'榴弹武器',antiTitan:'反泰坦武器',titan:'泰坦武器',melee:'近战',allSkins:'全部皮肤',allFormats:'全部格式',emptyWeapons:'暂无符合条件的武器',empty:'这把武器还没有皮肤记录',emptyHint:'在左侧拖入 DDS、VTF 或 Mod，安装后会自动归入武器库。',noItems:'暂无皮肤记录',loading:'正在整理武器库…',error:'暂时无法读取武器库，请重试。',records:'条记录',installed:'已安装',replaced:'已替换',recorded:'已记录',enabled:'已启用',disabled:'已禁用',manage:'管理 Mod',history:'查看安装记录',resource:'资源路径识别',metadata:'Mod 名称识别',unknown:'未确定武器',scope:'根据 TFX 的安装记录与当前 Mod 配置整理；不把包名猜测当作资源归属。',partial:'部分资源无法读取，当前结果可能不完整。',showMore:'展开更多记录',showLess:'收起记录'},
  'en-US':{title:'Arsenal',intro:'DDS, VTF and Mod skins, organized by weapon. Enable, disable and remove Mods in My Mods.',search:'Search weapons or skins',refresh:'Refresh arsenal',owned:'With skins',all:'All weapons',unassigned:'Unassigned',rifle:'Assault rifles',smg:'SMGs',lmg:'LMGs',sniper:'Sniper rifles',shotgun:'Shotguns',pistol:'Pistols',grenadier:'Grenadier',antiTitan:'Anti-Titan',titan:'Titan weapons',melee:'Melee',allSkins:'All skins',allFormats:'All formats',emptyWeapons:'No matching weapons',empty:'No skin records for this weapon yet',emptyHint:'Drop a DDS, VTF or Mod on the left. Installed skins appear here automatically.',noItems:'No skin records yet',loading:'Organizing your arsenal…',error:'The arsenal could not be loaded. Please try again.',records:'records',installed:'Installed',replaced:'Replaced',recorded:'Recorded',enabled:'Enabled',disabled:'Disabled',manage:'Manage Mod',history:'View install records',resource:'Identified by resource path',metadata:'Identified by Mod name',unknown:'Weapon not identified',scope:'Based on TFX install records and the selected Mod profile. Archive names do not prove resource ownership.',partial:'Some resources could not be read. This list may be incomplete.',showMore:'Show more records',showLess:'Show fewer records'},
  'zh-TW':{title:'武器庫',intro:'依武器整理 DDS、VTF 與 Mod 皮膚。Mod 的啟用、停用與移除請至「我的模組」管理。',search:'搜尋武器或皮膚',refresh:'重新整理武器庫',owned:'已有皮膚',all:'全部武器',unassigned:'未分類',rifle:'突擊步槍',smg:'衝鋒槍',lmg:'輕機槍',sniper:'狙擊步槍',shotgun:'霰彈槍',pistol:'手槍',grenadier:'榴彈武器',antiTitan:'反泰坦武器',titan:'泰坦武器',melee:'近戰',allSkins:'全部皮膚',allFormats:'全部格式',emptyWeapons:'沒有符合條件的武器',empty:'這把武器尚無皮膚紀錄',emptyHint:'在左側拖入 DDS、VTF 或 Mod，安裝後便會自動歸入武器庫。',noItems:'尚無皮膚紀錄',loading:'正在整理武器庫…',error:'暫時無法讀取武器庫，請重試。',records:'筆紀錄',installed:'已安裝',replaced:'已替換',recorded:'已記錄',enabled:'已啟用',disabled:'已停用',manage:'管理 Mod',history:'查看安裝紀錄',resource:'依資源路徑識別',metadata:'依 Mod 名稱識別',unknown:'尚未識別武器',scope:'依 TFX 安裝紀錄與目前 Mod 設定整理；不以壓縮包名稱推測資源歸屬。',partial:'部分資源無法讀取，目前結果可能不完整。',showMore:'展開更多紀錄',showLess:'收合紀錄'},
  'de-DE':{title:'Waffenkammer',intro:'DDS-, VTF- und Mod-Skins nach Waffen geordnet. Mods lassen sich unter „Meine Mods“ aktivieren, deaktivieren und entfernen.',search:'Waffen oder Skins suchen',refresh:'Waffenkammer aktualisieren',owned:'Mit Skins',all:'Alle Waffen',unassigned:'Nicht zugeordnet',rifle:'Sturmgewehre',smg:'Maschinenpistolen',lmg:'Leichte MGs',sniper:'Scharfschützengewehre',shotgun:'Schrotflinten',pistol:'Pistolen',grenadier:'Granatwaffen',antiTitan:'Anti-Titan',titan:'Titan-Waffen',melee:'Nahkampf',allSkins:'Alle Skins',allFormats:'Alle Formate',emptyWeapons:'Keine passenden Waffen',empty:'Für diese Waffe sind noch keine Skins erfasst',emptyHint:'DDS, VTF oder Mod links hineinziehen. Installierte Skins werden hier automatisch angezeigt.',noItems:'Noch keine Skins erfasst',loading:'Waffenkammer wird geladen…',error:'Die Waffenkammer konnte nicht geladen werden. Bitte erneut versuchen.',records:'Einträge',installed:'Installiert',replaced:'Ersetzt',recorded:'Erfasst',enabled:'Aktiviert',disabled:'Deaktiviert',manage:'Mod verwalten',history:'Installationsverlauf',resource:'Über Ressourcenpfad erkannt',metadata:'Über Mod-Namen erkannt',unknown:'Waffe nicht erkannt',scope:'Basierend auf TFX-Installationsdaten und dem ausgewählten Mod-Profil. Archivnamen belegen keine Ressourcenzuordnung.',partial:'Einige Ressourcen konnten nicht gelesen werden. Die Liste ist möglicherweise unvollständig.',showMore:'Weitere Einträge anzeigen',showLess:'Weniger Einträge anzeigen'},
  'fr-FR':{title:'Arsenal',intro:'Les skins DDS, VTF et Mod, classés par arme. Activez, désactivez et supprimez les Mods dans « Mes Mods ».',search:'Rechercher une arme ou un skin',refresh:'Actualiser l’arsenal',owned:'Avec skins',all:'Toutes les armes',unassigned:'Non classés',rifle:'Fusils d’assaut',smg:'Pistolets-mitrailleurs',lmg:'Mitrailleuses légères',sniper:'Fusils de précision',shotgun:'Fusils à pompe',pistol:'Pistolets',grenadier:'Lance-grenades',antiTitan:'Anti-Titans',titan:'Armes de Titan',melee:'Corps à corps',allSkins:'Tous les skins',allFormats:'Tous les formats',emptyWeapons:'Aucune arme correspondante',empty:'Aucun skin enregistré pour cette arme',emptyHint:'Déposez un DDS, un VTF ou un Mod à gauche. Les skins installés apparaîtront ici automatiquement.',noItems:'Aucun skin enregistré',loading:'Chargement de l’arsenal…',error:'Impossible de charger l’arsenal. Veuillez réessayer.',records:'entrées',installed:'Installé',replaced:'Remplacé',recorded:'Enregistré',enabled:'Activé',disabled:'Désactivé',manage:'Gérer le Mod',history:'Historique d’installation',resource:'Identifié par le chemin de ressource',metadata:'Identifié par le nom du Mod',unknown:'Arme non identifiée',scope:'D’après les installations TFX et le profil de Mods sélectionné. Le nom d’une archive ne prouve pas à quelle arme ses ressources appartiennent.',partial:'Certaines ressources sont illisibles. Cette liste peut être incomplète.',showMore:'Afficher plus d’entrées',showLess:'Afficher moins d’entrées'}
 };
 const recoveryCopy={
 "zh-CN": {
  "restore": "使用此皮肤",
  "selectWeapon": "选择武器，管理皮肤与还原",
  "restoreHint": "从左侧选择武器，即可查看当前皮肤、历史皮肤与原版恢复选项。",
  "restoreConfirm": "将「{weapon}」恢复为「{record}」皮肤？",
  "restoreConfirmHint": "自动还原到所选皮肤的安装后状态，无需逐条还原。仅处理这把武器的 DDS / VTF 资源；Mod 皮肤在“我的模组”中管理。请先退出游戏。",
  "cancel": "取消",
  "confirm": "确认还原",
  "restoring": "正在切换皮肤…",
  "preparing": "正在检查皮肤与恢复资源…",
  "verifying": "正在验证还原结果…",
  "complete": "皮肤已恢复",
  "restoreSuccess": "已恢复为所选皮肤，重新启动游戏后生效。",
  "restoreError": "还原未完成，请重试。",
  "operationBusy": "请等待当前安装或还原完成。",
  "pendingTitle": "有未完成的安装需要恢复",
  "pendingHint": "先恢复未完成的操作，再继续安装。",
  "recover": "恢复未完成的操作",
  "recoverConfirm": "恢复这次未完成的操作？",
  "recoverConfirmHint": "将使用这次操作的完整恢复记录，可能同时恢复关联的多把武器。请先退出游戏。",
  "recoverySuccess": "未完成的操作已恢复，现在可以继续安装。",
  "recoveryComplete": "恢复完成",
  "noRecovery": "这份恢复记录暂不可用。",
  "backupUnavailable": "该历史皮肤的恢复资源不可用，请重新安装需要的皮肤。",
  "backupNewer": "TFX 会自动处理关联的历史记录。",
  "backupRestored": "正在使用此皮肤。",
  "backupBoundary": "该皮肤与当前状态之间没有完整的恢复链。",
  "modOverride": "这把武器仍有 {count} 个已启用的 Mod，游戏中可能继续显示 Mod 皮肤。可在“我的模组”中关闭。",
  "current": "正在使用",
  "available": "可恢复",
  "unavailable": "不可用",
  "originalSkin": "原版皮肤",
  "restoreOriginal": "恢复原版皮肤",
  "originalConfirm": "将「{weapon}」恢复为原版皮肤？",
  "originalHint": "仅还原这把武器的 DDS / VTF 资源，其他武器保持原状。Mod 皮肤需在“我的模组”中关闭。请先退出游戏。",
  "originalSuccess": "所选武器已恢复为原版皮肤，重新启动游戏后生效。",
  "originalCurrent": "当前为原版皮肤",
  "originalUnavailable": "暂时没有可用的原版恢复记录。",
  "historyHint": "任选可恢复的皮肤，或恢复原版。仅影响所选武器的 DDS / VTF 资源，请先退出游戏。"
 },
 "en-US": {
  "restore": "Use this skin",
  "selectWeapon": "Select a weapon to manage its skins",
  "restoreHint": "Choose a weapon on the left to view its current skin, historical skins and original-skin restoration.",
  "restoreConfirm": "Restore {weapon} to skin “{record}”?",
  "restoreConfirmHint": "TFX returns directly to the selected skin’s installed state. You do not need to restore newer records one by one. Only this weapon’s DDS / VTF resources are affected. Manage Mod skins in My Mods. Close the game first.",
  "cancel": "Cancel",
  "confirm": "Restore",
  "restoring": "Switching skin…",
  "preparing": "Checking skin and recovery resources…",
  "verifying": "Verifying restored resources…",
  "complete": "Skin restored",
  "restoreSuccess": "The selected skin has been restored. Restart the game to apply the change.",
  "restoreError": "Restoration could not be completed. Please try again.",
  "operationBusy": "Wait for the current installation or restoration to finish.",
  "pendingTitle": "An unfinished installation needs recovery",
  "pendingHint": "Recover the unfinished operation before installing another skin.",
  "recover": "Recover unfinished operation",
  "recoverConfirm": "Recover this unfinished operation?",
  "recoverConfirmHint": "This uses the complete recovery record and may restore several linked weapons. Close the game first.",
  "recoverySuccess": "The unfinished operation was recovered. You can install skins again.",
  "recoveryComplete": "Recovery complete",
  "noRecovery": "This recovery record is currently unavailable.",
  "backupUnavailable": "Recovery resources for this historical skin are unavailable. Reinstall the skin you need.",
  "backupNewer": "TFX handles linked historical records automatically.",
  "backupRestored": "This skin is currently in use.",
  "backupBoundary": "There is no complete recovery chain between this skin and the current state.",
  "modOverride": "This weapon still has {count} enabled Mods. Their skins may still appear in game. You can disable them in My Mods.",
  "current": "Current",
  "available": "Available to restore",
  "unavailable": "Unavailable",
  "originalSkin": "Original skin",
  "restoreOriginal": "Restore original skin",
  "originalConfirm": "Restore {weapon} to its original skin?",
  "originalHint": "Only this weapon’s DDS / VTF resources will be restored. Other weapons stay as they are. Disable Mod skins in My Mods. Close the game first.",
  "originalSuccess": "The selected weapon’s original skin has been restored. Restart the game to apply the change.",
  "originalCurrent": "Original skin in use",
  "originalUnavailable": "No usable original-skin recovery record is currently available.",
  "historyHint": "Choose an available skin or restore the original. Only this weapon’s DDS / VTF resources are changed. Close the game first."
 },
 "zh-TW": {
  "restore": "使用此皮膚",
  "selectWeapon": "選取武器，管理皮膚與還原",
  "restoreHint": "從左側選取武器，即可查看目前皮膚、歷史皮膚與原版還原選項。",
  "restoreConfirm": "將「{weapon}」還原為「{record}」皮膚？",
  "restoreConfirmHint": "自動還原至所選皮膚安裝後的狀態，無須逐筆還原。僅處理這把武器的 DDS / VTF 資源；Mod 皮膚請至「我的模組」管理。請先關閉遊戲。",
  "cancel": "取消",
  "confirm": "確認還原",
  "restoring": "正在切換皮膚…",
  "preparing": "正在檢查皮膚與還原資源…",
  "verifying": "正在驗證還原結果…",
  "complete": "皮膚已還原",
  "restoreSuccess": "已還原為所選皮膚，重新啟動遊戲後生效。",
  "restoreError": "還原未完成，請重試。",
  "operationBusy": "請等待目前的安裝或還原完成。",
  "pendingTitle": "有未完成的安裝需要還原",
  "pendingHint": "請先還原未完成的操作，再繼續安裝。",
  "recover": "還原未完成的操作",
  "recoverConfirm": "還原這次未完成的操作？",
  "recoverConfirmHint": "將使用這次操作的完整還原紀錄，可能同時還原多把相關武器。請先關閉遊戲。",
  "recoverySuccess": "未完成的操作已還原，現在可以繼續安裝。",
  "recoveryComplete": "還原完成",
  "noRecovery": "這筆還原紀錄目前無法使用。",
  "backupUnavailable": "此歷史皮膚的還原資源無法使用，請重新安裝所需的皮膚。",
  "backupNewer": "TFX 會自動處理相關的歷史紀錄。",
  "backupRestored": "目前正在使用此皮膚。",
  "backupBoundary": "此皮膚與目前狀態之間沒有完整的還原鏈。",
  "modOverride": "這把武器仍有 {count} 個已啟用的 Mod，遊戲中可能繼續顯示 Mod 皮膚。可至「我的模組」停用。",
  "current": "目前使用中",
  "available": "可還原",
  "unavailable": "無法使用",
  "originalSkin": "原版皮膚",
  "restoreOriginal": "還原原版皮膚",
  "originalConfirm": "將「{weapon}」還原為原版皮膚？",
  "originalHint": "僅還原這把武器的 DDS / VTF 資源，其他武器維持原狀。Mod 皮膚需至「我的模組」停用。請先關閉遊戲。",
  "originalSuccess": "所選武器已還原為原版皮膚，重新啟動遊戲後生效。",
  "originalCurrent": "目前使用原版皮膚",
  "originalUnavailable": "目前沒有可用的原版還原紀錄。",
  "historyHint": "任選可還原的皮膚，或還原原版。僅影響所選武器的 DDS / VTF 資源，請先關閉遊戲。"
 },
 "de-DE": {
  "restore": "Diesen Skin verwenden",
  "selectWeapon": "Waffe zur Skin-Verwaltung auswählen",
  "restoreHint": "Wähle links eine Waffe, um den aktuellen Skin, frühere Skins und die Wiederherstellung des Original-Skins anzuzeigen.",
  "restoreConfirm": "{weapon} auf den Skin „{record}“ zurücksetzen?",
  "restoreConfirmHint": "TFX stellt direkt den Zustand nach der Installation des gewählten Skins wieder her. Neuere Einträge müssen nicht einzeln zurückgesetzt werden. Nur die DDS-/VTF-Ressourcen dieser Waffe sind betroffen. Mod-Skins verwaltest du unter „Meine Mods“. Schließe zuerst das Spiel.",
  "cancel": "Abbrechen",
  "confirm": "Wiederherstellen",
  "restoring": "Skin wird gewechselt…",
  "preparing": "Skin- und Wiederherstellungsdaten werden geprüft…",
  "verifying": "Wiederhergestellte Ressourcen werden geprüft…",
  "complete": "Skin wiederhergestellt",
  "restoreSuccess": "Der gewählte Skin wurde wiederhergestellt. Starte das Spiel neu, um die Änderung zu übernehmen.",
  "restoreError": "Die Wiederherstellung konnte nicht abgeschlossen werden. Bitte erneut versuchen.",
  "operationBusy": "Warte, bis die laufende Installation oder Wiederherstellung abgeschlossen ist.",
  "pendingTitle": "Eine unvollständige Installation muss wiederhergestellt werden",
  "pendingHint": "Stelle den unvollständigen Vorgang wieder her, bevor du einen weiteren Skin installierst.",
  "recover": "Unvollständigen Vorgang wiederherstellen",
  "recoverConfirm": "Diesen unvollständigen Vorgang wiederherstellen?",
  "recoverConfirmHint": "Dabei wird der vollständige Wiederherstellungsdatensatz verwendet. Mehrere verknüpfte Waffen können betroffen sein. Schließe zuerst das Spiel.",
  "recoverySuccess": "Der unvollständige Vorgang wurde wiederhergestellt. Du kannst wieder Skins installieren.",
  "recoveryComplete": "Wiederherstellung abgeschlossen",
  "noRecovery": "Dieser Wiederherstellungsdatensatz ist derzeit nicht verfügbar.",
  "backupUnavailable": "Die Wiederherstellungsdaten dieses früheren Skins sind nicht verfügbar. Installiere den gewünschten Skin erneut.",
  "backupNewer": "TFX verarbeitet verknüpfte frühere Einträge automatisch.",
  "backupRestored": "Dieser Skin wird gerade verwendet.",
  "backupBoundary": "Zwischen diesem Skin und dem aktuellen Zustand besteht keine vollständige Wiederherstellungskette.",
  "modOverride": "Für diese Waffe sind noch {count} Mods aktiviert. Ihre Skins können weiterhin im Spiel erscheinen. Du kannst sie unter „Meine Mods“ deaktivieren.",
  "current": "Aktuell",
  "available": "Wiederherstellbar",
  "unavailable": "Nicht verfügbar",
  "originalSkin": "Original-Skin",
  "restoreOriginal": "Original-Skin wiederherstellen",
  "originalConfirm": "Den Original-Skin von {weapon} wiederherstellen?",
  "originalHint": "Nur die DDS-/VTF-Ressourcen dieser Waffe werden wiederhergestellt. Andere Waffen bleiben unverändert. Deaktiviere Mod-Skins unter „Meine Mods“. Schließe zuerst das Spiel.",
  "originalSuccess": "Der Original-Skin der gewählten Waffe wurde wiederhergestellt. Starte das Spiel neu, um die Änderung zu übernehmen.",
  "originalCurrent": "Original-Skin wird verwendet",
  "originalUnavailable": "Derzeit sind keine verwendbaren Wiederherstellungsdaten für den Original-Skin verfügbar.",
  "historyHint": "Wähle einen verfügbaren Skin oder stelle das Original wieder her. Nur die DDS-/VTF-Ressourcen dieser Waffe sind betroffen. Schließe zuerst das Spiel."
 },
 "fr-FR": {
  "restore": "Utiliser ce skin",
  "selectWeapon": "Sélectionnez une arme pour gérer ses skins",
  "restoreHint": "Choisissez une arme à gauche pour voir son skin actuel, ses anciens skins et la restauration du skin d’origine.",
  "restoreConfirm": "Rétablir le skin « {record} » sur {weapon} ?",
  "restoreConfirmHint": "TFX rétablit directement l’état après l’installation du skin choisi, sans restaurer les entrées plus récentes une par une. Seules les ressources DDS / VTF de cette arme sont concernées. Gérez les skins de Mods dans « Mes Mods ». Fermez d’abord le jeu.",
  "cancel": "Annuler",
  "confirm": "Restaurer",
  "restoring": "Changement de skin…",
  "preparing": "Vérification du skin et des données de restauration…",
  "verifying": "Vérification des ressources restaurées…",
  "complete": "Skin restauré",
  "restoreSuccess": "Le skin sélectionné a été restauré. Redémarrez le jeu pour appliquer la modification.",
  "restoreError": "La restauration n’a pas pu être effectuée. Veuillez réessayer.",
  "operationBusy": "Attendez la fin de l’installation ou de la restauration en cours.",
  "pendingTitle": "Une installation inachevée doit être restaurée",
  "pendingHint": "Restaurez l’opération inachevée avant d’installer un autre skin.",
  "recover": "Restaurer l’opération inachevée",
  "recoverConfirm": "Restaurer cette opération inachevée ?",
  "recoverConfirmHint": "L’ensemble des données de restauration de cette opération sera utilisé. Plusieurs armes liées peuvent être concernées. Fermez d’abord le jeu.",
  "recoverySuccess": "L’opération inachevée a été restaurée. Vous pouvez à nouveau installer des skins.",
  "recoveryComplete": "Restauration terminée",
  "noRecovery": "Ces données de restauration sont actuellement indisponibles.",
  "backupUnavailable": "Les données de restauration de cet ancien skin sont indisponibles. Réinstallez le skin souhaité.",
  "backupNewer": "TFX traite automatiquement les entrées historiques liées.",
  "backupRestored": "Ce skin est actuellement utilisé.",
  "backupBoundary": "Aucune chaîne de restauration complète ne relie ce skin à l’état actuel.",
  "modOverride": "Cette arme possède encore {count} Mods activés. Leurs skins peuvent rester visibles en jeu. Vous pouvez les désactiver dans « Mes Mods ».",
  "current": "Actuel",
  "available": "Restauration disponible",
  "unavailable": "Indisponible",
  "originalSkin": "Skin d’origine",
  "restoreOriginal": "Restaurer le skin d’origine",
  "originalConfirm": "Restaurer le skin d’origine de {weapon} ?",
  "originalHint": "Seules les ressources DDS / VTF de cette arme seront restaurées. Les autres armes resteront inchangées. Désactivez les skins de Mods dans « Mes Mods ». Fermez d’abord le jeu.",
  "originalSuccess": "Le skin d’origine de l’arme sélectionnée a été restauré. Redémarrez le jeu pour appliquer la modification.",
  "originalCurrent": "Skin d’origine utilisé",
  "originalUnavailable": "Aucune donnée de restauration du skin d’origine n’est actuellement disponible.",
  "historyHint": "Choisissez un skin disponible ou restaurez l’original. Seules les ressources DDS / VTF de cette arme sont modifiées. Fermez d’abord le jeu."
 }
};
 for(const locale of Object.keys(dictionaries))Object.assign(dictionaries[locale],recoveryCopy[locale]);
 const resourceErrors={"zh-CN":"备份或关联的皮肤资源缺失、损坏或已变化，无法完成还原。请检查备份，或重新安装需要的皮肤。","en-US":"The backup or its linked skin resources are missing, damaged or changed. Restoration could not be completed. Check the backup or reinstall the skin you need.","zh-TW":"備份或相關皮膚資源遺失、損毀或已變更，無法完成還原。請檢查備份，或重新安裝所需的皮膚。","de-DE":"Die Sicherung oder zugehörige Skin-Ressourcen fehlen, sind beschädigt oder wurden verändert. Die Wiederherstellung konnte nicht abgeschlossen werden. Prüfe die Sicherung oder installiere den gewünschten Skin erneut.","fr-FR":"La sauvegarde ou les ressources de skin associées sont manquantes, endommagées ou modifiées. La restauration n’a pas pu être effectuée. Vérifiez la sauvegarde ou réinstallez le skin souhaité."};
 Object.assign(dictionaries['zh-CN'],{smg:'轻型冲锋枪',grenadier:'榴弹发射器',restored:'已恢复',unknown:'资源归属未确认'});
 Object.assign(dictionaries['zh-TW'],{smg:'輕型衝鋒槍',grenadier:'榴彈發射器',restored:'已還原',unknown:'資源歸屬尚未確認'});
 Object.assign(dictionaries['en-US'],{restored:'Restored'});
 Object.assign(dictionaries['de-DE'],{restored:'Wiederhergestellt'});
 Object.assign(dictionaries['fr-FR'],{restored:'Restauré'});
 const recoveryErrors={
  'zh-CN':{busy:'另一项安装或启动操作正在执行，请稍后重试。',unavailable:'当前武器没有可恢复的已安装皮肤，请刷新武器库。',changed:'恢复记录已变化，请刷新武器库后重试。',required:'恢复未完成，请处理武器库中未完成安装的恢复提示。'},
  'en-US':{busy:'Another installation or launch is in progress. Please try again shortly.',unavailable:'This weapon has no installed skin that can be restored. Refresh the arsenal.',changed:'The recovery record has changed. Refresh the arsenal and try again.',required:'Recovery is incomplete. Use the unfinished-installation recovery prompt in the arsenal.'},
  'zh-TW':{busy:'另一項安裝或啟動操作正在執行，請稍後再試。',unavailable:'這把武器沒有可還原的已安裝皮膚，請重新整理武器庫。',changed:'還原紀錄已變更，請重新整理武器庫後再試。',required:'還原未完成，請處理武器庫中未完成安裝的還原提示。'},
  'de-DE':{busy:'Eine andere Installation oder ein Spielstart läuft gerade. Bitte versuche es gleich erneut.',unavailable:'Für diese Waffe gibt es keinen installierten Skin zum Wiederherstellen. Aktualisiere die Waffenkammer.',changed:'Der Wiederherstellungsdatensatz hat sich geändert. Aktualisiere die Waffenkammer und versuche es erneut.',required:'Die Wiederherstellung ist unvollständig. Verwende den Hinweis zur unvollständigen Installation in der Waffenkammer.'},
  'fr-FR':{busy:'Une autre installation ou un lancement est en cours. Veuillez réessayer dans un instant.',unavailable:'Cette arme ne possède aucun skin installé à restaurer. Actualisez l’arsenal.',changed:'Les données de restauration ont changé. Actualisez l’arsenal et réessayez.',required:'La restauration est incomplète. Utilisez le message de restauration de l’installation inachevée dans l’arsenal.'}
 };
 const state={data:null,busy:false,error:false,category:'owned',weapon:'all',format:'all',search:'',expanded:false,visibleCount:0,confirm:null,restore:{busy:false,error:'',done:false,percent:0,phase:'preparing'}};
 let request=0,refreshTimer,root,dirty=false,layoutFrame,resizeObserver,pruneTimer,prunePath='',pruning=false;
 const $=id=>document.getElementById(id),t=key=>(dictionaries[window.I18n?.current]||dictionaries['en-US'])[key]||key;
 const element=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
 const button=(cls,label,action)=>{const node=element('button',cls,label);node.type='button';node.addEventListener('click',action);return node;};
 const formatLabel=format=>format==='mod'?'Mod':format.toUpperCase();
 const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase();
 const weaponName=weapon=>weapon?.names?.[window.I18n?.current]||weapon?.name||'';
 const backupAvailable=item=>state.weapon!=='all'&&item.canRestoreState===true&&item.stateRestoreWeaponIds?.includes(state.weapon)&&!item.currentWeaponIds?.includes(state.weapon);
 const backupReason=item=>{const reason=item.stateUnavailableReasons?.[state.weapon]||item.stateUnavailableReason||item.backupUnavailableReason;if(['current','current-state'].includes(reason))return t('backupRestored');if(['pending','busy-recovery'].includes(reason))return t('pendingHint');return t(['original-boundary','unlinked','chain-incomplete'].includes(reason)?'backupBoundary':'backupUnavailable');};
 const idleRestore=()=>({busy:false,error:'',done:false,percent:0,phase:'preparing'});
 function restoreError(error){
  const message=String(error?.message||''),copy=recoveryErrors[window.I18n?.current]||recoveryErrors['en-US'];
  if(message==='WEAPON_RECOVERY_BUSY')return copy.busy;
  if(message.startsWith('WEAPON_BACKUP_NOT_AVAILABLE:'))return backupReason({backupUnavailableReason:message.slice('WEAPON_BACKUP_NOT_AVAILABLE:'.length)});
  if(message==='WEAPON_BACKUP_PENDING')return copy.required;
  if(message.startsWith('WEAPON_STATE_NOT_AVAILABLE:'))return backupReason({stateUnavailableReason:message.slice('WEAPON_STATE_NOT_AVAILABLE:'.length)});
  if(message==='WEAPON_STATE_NOT_AVAILABLE')return copy.unavailable;
  if(message==='WEAPON_STATE_CURRENT_CHANGED')return copy.changed;
  if(message==='WEAPON_STATE_NO_CHANGE')return t('backupRestored');
  if(message==='WEAPON_STATE_CHAIN_INCOMPLETE')return t('backupBoundary');
  if(/^WEAPON_STATE_/.test(message))return resourceErrors[window.I18n?.current]||resourceErrors['en-US'];
  if(message==='WEAPON_BACKUP_CURRENT_CHANGED')return copy.changed;
  if(/^WEAPON_BACKUP_/.test(message))return resourceErrors[window.I18n?.current]||resourceErrors['en-US'];
  if(['WEAPON_RECOVERY_UNAVAILABLE','WEAPON_RECOVERY_NOT_AVAILABLE'].includes(message))return copy.unavailable;
  if(message.startsWith('WEAPON_RECOVERY_REQUIRED:'))return copy.required;
  if(['WEAPON_RECOVERY_INVALID_RECORD','STALE_WEAPON_LIBRARY'].includes(message))return copy.changed;
  if(/^WEAPON_RECOVERY_/.test(message))return t('restoreError');
  return window.I18n?.text?.(message)||message||t('restoreError');
 }
 function art(weapon){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 160 64');svg.setAttribute('aria-hidden','true');svg.classList.add('weapon-library-silhouette');
  for(const [cls,value] of [['weapon-outline',weapon.outline],['weapon-detail',weapon.detail]]){
   if(typeof value!=='string'||!value||/[^a-zA-Z0-9,.\s-]/.test(value))continue;
   const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',value);path.setAttribute('class',cls);path.setAttribute('fill-rule','evenodd');svg.append(path);
  }return svg;
 }
 function relevantItems(){return(state.data?.items||[]).filter(item=>(state.weapon==='all'||item.weaponIds.includes(state.weapon))&&(['all','owned'].includes(state.category)||item.weaponIds.some(id=>state.data.weapons.find(weapon=>weapon.id===id)?.category===state.category))&&(state.format==='all'||item.format===state.format)&&(!state.search||normalize(item.name+' '+item.weaponIds.map(id=>{const weapon=state.data.weapons.find(w=>w.id===id);return[weaponName(weapon),weapon?.name,id,...Object.values(weapon?.names||{})].join(' ');}).join(' ')).includes(normalize(state.search))));}
 function selectedState(item){if(state.weapon!=='all'&&['dds','vtf'].includes(item.format)&&Array.isArray(item.currentWeaponIds)){if(item.currentWeaponIds.includes(state.weapon))return 'current';return backupAvailable(item)?'available':'unavailable';}if(state.weapon!=='all'&&item.restoredWeaponIds?.includes(state.weapon))return 'restored';if(state.weapon!=='all'&&Array.isArray(item.activeWeaponIds)&&item.state==='installed'&&!item.activeWeaponIds.includes(state.weapon))return 'replaced';return item.state;}
 function animate(container){if(typeof container.animate!=='function')return;const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;container.animate(reduced?[{opacity:.6},{opacity:1}]:[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:reduced?100:220,easing:'cubic-bezier(.2,.75,.25,1)'});}
 function renderCategories(){
  const target=$('weaponLibraryCategory');target.replaceChildren();
  for(const id of ['owned','all','rifle','smg','lmg','sniper','shotgun','grenadier','pistol','titan']){
   const node=button('weapon-library-category',t(id),()=>{if(state.restore.busy)return;state.category=id;state.weapon='all';state.expanded=false;state.confirm=null;state.restore=idleRestore();render();});node.dataset.weaponCategory=id;node.setAttribute('aria-pressed',String(state.category===id));node.disabled=state.restore.busy;target.append(node);
  }
 }
 function renderWeapons(){
  const grid=$('weaponLibraryGrid');grid.replaceChildren();const items=state.data?.items||[];
  const count=id=>items.filter(item=>item.weaponIds.includes(id)&&(item.format==='mod'?item.state==='enabled':Array.isArray(item.currentWeaponIds)?item.currentWeaponIds.includes(id):!item.restoredWeaponIds?.includes(id)&&!['replaced','restored'].includes(item.state)&&(!Array.isArray(item.activeWeaponIds)||item.activeWeaponIds.includes(id)))).length;
  const all=(state.data?.weapons||[]).filter(weapon=>(state.category==='all'||state.category==='owned'?state.category==='all'||items.some(item=>item.weaponIds.includes(weapon.id)):weapon.category===state.category)&&(!state.search||normalize(weaponName(weapon)+' '+weapon.name+' '+weapon.id+' '+Object.values(weapon.names||{}).join(' ')).includes(normalize(state.search))||items.some(item=>item.weaponIds.includes(weapon.id)&&normalize(item.name).includes(normalize(state.search)))));
  if(!all.length){grid.append(element('p','weapon-library-empty-grid',t('emptyWeapons')));return;}
  for(const weapon of all){
   const name=weaponName(weapon),node=button('weapon-library-weapon','',()=>selectWeapon(weapon.id));node.dataset.weaponId=weapon.id;node.disabled=state.restore.busy;node.setAttribute('aria-pressed',String(state.weapon===weapon.id));node.setAttribute('aria-label',name+' · '+count(weapon.id)+' '+t('records'));
   node.append(art(weapon));const caption=element('span','weapon-library-weapon-caption');caption.append(element('strong','',name),element('small','',String(count(weapon.id))));node.append(caption);grid.append(node);
  }
 }
 function manage(item){
  if(item.format==='mod'){window.Fold?.navigate('mods');const search=$('modSearch');if(search){search.value=item.sourceId||item.name;search.dispatchEvent(new Event('input',{bubbles:true}));search.focus();}return;}
 }
 function scheduleLayout(){if(layoutFrame)return;layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;layoutItems();});}
 function layoutItems(){
  if(!root||!root.getBoundingClientRect().width)return;
  const grid=$('weaponLibraryGrid'),records=$('weaponLibraryRecords'),panel=$('weaponLibraryItems'),more=$('weaponLibraryMore'),rows=[...panel.children].filter(node=>node.classList.contains('weapon-library-skin'));
  if(!rows.length){more.hidden=true;state.visibleCount=0;panel.dataset.collapsedCount='0';root.dataset.visibleSkinCount='0';return;}
  // Measure every real row before paint. Long titles, translations and display
  // scaling therefore count toward the budget; no estimated row height is used.
  for(const row of rows)row.hidden=false;
  more.hidden=false;more.textContent=t(state.expanded?'showLess':'showMore');
  const left=grid.getBoundingClientRect(),right=records.getBoundingClientRect(),list=panel.getBoundingClientRect(),reserve=more.getBoundingClientRect().height+12;
  const sideBySide=right.left>=left.right-2;
  const available=sideBySide?left.bottom-list.top-reserve:left.height-(list.top-right.top)-reserve;
  const count=window.WeaponLibraryLayout.visibleCount({rowHeights:rows.map(row=>row.getBoundingClientRect().height),availableHeight:available});
  state.visibleCount=count;panel.dataset.collapsedCount=String(count);root.dataset.visibleSkinCount=String(count);
  rows.forEach((row,index)=>{row.hidden=!state.expanded&&index>=count;});
  more.hidden=count>=rows.length;more.textContent=state.expanded?t('showLess'):t('showMore')+' · '+(rows.length-count);more.setAttribute('aria-expanded',String(state.expanded));
 }
 function requestRestore(descriptor){
  if(state.restore.busy)return;state.confirm=descriptor;state.restore=idleRestore();renderAction();scheduleLayout();requestAnimationFrame(()=>$('weaponLibraryAction')?.scrollIntoView({block:'nearest',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
 }
 function renderRecovery(){
  const target=$('weaponLibraryRecovery');target.replaceChildren();const recoveries=state.data?.recoveries||[];target.hidden=!recoveries.length;
  if(!recoveries.length)return;
  const title=element('summary','',t('pendingTitle')+' · '+recoveries.length),details=element('details','weapon-library-recovery-list');details.append(title,element('p','',t('pendingHint')));
  for(const item of recoveries){const row=element('div','weapon-library-recovery-row');row.dataset.recoveryId=item.id;const copy=element('div'),name=element('strong','',window.I18n?.text?.(item.name)||item.name||formatLabel(item.format)),weapons=(item.weaponIds||[]).map(id=>weaponName(state.data.weapons.find(weapon=>weapon.id===id))).filter(Boolean);copy.append(name);if(weapons.length)copy.append(element('small','',weapons.join(' / ')));const recover=button('fold-button compact',t('recover'),()=>requestRestore({recoveryId:item.id,name:item.name}));recover.disabled=state.restore.busy||item.canRecover!==true||!profileRootAvailable();if(item.canRecover!==true)recover.title=t('noRecovery');row.append(copy,recover);details.append(row);}
  target.append(details);
 }
 function renderAction(){
  const target=$('weaponLibraryAction');target.replaceChildren();const weapon=state.data?.weapons.find(item=>item.id===state.weapon),pending=state.confirm,operation=state.restore;
  if(pending){
   const pendingName=weaponName(state.data?.weapons.find(item=>item.id===pending.weaponId))||pending.name,copy=t(pending.recoveryId?'recoverConfirm':pending.targetMode==='original'?'originalConfirm':'restoreConfirm').replace('{weapon}',pendingName).replace('{record}',pending.name||''),card=element('div','weapon-library-confirm');card.setAttribute('role','group');card.setAttribute('aria-label',copy);card.append(element('strong','',copy),element('p','',t(pending.recoveryId?'recoverConfirmHint':pending.targetMode==='original'?'originalHint':'restoreConfirmHint')));const actions=element('div','weapon-library-confirm-actions');actions.append(button('fold-button compact',t('cancel'),()=>{state.confirm=null;renderAction();scheduleLayout();}),button('fold-button compact weapon-library-restore',t('confirm'),()=>runRestore(pending)));actions.lastChild.disabled=!profileRootAvailable();card.append(actions);target.append(card);return;
  }
  if(operation.busy||operation.done||operation.error){
   const card=element('div','weapon-library-restore-progress');card.dataset.status=operation.error?'error':operation.done?'complete':'working';card.setAttribute('role',operation.error?'alert':'status');const status=element('div','weapon-library-restore-status'),label=operation.error||t(operation.done?(operation.recoveryId?'recoveryComplete':'complete'):operation.phase==='verifying'?'verifying':operation.phase==='preparing'?'preparing':'restoring');status.append(element('strong','',label));if(!operation.error){status.append(element('span','',Math.round(operation.percent)+'%'));const track=element('div','weapon-library-progress-track'),fill=element('i');track.setAttribute('role','progressbar');track.setAttribute('aria-label',label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(Math.round(operation.percent)));fill.style.width=operation.percent+'%';track.append(fill);card.append(status,track);}else card.append(status);if(operation.remainingMods)card.append(element('p','weapon-library-mod-warning',t('modOverride').replace('{count}',String(operation.remainingMods))));target.append(card);if(operation.busy)return;
  }
  if(weapon){const original=button('fold-button compact weapon-library-original',t('restoreOriginal'),()=>requestRestore({weaponId:weapon.id,targetMode:'original',name:t('originalSkin')}));original.dataset.weaponId=weapon.id;original.disabled=state.busy||state.restore.busy||!state.data?.stateRestoreWeaponIds?.includes(weapon.id)||!profileRootAvailable();if(original.disabled)original.title=t(state.data?.stateOriginalCurrentWeaponIds?.includes(weapon.id)?'originalCurrent':'originalUnavailable');const controls=element('div','weapon-library-original-row');controls.append(original);if(state.data?.stateOriginalCurrentWeaponIds?.includes(weapon.id))controls.append(element('small','',t('originalCurrent')));target.append(controls,element('p','weapon-library-backup-hint',t('historyHint')));}
 }
 async function runRestore(descriptor){
  if(state.restore.busy)return;
  if(window.SkinImport?.busy||window.SkinRecovery?.busy||window.Fold?.DDS?.state.busy||window.VTF?.state.busy){state.confirm=null;state.restore={...idleRestore(),error:t('operationBusy')};renderAction();scheduleLayout();return;}
  state.confirm=null;state.restore={...idleRestore(),busy:true,...descriptor};render();
  try{
   const input=descriptor.recoveryId?{recoveryId:descriptor.recoveryId}:{weaponId:descriptor.weaponId,targetMode:descriptor.targetMode,...(descriptor.recordId?{recordId:descriptor.recordId}:{})},result=await ipcRenderer.invoke('weapon-library-restore',input);
   if(result?.cancelled){state.restore=idleRestore();return;}
   if(!result?.ok||result.waiting||result.confirmationRequired||(descriptor.recoveryId?result.recovered!==true||result.recoveryId!==descriptor.recoveryId:result.stateRestored!==true||result.weaponId!==descriptor.weaponId||result.targetMode!==descriptor.targetMode||descriptor.targetMode==='installed'&&result.recordId!==descriptor.recordId))throw Error(result?.error||t('restoreError'));
   state.restore={...state.restore,done:true,percent:100,phase:'complete',remainingMods:Array.isArray(result.remainingMods)?result.remainingMods.length:0};
   new Toast({scheme:'success',variant:'skin-complete',key:'weapon-library-restore',title:t(descriptor.recoveryId?'recoveryComplete':'complete'),description:t(descriptor.recoveryId?'recoverySuccess':descriptor.targetMode==='original'?'originalSuccess':'restoreSuccess')+(state.restore.remainingMods?' '+t('modOverride').replace('{count}',String(state.restore.remainingMods)):''),timeout:state.restore.remainingMods?8000:5000});
   window.dispatchEvent(new CustomEvent('tfx-skin-restored',{detail:result}));
   await Promise.allSettled([window.Fold?.DDS?.refresh?.(),window.VTF?.refresh?.()]);await refresh();
  }catch(error){state.restore.error=restoreError(error);state.restore.done=false;new Toast({scheme:'error',title:t('restoreError'),description:state.restore.error,timeout:8000});if(String(error?.message||'').startsWith('WEAPON_RECOVERY_REQUIRED:'))await refresh();}
  finally{state.restore.busy=false;render();}
 }
 function renderItems(){
  const panel=$('weaponLibraryItems');panel.replaceChildren();const weapon=state.data?.weapons.find(item=>item.id===state.weapon),data=weapon?relevantItems():[],heading=weaponName(weapon)||t('selectWeapon');
  $('weaponLibrarySelection').textContent=heading;$('weaponLibraryCount').hidden=!weapon;$('weaponLibraryCount').textContent=data.length+' '+t('records');$('weaponLibraryFormats').hidden=!weapon;
  if(!weapon){const prompt=element('div','weapon-library-empty');prompt.append(element('p','',t('restoreHint')));panel.append(prompt);scheduleLayout();return;}
  if(!data.length){const empty=element('div','weapon-library-empty');empty.append(element('strong','',state.weapon==='all'?t('noItems'):t('empty')),element('p','',t('emptyHint')));panel.append(empty);scheduleLayout();return;}
  for(const item of data){
   const row=element('article','weapon-library-skin');row.dataset.skinFormat=item.format;row.dataset.recordId=item.id;const summary=element('div','weapon-library-skin-body'),title=element('div','weapon-library-skin-title');title.append(element('span','weapon-library-format',formatLabel(item.format)),element('strong','',item.name));summary.append(title);
   const meta=element('div','weapon-library-skin-meta'),status=element('span','weapon-library-status',t(selectedState(item)));status.dataset.state=selectedState(item);meta.append(status);
   if(item.installedAt){const timestamp=new Date(item.installedAt);if(Number.isFinite(timestamp.getTime())){const time=element('time','',new Intl.DateTimeFormat(window.I18n?.current||'en-US',{year:'numeric',month:'short',day:'numeric'}).format(timestamp));time.dateTime=timestamp.toISOString();meta.append(time);}}
   const evidence=element('span','weapon-library-evidence',t(item.evidence==='resource-path'?'resource':item.evidence==='metadata-name'?'metadata':'unknown'));meta.append(evidence);summary.append(meta);row.append(summary);if(item.format==='mod'){const manageButton=button('fold-button compact weapon-library-manage',t('manage'),()=>manage(item));manageButton.disabled=state.restore.busy;row.append(manageButton);}else if(['dds','vtf'].includes(item.format)){const available=backupAvailable(item),restore=button('fold-button compact weapon-library-restore-backup',t(item.currentWeaponIds?.includes(weapon.id)?'current':'restore'),()=>requestRestore({weaponId:weapon.id,targetMode:'installed',recordId:item.id,name:item.name}));restore.dataset.recordId=item.id;restore.dataset.weaponId=weapon.id;restore.disabled=state.busy||state.restore.busy||!available||!profileRootAvailable();if(!available&&!item.currentWeaponIds?.includes(weapon.id)){const reason=backupReason(item);restore.title=reason;summary.append(element('small','weapon-library-backup-unavailable',reason));}row.append(restore);}panel.append(row);
  }layoutItems();animate(panel);
 }
 function render(){
  if(!root)return;$('weaponLibraryTitle').textContent=t('title');$('weaponLibraryIntro').textContent=t('intro');$('weaponLibrarySearch').placeholder=t('search');$('weaponLibrarySearch').setAttribute('aria-label',t('search'));$('weaponLibraryRefresh').textContent=t('refresh');$('weaponLibraryRefresh').disabled=state.busy||state.restore.busy;$('weaponLibraryScope').textContent=t('scope');
  const status=$('weaponLibraryStatus');status.hidden=!state.busy&&!state.error&&!state.data?.warnings?.length;status.textContent=state.busy?t('loading'):state.error?t('error'):state.data?.warnings?.length?t('partial'):'';status.dataset.error=String(state.error);root.setAttribute('aria-busy',String(state.busy));
  $('weaponLibrarySearch').disabled=state.restore.busy;renderCategories();const filters=$('weaponLibraryFormats');filters.replaceChildren();for(const format of ['all','dds','vtf','mod']){const node=button('weapon-library-format-filter',format==='all'?t('allFormats'):formatLabel(format),()=>{state.format=format;state.expanded=false;render();});node.dataset.weaponFormat=format;node.disabled=state.restore.busy;node.setAttribute('aria-pressed',String(state.format===format));filters.append(node);}
  renderWeapons();renderRecovery();renderAction();renderItems();
 }
 function selectWeapon(id){if(state.restore.busy||id!=='all'&&!state.data?.weapons.some(weapon=>weapon.id===id))return;state.weapon=id;state.expanded=false;state.confirm=null;state.restore=idleRestore();render();}
 async function pruneHistory(){
  const gamePath=selectedProfileRoot();
  if(!gamePath||gamePath===prunePath||pruning||state.busy||state.restore.busy||window.SkinImport?.busy||window.SkinRecovery?.busy||window.Fold?.DDS?.state.busy||window.VTF?.state.busy)return;
  pruning=true;
  try{const result=await ipcRenderer.invoke('weapon-library-prune',{});if(result?.ok&&gamePath===selectedProfileRoot()){prunePath=gamePath;if(Array.isArray(result.deleted)&&result.deleted.length>0)await refresh();}}
  catch{/* Cleanup is optional; restoration remains available and a later refresh retries. */}
  finally{pruning=false;}
 }
 async function refresh(){
  if(state.busy){dirty=true;return;}const token=++request;state.busy=true;state.error=false;dirty=false;render();
  try{const result=await ipcRenderer.invoke('weapon-library-list');if(token!==request)return;if(!result?.ok||!Array.isArray(result.weapons)||!Array.isArray(result.items))throw Error('Unavailable');state.data=result;}
  catch{if(token===request)state.error=true;}finally{if(token===request){state.busy=false;render();if(dirty)schedule();if(!state.error){clearTimeout(pruneTimer);pruneTimer=setTimeout(pruneHistory,1200);}}}
 }
 function selectedProfileRoot(){return typeof settings==='undefined'?'':settings.modProfileServer==='global'?(settings.globalGamepath||''):(settings.gamepath||'');}
 function profileRootAvailable(){if(typeof settings==='undefined')return false;const server=settings.modProfileServer,version=server==='official'?'vanilla':'northstar',region=server==='global'?'global':'cn';return window.VyraLaunchAvailability?.canLaunch(window.VyraGameProcesses?.snapshot,settings,version,region)===true;}
 function mount(){
  const workspace=$('skinWorkspace');if(!workspace)return;root=element('section','weapon-library');root.id='weaponLibrary';root.setAttribute('data-i18n-ignore','');root.setAttribute('aria-labelledby','weaponLibraryTitle');
  const header=element('header','weapon-library-heading'),copy=element('div');copy.append(element('p','fold-eyebrow','TFX / ARSENAL'));const h=element('h3');h.id='weaponLibraryTitle';const intro=element('p');intro.id='weaponLibraryIntro';copy.append(h,intro);const tools=element('div','weapon-library-tools'),search=element('input');search.id='weaponLibrarySearch';search.type='search';search.maxLength=160;search.autocomplete='off';search.addEventListener('input',()=>{state.search=search.value;state.expanded=false;renderWeapons();renderItems();});const reload=button('fold-button compact','',refresh);reload.id='weaponLibraryRefresh';tools.append(search,reload);header.append(copy,tools);root.append(header);
  const categories=element('div','weapon-library-categories');categories.id='weaponLibraryCategory';categories.setAttribute('role','group');root.append(categories);
  const status=element('p','weapon-library-load-status');status.id='weaponLibraryStatus';status.setAttribute('role','status');root.append(status);
  const recovery=element('div','weapon-library-recovery');recovery.id='weaponLibraryRecovery';root.append(recovery);
  const body=element('div','weapon-library-body'),grid=element('div','weapon-library-grid');grid.id='weaponLibraryGrid';const records=element('div','weapon-library-records');records.id='weaponLibraryRecords';const recordHeading=element('div','weapon-library-record-heading'),selection=element('h4');selection.id='weaponLibrarySelection';const count=element('span');count.id='weaponLibraryCount';recordHeading.append(selection,count);const filters=element('div','weapon-library-formats');filters.id='weaponLibraryFormats';const action=element('div');action.id='weaponLibraryAction';const items=element('div');items.id='weaponLibraryItems';const more=button('fold-button compact weapon-library-more','',()=>{state.expanded=!state.expanded;layoutItems();});more.id='weaponLibraryMore';more.setAttribute('aria-controls','weaponLibraryItems');records.append(recordHeading,filters,action,items,more);body.append(grid,records);const scope=element('p','weapon-library-scope');scope.id='weaponLibraryScope';root.append(body,scope);workspace.append(root);render();
  if(typeof ResizeObserver==='function'){resizeObserver=new ResizeObserver(scheduleLayout);resizeObserver.observe(grid);resizeObserver.observe(root);resizeObserver.observe(recordHeading);resizeObserver.observe(action);}window.addEventListener('resize',scheduleLayout);
 }
 function schedule(){dirty=true;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(window.Fold?.view==='skins')refresh();},450);}
 function open(){if(window.Fold?.view!=='skins')window.Fold?.navigate('skins');if(!state.data)refresh();root?.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
 mount();
 window.addEventListener('vyra-view-change',event=>{if(event.detail?.view==='skins')refresh();});window.addEventListener('vyra-language-changed',render);ipcRenderer.on('changed-settings',schedule);
 for(const channel of ['installed-mod','removed-mod','mods','game-process-snapshot','changed-settings'])ipcRenderer.on(channel,schedule);
 window.addEventListener('tfx-install-complete',schedule);
 for(const channel of ['dds-progress','vtf-progress'])ipcRenderer.on(channel,(_event,data)=>{if(data?.phase==='complete')schedule();});
 ipcRenderer.on('weapon-library-progress',(_event,data)=>{if(!state.restore.busy)return;if(state.restore.recoveryId?data?.recoveryId!==state.restore.recoveryId:data?.weaponId!==state.restore.weaponId||data?.targetMode!==state.restore.targetMode||state.restore.targetMode==='installed'&&data?.recordId!==state.restore.recordId)return;if(Number.isFinite(data?.percent))state.restore.percent=Math.max(state.restore.percent,Math.min(99,Math.max(0,data.percent)));if(typeof data?.phase==='string')state.restore.phase=data.phase;renderAction();scheduleLayout();});
 window.WeaponLibrary=Object.freeze({refresh,open,selectWeapon,get state(){return {...state};}});
 if(window.Fold?.view==='skins')refresh();
})();

