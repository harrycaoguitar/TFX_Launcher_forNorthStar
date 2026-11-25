/* Native language tags and the desktop copy share the bundled offline catalogs. */
(() => {
  'use strict';
  const rows = [
    ['TFX 2.0.0-beta2 更新说明','TFX 2.0.0-beta2 release notes','Neuerungen in TFX 2.0.0-beta2','TFX 2.0.0-beta2 更新說明','Notes de version TFX 2.0.0-beta2'],
    ['17 套参考配色','17 color themes','17 Farbthemen','17 套參考配色','17 thèmes de couleurs'],
    ['外观设置按参考图顺序排列，支持即时预览。','Themes follow the reference order and preview instantly in Appearance.','Die Themen folgen der Reihenfolge der Vorlagen und werden unter Darstellung sofort angezeigt.','外觀設定按參考圖順序排列，支援即時預覽。','Dans Apparence, les thèmes suivent l’ordre des références et s’affichent immédiatement.'],
    ['统一圆角','Consistent corners','Einheitliche Rundungen','統一圓角','Coins cohérents'],
    ['窗口、侧栏、弹窗与控件使用统一的圆角体系。','The window, sidebar, dialogs and controls share the same corner system.','Fenster, Seitenleiste, Dialoge und Bedienelemente verwenden einheitliche Rundungen.','視窗、側欄、彈窗與控制項使用統一的圓角系統。','La fenêtre, la barre latérale, les dialogues et les commandes utilisent les mêmes règles d’arrondi.'],
    ['模组安装反馈','Mod installation status','Mod-Installationsstatus','模組安裝回饋','État de l’installation des mods'],
    ['拖入文件后可直接查看读取、安装与结果。','Drop a file to see its reading, installation and result status.','Nach dem Ablegen einer Datei werden Lesephase, Installation und Ergebnis angezeigt.','拖入檔案後可直接查看讀取、安裝與結果。','Déposez un fichier pour suivre sa lecture, son installation et le résultat.'],
    ['等待选择文件','Waiting for a file','Warten auf eine Datei','等待選擇檔案','En attente d’un fichier'],
    ['正在读取文件','Reading file','Datei wird gelesen','正在讀取檔案','Lecture du fichier'],
    ['正在检查文件内容','Checking file contents','Dateiinhalt wird geprüft','正在檢查檔案內容','Vérification du contenu'],
    ['读取完成，可以核对安装','File ready for review','Datei zur Prüfung bereit','讀取完成，可以核對安裝','Fichier prêt à vérifier'],
    ['正在准备安装','Preparing installation','Installation wird vorbereitet','正在準備安裝','Préparation de l’installation'],
    ['正在安装','Installing','Installation läuft','正在安裝','Installation en cours'],
    ['正在写入文件','Writing files','Dateien werden geschrieben','正在寫入檔案','Écriture des fichiers'],
    ['正在校验文件','Verifying files','Dateien werden überprüft','正在驗證檔案','Vérification des fichiers'],
    ['正在完成安装','Finishing installation','Installation wird abgeschlossen','正在完成安裝','Finalisation de l’installation'],
    ['读取失败','Reading failed','Lesen fehlgeschlagen','讀取失敗','Échec de lecture'],
    ['安装失败','Installation failed','Installation fehlgeschlagen','安裝失敗','Échec de l’installation'],
    ['已取消','Cancelled','Abgebrochen','已取消','Annulé'],
    ['接收','Receive','Empfangen','接收','Réception'],
    ['检查','Check','Prüfen','檢查','Vérification'],
    ['处理中','Processing','In Bearbeitung','處理中','Traitement en cours'],
    ['选择游戏','Choose game','Spiel wählen','選擇遊戲','Choisir le jeu'],
    ['游戏目录','Game folder','Spielordner','遊戲目錄','Dossier du jeu'],
    ['未安装','Not installed','Nicht installiert','未安裝','Non installé'],
    ['已就绪','Ready','Bereit','已就緒','Prêt'],
    ['泰坦陨落 1','Titanfall 1','Titanfall 1','泰坦殞落 1','Titanfall 1'],
    ['泰坦陨落 2','Titanfall 2','Titanfall 2','泰坦殞落 2','Titanfall 2'],
    ['启动方式','Launch method','Startmethode','啟動方式','Mode de lancement'],
    ['社区客户端','Community client','Community-Client','社群用戶端','Client communautaire'],
    ['启动 Steam','Launch Steam','Steam starten','啟動 Steam','Lancer Steam'],
    ['启动 Delta','Launch Delta','Delta starten','啟動 Delta','Lancer Delta'],
    ['安装并启动','Install & launch','Installieren & starten','安裝並啟動','Installer et lancer'],
    ['Delta 安装','Delta installation','Delta-Installation','Delta 安裝','Installation de Delta'],
    ['安装 / 更新 Delta','Install / update Delta','Delta installieren / aktualisieren','安裝 / 更新 Delta','Installer / mettre à jour Delta'],
    ['选择已购买并下载的泰坦陨落 1，启动器仅安装 Delta 核心。','Select your purchased and installed Titanfall 1. TFX installs only the Delta core.','Wähle dein gekauftes und installiertes Titanfall 1. TFX installiert nur den Delta-Kern.','選擇已購買並下載的泰坦殞落 1，啟動器僅安裝 Delta 核心。','Sélectionnez votre copie achetée et installée de Titanfall 1. TFX installe uniquement le noyau Delta.'],
    ['核心版本','Core version','Kernversion','核心版本','Version du noyau'],
    ['Delta 核心目录','Delta core folder','Delta-Kernordner','Delta 核心目錄','Dossier du noyau Delta'],
    ['安装后显示','Shown after installation','Nach Installation sichtbar','安裝後顯示','Affiché après installation'],
    ['泰坦陨落 1 游戏目录','Titanfall 1 game folder','Titanfall-1-Spielordner','泰坦殞落 1 遊戲目錄','Dossier de Titanfall 1'],
    ['Delta 核心','Delta core','Delta-Kern','Delta 核心','Noyau Delta'],
    ['启动进程','Launch process','Spielprozess','啟動程序','Processus du jeu'],
    ['Steam 客户端','Steam client','Steam-Client','Steam 用戶端','Client Steam'],
    ['通过 Steam 启动原版游戏','Launch the original game through Steam','Originalspiel über Steam starten','透過 Steam 啟動原版遊戲','Lancer le jeu original via Steam'],
    ['请先选择泰坦陨落 1 游戏目录','Select your Titanfall 1 game folder first','Wähle zuerst deinen Titanfall-1-Spielordner','請先選擇泰坦殞落 1 遊戲目錄','Sélectionnez d’abord le dossier de Titanfall 1'],
    ['尚未安装 Delta 核心','Delta core is not installed','Delta-Kern nicht installiert','尚未安裝 Delta 核心','Noyau Delta non installé'],
    ['正在检查 Delta 版本','Checking Delta release','Delta-Version wird geprüft','正在檢查 Delta 版本','Vérification de la version Delta'],
    ['正在下载 Delta 核心','Downloading Delta core','Delta-Kern wird heruntergeladen','正在下載 Delta 核心','Téléchargement du noyau Delta'],
    ['正在校验 Delta 核心','Verifying Delta core','Delta-Kern wird überprüft','正在驗證 Delta 核心','Vérification du noyau Delta'],
    ['正在解压 Delta 核心','Extracting Delta core','Delta-Kern wird entpackt','正在解壓縮 Delta 核心','Extraction du noyau Delta'],
    ['正在部署 Delta 核心','Installing Delta core','Delta-Kern wird installiert','正在部署 Delta 核心','Installation du noyau Delta'],
    ['Delta 核心已就绪','Delta core is ready','Delta-Kern ist bereit','Delta 核心已就緒','Noyau Delta prêt'],
    ['正在检查游戏音频','Checking game audio','Spielaudio wird geprüft','正在檢查遊戲音訊','Vérification de l’audio du jeu'],
    ['正在配置 Delta 环境','Preparing Delta environment','Delta-Umgebung wird vorbereitet','正在設定 Delta 環境','Préparation de l’environnement Delta'],
    ['正在启动 Delta','Launching Delta','Delta wird gestartet','正在啟動 Delta','Lancement de Delta'],
    ['Delta 进程已启动','Delta process started','Delta-Prozess gestartet','Delta 程序已啟動','Processus Delta démarré'],
    ['Delta 已退出','Delta exited','Delta beendet','Delta 已結束','Delta fermé'],
    ['Delta 进程已退出','Delta process exited','Delta-Prozess beendet','Delta 程序已結束','Processus Delta terminé'],
    ['Delta 启动失败','Delta launch failed','Delta-Start fehlgeschlagen','Delta 啟動失敗','Échec du lancement de Delta'],
    ['已向 Steam 发送启动请求','Launch request sent to Steam','Startanforderung an Steam gesendet','已向 Steam 傳送啟動請求','Demande de lancement envoyée à Steam'],
    ['操作失败','Operation failed','Vorgang fehlgeschlagen','操作失敗','Échec de l’opération'],
    ['开始游戏','Play','Spielen','開始遊戲','Jouer'],
    ['社区服务器','Community servers','Community-Server','社群伺服器','Serveurs communautaires'],
    ['我的模组','My mods','Meine Mods','我的模組','Mes mods'],
    ['模组安装','Mod installer','Mod-Installation','模組安裝','Installation de mods'],
    ['偏好设置','Preferences','Einstellungen','偏好設定','Préférences'],
    ['正在启动','Launching','Wird gestartet','正在啟動','Lancement en cours'],
    ['显示语言','Display language','Anzeigesprache','顯示語言','Langue d’affichage'],
    ['选择语言','Choose language','Sprache wählen','選擇語言','Choisir la langue']
  ];
  rows.push(...`
选择游戏目录	Choose game folder	Spielordner auswählen	選擇遊戲目錄	Choisir le dossier du jeu
全部格式	All formats	Alle Formate	所有格式	Tous les formats
更新说明	Release notes	Versionshinweise	更新說明	Notes de version
Northstar 北极星	Northstar	Northstar	Northstar 北極星	Northstar
启动检查	Launch checks	Startprüfung	啟動檢查	Vérification du lancement
安装管理	Manage installation	Installation verwalten	安裝管理	Gérer l’installation
服务区域	Server region	Serverregion	伺服器區域	Région des serveurs
独立目录	Separate folder	Separater Ordner	獨立目錄	Dossier séparé
CN  /  国内社区	CN  /  China community	CN  /  Chinesische Community	CN  /  中國社群	CN  /  Communauté chinoise
Global  /  全球服务器	Global  /  Worldwide servers	Global  /  Weltweite Server	Global  /  全球伺服器	Global  /  Serveurs mondiaux
请先选择泰坦陨落 2 游戏目录。	Select your Titanfall 2 game folder first.	Wähle zuerst deinen Titanfall-2-Spielordner.	請先選擇 Titanfall 2 遊戲目錄。	Sélectionnez d’abord le dossier de Titanfall 2.
安装 Northstar	Install Northstar	Northstar installieren	安裝 Northstar	Installer Northstar
等待启动	Ready to launch	Startbereit	等待啟動	Prêt à lancer
待命	Standby	Bereit	待命	En attente
启动环境	Launch environment	Startumgebung	啟動環境	Environnement de lancement
模组配置	Mod configuration	Mod-Konfiguration	模組設定	Configuration des mods
EA 连接	EA connection	EA-Verbindung	EA 連線	Connexion EA
Northstar 独立目录	Separate Northstar folder	Separater Northstar-Ordner	Northstar 獨立目錄	Dossier Northstar séparé
已装配模组	Installed mods	Installierte Mods	已安裝模組	Mods installés
管理	Manage	Verwalten	管理	Gérer
游戏文件	Game files	Spieldateien	遊戲檔案	Fichiers du jeu
未找到	Not found	Nicht gefunden	未找到	Introuvable
已找到	Found	Gefunden	已找到	Trouvé
已开启	On	Ein	已開啟	Activé
EA 模拟器	EA emulator	EA-Emulator	EA 模擬器	Émulateur EA
未启用	Off	Aus	未啟用	Désactivé
本地磁盘空间	Local disk space	Lokaler Speicherplatz	本機磁碟空間	Espace disque local
TFX 系统就绪	TFX ready	TFX bereit	TFX 已就緒	TFX prêt
反馈	Feedback	Feedback	回饋	Commentaires
主导航	Main navigation	Hauptnavigation	主導覽	Navigation principale
TFX 首页	TFX home	TFX-Startseite	TFX 首頁	Accueil TFX
切换语言	Change language	Sprache ändern	切換語言	Changer de langue
窗口控制	Window controls	Fenstersteuerung	視窗控制	Commandes de fenêtre
后台运行	Run in background	Im Hintergrund ausführen	背景執行	Exécuter en arrière-plan
全屏	Full screen	Vollbild	全螢幕	Plein écran
退出全屏	Exit full screen	Vollbild verlassen	離開全螢幕	Quitter le plein écran
关闭	Close	Schließen	關閉	Fermer
关闭弹窗	Close dialog	Dialog schließen	關閉對話框	Fermer la fenêtre
游戏类型	Game type	Spieltyp	遊戲類型	Type de jeu
游戏启动进度	Game launch progress	Spielfortschritt beim Start	遊戲啟動進度	Progression du lancement
刷新列表	Refresh list	Liste aktualisieren	重新整理清單	Actualiser la liste
正在连接服务器列表…	Connecting to the server list…	Verbindung zur Serverliste…	正在連線至伺服器清單…	Connexion à la liste des serveurs…
服务器列表连接失败	Could not reach the server list	Serverliste nicht erreichbar	無法連線至伺服器清單	Impossible de joindre la liste des serveurs
连接失败 · 显示上次列表	Connection failed · Showing the last list	Verbindung fehlgeschlagen · Letzte Liste	連線失敗 · 顯示上次清單	Connexion impossible · Dernière liste affichée
当前没有在线服务器	No servers are online	Keine Server online	目前沒有在線伺服器	Aucun serveur en ligne
正在刷新…	Refreshing…	Wird aktualisiert…	正在重新整理…	Actualisation…
重试	Retry	Erneut versuchen	重試	Réessayer
中国大陆	Mainland China	Festlandchina	中國大陸	Chine continentale
国际社区	Global community	Globale Community	國際社群	Communauté mondiale
所有模式	All modes	Alle Modi	所有模式	Tous les modes
消耗战	Attrition	Materialschlacht	消耗戰	Usure
边境防御	Frontier Defense	Grenzlandverteidigung	邊境防禦	Défense frontalière
身法训练	Movement training	Bewegungstraining	身法訓練	Entraînement aux déplacements
实弹演习	Live Fire	Live Fire	實彈演習	Tir réel
所有地图	All maps	Alle Karten	所有地圖	Toutes les cartes
服务器名称	Server name	Servername	伺服器名稱	Nom du serveur
模式 / 地图	Mode / Map	Modus / Karte	模式 / 地圖	Mode / Carte
延迟	Latency	Latenz	延遲	Latence
没有匹配的服务器	No matching servers	Keine passenden Server	沒有符合的伺服器	Aucun serveur correspondant
试试其他关键词或清除筛选。	Try another search or clear the filters.	Versuche einen anderen Suchbegriff oder lösche die Filter.	試試其他關鍵字或清除篩選。	Essayez une autre recherche ou effacez les filtres.
清除筛选	Clear filters	Filter löschen	清除篩選	Effacer les filtres
数据快照	Snapshot	Momentaufnahme	資料快照	Instantané
刚刚	Just now	Gerade eben	剛剛	À l’instant
游戏模式	Game mode	Spielmodus	遊戲模式	Mode de jeu
当前玩家	Current players	Aktuelle Spieler	目前玩家	Joueurs actuels
模组要求：	Required mods:	Benötigte Mods:	所需模組：	Mods requis :
搜索服务器	Search servers	Server suchen	搜尋伺服器	Rechercher des serveurs
搜索服务器、地图…	Search servers, maps…	Server, Karten suchen…	搜尋伺服器、地圖…	Rechercher serveurs, cartes…
地图筛选	Map filter	Kartenfilter	地圖篩選	Filtre de carte
个模组	mods	Mods	個模組	mods
已启用	Enabled	Aktiviert	已啟用	Activé
已停用	Disabled	Deaktiviert	已停用	Désactivé
多人模组	Multiplayer mods	Mehrspieler-Mods	多人模組	Mods multijoueurs
Icepick 模组	Icepick mods	Icepick-Mods	Icepick 模組	Mods Icepick
武器库	Armory	Waffenkammer	武器庫	Armurerie
按类型浏览	Browse by type	Nach Typ durchsuchen	依類型瀏覽	Parcourir par type
全部模组	All mods	Alle Mods	全部模組	Tous les mods
玩法扩展	Gameplay	Spielerweiterungen	玩法擴充	Jouabilité
独立模组配置	Separate mod profiles	Separate Mod-Profile	獨立模組設定	Profils de mods séparés
独立配置	Separate profiles	Separate Profile	獨立設定	Profils séparés
按添加顺序	Date added	Hinzugefügt	依新增順序	Date d’ajout
全部停用	Disable all	Alle deaktivieren	全部停用	Tout désactiver
全部启用	Enable all	Alle aktivieren	全部啟用	Tout activer
批量卸载	Uninstall all	Alle deinstallieren	批次解除安裝	Tout désinstaller
当前装配	Current loadout	Aktuelle Ausrüstung	目前配置	Équipement actuel
这里还没有模组	No mods installed	Keine Mods installiert	尚未安裝模組	Aucun mod installé
清除筛选，或导入你的第一个模组。	Clear the filters or import your first mod.	Lösche die Filter oder importiere deinen ersten Mod.	清除篩選，或匯入你的第一個模組。	Effacez les filtres ou importez votre premier mod.
模组分类	Mod categories	Mod-Kategorien	模組分類	Catégories de mods
搜索多人模组	Search multiplayer mods	Mehrspieler-Mods suchen	搜尋多人模組	Rechercher des mods multijoueurs
搜索名称、作者或描述…	Search name, author or description…	Name, Autor oder Beschreibung suchen…	搜尋名稱、作者或描述…	Rechercher nom, auteur ou description…
Icepick 模组目录	Icepick mod folder	Icepick-Mod-Ordner	Icepick 模組目錄	Dossier des mods Icepick
选择目录	Choose folder	Ordner wählen	選擇目錄	Choisir un dossier
Icepick 工作区	Icepick workspace	Icepick-Arbeitsbereich	Icepick 工作區	Espace Icepick
搜索 Icepick 模组	Search Icepick mods	Icepick-Mods suchen	搜尋 Icepick 模組	Rechercher des mods Icepick
刷新 Icepick 模组	Refresh Icepick mods	Icepick-Mods aktualisieren	重新整理 Icepick 模組	Actualiser les mods Icepick
社区模组	Community mods	Community-Mods	社群模組	Mods communautaires
全部分类	All categories	Alle Kategorien	全部分類	Toutes les catégories
皮肤材质	Skins and textures	Skins und Texturen	外觀材質	Apparences et textures
服务端	Server-side	Serverseitig	伺服器端	Côté serveur
没有匹配的社区模组	No matching community mods	Keine passenden Community-Mods	沒有符合的社群模組	Aucun mod communautaire correspondant
换个关键词试试看。	Try another search term.	Versuche einen anderen Suchbegriff.	試試其他關鍵字。	Essayez un autre mot-clé.
搜索社区模组	Search community mods	Community-Mods suchen	搜尋社群模組	Rechercher des mods communautaires
寻找你的下一套装配…	Search community mods…	Community-Mods suchen…	搜尋社群模組…	Rechercher des mods communautaires…
社区模组类型	Community mod type	Community-Mod-Typ	社群模組類型	Type de mod communautaire
材质记录	Texture history	Texturverlauf	材質紀錄	Historique des textures
武器材质记录	Weapon texture history	Waffentexturverlauf	武器材質紀錄	Historique des textures d’armes
选择武器	Choose weapon	Waffe wählen	選擇武器	Choisir une arme
全部武器	All weapons	Alle Waffen	全部武器	Toutes les armes
全部	All	Alle	全部	Tout
恢复原始材质	Restore original textures	Originaltexturen wiederherstellen	還原原始材質	Restaurer les textures d’origine
没有匹配的记录	No matching records	Keine passenden Einträge	沒有符合的紀錄	Aucun historique correspondant
搜索武器材质记录	Search weapon texture history	Waffentexturverlauf durchsuchen	搜尋武器材質紀錄	Rechercher dans l’historique des textures
搜索记录	Search history	Verlauf durchsuchen	搜尋紀錄	Rechercher dans l’historique
武器列表	Weapon list	Waffenliste	武器清單	Liste des armes
材质格式	Texture format	Texturformat	材質格式	Format de texture
等待文件	Awaiting file	Datei erwartet	等待檔案	En attente d’un fichier
把文件放到这里	Drop files here	Dateien hier ablegen	將檔案拖曳至此	Déposez vos fichiers ici
选择文件	Choose file	Datei wählen	選擇檔案	Choisir un fichier
选择文件夹	Choose folder	Ordner wählen	選擇資料夾	Choisir un dossier
支持拖拽，或从本机选择文件	Drag and drop, or choose a local file	Dateien ablegen oder lokal auswählen	支援拖放，或從本機選擇檔案	Glissez-déposez ou choisissez un fichier local
或从下面选择一个文件	Or choose a file below	Oder unten eine Datei auswählen	或從下方選擇檔案	Ou choisissez un fichier ci-dessous
选择 DDS 纹理文件	Choose DDS texture	DDS-Textur wählen	選擇 DDS 材質檔案	Choisir une texture DDS
选择 VTF 纹理文件	Choose VTF texture	VTF-Textur wählen	選擇 VTF 材質檔案	Choisir une texture VTF
选择 Northstar 模组压缩包	Choose Northstar mod archive	Northstar-Mod-Archiv wählen	選擇 Northstar 模組壓縮檔	Choisir une archive de mod Northstar
选择 Icepick 模组文件	Choose Icepick mod	Icepick-Mod wählen	選擇 Icepick 模組檔案	Choisir un mod Icepick
核对与安装	Review and install	Prüfen und installieren	確認與安裝	Vérifier et installer
准备就绪	Ready	Bereit	準備就緒	Prêt
选择一个文件开始	Choose a file to begin	Wähle zuerst eine Datei	選擇檔案以開始	Choisissez un fichier pour commencer
导入 DDS、VTF 或模组压缩包，启动器会检查内容并显示安装目标。	Import a DDS, VTF or mod archive to inspect its contents and installation target.	Importiere eine DDS-, VTF-Datei oder ein Mod-Archiv, um Inhalt und Installationsziel zu prüfen.	匯入 DDS、VTF 或模組壓縮檔，檢查內容與安裝位置。	Importez un fichier DDS, VTF ou une archive de mod pour vérifier son contenu et sa destination.
从本机选择要安装的文件	Choose a local file to install	Lokale Datei zur Installation wählen	從本機選擇要安裝的檔案	Choisissez un fichier local à installer
检查内容	Inspect contents	Inhalt prüfen	檢查內容	Vérifier le contenu
确认格式、资源和安装位置	Check format, resources and target folder	Format, Ressourcen und Zielordner prüfen	確認格式、資源與安裝位置	Vérifier format, ressources et destination
完成安装	Complete installation	Installation abschließen	完成安裝	Terminer l’installation
安装后可在对应页面管理	Manage installed files on their respective pages	Installierte Dateien auf den jeweiligen Seiten verwalten	安裝後可在對應頁面管理	Gérez les fichiers installés sur les pages correspondantes
最近装配	Recent installations	Letzte Installationen	最近安裝	Installations récentes
还没有安装记录	No installation history	Noch keine Installationen	尚無安裝紀錄	Aucune installation enregistrée
安装完成后会在这里显示。	Completed installations appear here.	Abgeschlossene Installationen erscheinen hier.	安裝完成後會顯示於此。	Les installations terminées s’affichent ici.
模组格式	Mod format	Mod-Format	模組格式	Format du mod
刷新账户	Refresh account	Konto aktualisieren	重新整理帳戶	Actualiser le compte
账户	Account	Konto	帳戶	Compte
尚未连接	Not connected	Nicht verbunden	尚未連線	Non connecté
连接你的 EA 账户	Connect your EA account	EA-Konto verbinden	連結你的 EA 帳戶	Connectez votre compte EA
未登录	Signed out	Abgemeldet	未登入	Déconnecté
登录状态	Sign-in status	Anmeldestatus	登入狀態	État de connexion
尚未登录	Not signed in	Nicht angemeldet	尚未登入	Non connecté
凭据到期	Credentials expire	Zugangsdaten gültig bis	憑證到期	Expiration des identifiants
账户区域	Account region	Kontoregion	帳戶區域	Région du compte
最近检查	Last checked	Zuletzt geprüft	最近檢查	Dernière vérification
启用后，原版游戏启动时建立本地模拟服务。	Starts a local emulation service when launching the original game.	Startet beim Start des Originalspiels einen lokalen Emulationsdienst.	啟用後，原版遊戲啟動時會建立本機模擬服務。	Démarre un service d’émulation local au lancement du jeu d’origine.
连接 EA 账户	Connect EA account	EA-Konto verbinden	連結 EA 帳戶	Connecter le compte EA
Icepick 使用时请关闭 EA 模拟器。	Turn off the EA emulator when using Icepick.	Schalte den EA-Emulator aus, wenn du Icepick verwendest.	使用 Icepick 時請關閉 EA 模擬器。	Désactivez l’émulateur EA lorsque vous utilisez Icepick.
已保存账号	Saved accounts	Gespeicherte Konten	已儲存帳號	Comptes enregistrés
添加账号	Add account	Konto hinzufügen	新增帳號	Ajouter un compte
切换	Switch	Wechseln	切換	Basculer
正在切换 EA 账号…	Switching EA account…	EA-Konto wird gewechselt…	正在切換 EA 帳號…	Changement de compte EA…
已切换 EA 账号。	EA account switched.	EA-Konto gewechselt.	已切換 EA 帳號。	Compte EA changé.
此账号的登录已过期，请重新连接。	This session has expired. Reconnect to sign in.	Diese Sitzung ist abgelaufen. Melde dich erneut an.	此帳號的登入已過期，請重新連線。	Cette session a expiré. Connectez-vous à nouveau.
退出当前 EA 账号？其他账号将保留。	Sign out of this EA account? Other accounts will be kept.	Von diesem EA-Konto abmelden? Andere Konten bleiben gespeichert.	登出目前的 EA 帳號？其他帳號將保留。	Déconnecter ce compte EA ? Les autres comptes seront conservés.
正在处理 EA 账号，请稍候。	An EA account operation is in progress.	Ein EA-Kontovorgang läuft bereits.	正在處理 EA 帳號，請稍候。	Une opération sur un compte EA est en cours.
请先退出游戏，再管理 EA 账号。	Close the game before managing EA accounts.	Beende das Spiel, bevor du EA-Konten verwaltest.	請先退出遊戲，再管理 EA 帳號。	Fermez le jeu avant de gérer les comptes EA.
未找到此 EA 账号。	This EA account was not found.	Dieses EA-Konto wurde nicht gefunden.	找不到此 EA 帳號。	Ce compte EA est introuvable.
登录的不是当前 EA 账号。请重新登录，或使用「添加账号」。	This is not the current EA account. Sign in again or use Add account.	Dies ist nicht das aktuelle EA-Konto. Melde dich erneut an oder füge das Konto hinzu.	登入的不是目前的 EA 帳號。請重新登入，或使用「新增帳號」。	Ce n’est pas le compte EA actuel. Reconnectez-vous ou utilisez Ajouter un compte.
EA 未返回账号 ID，请重新登录。	EA did not return an account ID. Sign in again.	EA hat keine Konto-ID geliefert. Melde dich erneut an.	EA 未傳回帳號 ID，請重新登入。	EA n’a pas renvoyé d’identifiant de compte. Connectez-vous à nouveau.
无法使用系统加密保存 EA 账号。	System encryption is unavailable for saving EA accounts.	Die Systemverschlüsselung für EA-Konten ist nicht verfügbar.	無法使用系統加密儲存 EA 帳號。	Le chiffrement système est indisponible pour enregistrer les comptes EA.
无法读取已保存的 EA 账号。	Saved EA accounts could not be read.	Gespeicherte EA-Konten konnten nicht gelesen werden.	無法讀取已儲存的 EA 帳號。	Impossible de lire les comptes EA enregistrés.
连接诊断	Connection diagnostics	Verbindungsdiagnose	連線診斷	Diagnostic de connexion
模拟器已关闭	Emulator off	Emulator ausgeschaltet	模擬器已關閉	Émulateur désactivé
本地模拟服务	Local emulation service	Lokaler Emulationsdienst	本機模擬服務	Service d’émulation local
已关闭	Off	Aus	已關閉	Désactivé
服务会在启动游戏时建立。	The service starts when the game launches.	Der Dienst wird beim Spielstart gestartet.	服務會在遊戲啟動時建立。	Le service démarre au lancement du jeu.
账户凭据	Account credentials	Kontozugangsdaten	帳戶憑證	Identifiants du compte
连接 EA 账户后再启动原版游戏。	Connect an EA account before launching the original game.	Verbinde vor dem Start des Originalspiels ein EA-Konto.	連結 EA 帳戶後再啟動原版遊戲。	Connectez un compte EA avant de lancer le jeu d’origine.
在开始游戏页面选择 Titanfall 2 目录。	Select the Titanfall 2 folder on the Play page.	Wähle den Titanfall-2-Ordner auf der Spielseite aus.	在開始遊戲頁面選擇 Titanfall 2 目錄。	Sélectionnez le dossier de Titanfall 2 sur la page Jouer.
游戏启动桥接	Game launch bridge	Spielstart-Brücke	遊戲啟動橋接	Passerelle de lancement
已配置	Configured	Konfiguriert	已設定	Configuré
本地启动桥接已配置。	The local launch bridge is configured.	Die lokale Spielstart-Brücke ist konfiguriert.	本機啟動橋接已設定。	La passerelle de lancement locale est configurée.
LSX 通道	LSX channel	LSX-Kanal	LSX 通道	Canal LSX
默认端口被占用	Default port in use	Standardport belegt	預設連接埠已被佔用	Port par défaut occupé
启动时会尝试分配其他本地端口，不会结束其他程序。	Another local port will be tried at launch; other programs remain running.	Beim Start wird ein anderer lokaler Port versucht. Andere Programme laufen weiter.	啟動時會嘗試其他本機連接埠，不會結束其他程式。	Un autre port local sera essayé au lancement, sans fermer les autres programmes.
EA 登录连接	EA sign-in connection	EA-Anmeldeverbindung	EA 登入連線	Connexion au service EA
尚未测试	Not tested	Nicht getestet	尚未測試	Non testé
点击重新诊断，检查 EA 登录站点连接。	Run diagnostics to check the EA sign-in connection.	Starte die Diagnose, um die EA-Anmeldeverbindung zu prüfen.	點選重新診斷以檢查 EA 登入連線。	Relancez le diagnostic pour vérifier la connexion au service EA.
重新诊断	Run diagnostics	Erneut prüfen	重新診斷	Relancer le diagnostic
修复连接	Repair connection	Verbindung reparieren	修復連線	Réparer la connexion
复制报告	Copy report	Bericht kopieren	複製報告	Copier le rapport
EA 日志	EA logs	EA-Protokolle	EA 日誌	Journaux EA
LSX 日志	LSX logs	LSX-Protokolle	LSX 日誌	Journaux LSX
修复连接会启用模拟器并配置启动桥接；账户登录仍需手动完成。	Repair enables the emulator and configures the launch bridge. Sign in to your account separately.	Die Reparatur aktiviert den Emulator und richtet die Spielstart-Brücke ein. Melde dich anschließend bei deinem Konto an.	修復會啟用模擬器並設定啟動橋接；帳戶仍需手動登入。	La réparation active l’émulateur et configure la passerelle. Connectez-vous ensuite à votre compte.
外观与语言	Appearance and language	Darstellung und Sprache	外觀與語言	Apparence et langue
游戏启动	Game launch	Spielstart	遊戲啟動	Lancement du jeu
北极星更新	Northstar updates	Northstar-Updates	北極星更新	Mises à jour Northstar
连接与网络	Connection and network	Verbindung und Netzwerk	連線與網路	Connexion et réseau
维护工具	Maintenance tools	Wartungswerkzeuge	維護工具	Outils de maintenance
关于 TFX	About TFX	Über TFX	關於 TFX	À propos de TFX
选择让你最舒适的界面。	Choose your preferred appearance.	Wähle deine bevorzugte Darstellung.	選擇你喜歡的介面外觀。	Choisissez l’apparence qui vous convient.
界面主题	Interface theme	Oberflächendesign	介面主題	Thème de l’interface
离子白	Ion White	Ionenweiß	離子白	Blanc ionique
夜航	Night Runway	Nachtflug	夜航	Piste de nuit
晴空	Clear Sky	Klarer Himmel	晴空	Ciel clair
霜玻璃	Frosted Glass	Mattglas	霜玻璃	Verre givré
雾蓝	Mist Blue	Nebelblau	霧藍	Bleu brume
警戒橙	Sentry Orange	Signalorange	警戒橙	Orange sentinelle
荧绿舱	Neon Bay	Neonbucht	螢綠艙	Baie néon
棱镜青	Prism Cyan	Prisma-Cyan	稜鏡青	Cyan prisme
脉冲白	Pulse White	Pulsweiß	脈衝白	Blanc pulsé
货舱紫	Cargo Violet	Frachtviolett	貨艙紫	Violet cargo
钴蓝	Cobalt	Kobaltblau	鈷藍	Bleu cobalt
薄荷织锦	Pastel Weave	Pastellgewebe	薄荷織錦	Tissage pastel
风场蓝	Windline Blue	Windblau	風場藍	Bleu éolien
潮汐青	Tide Teal	Gezeitentürkis	潮汐青	Sarcelle marine
测绘橙	Survey Orange	Kartierungsorange	測繪橙	Orange topographique
合金灰	Alloy Gray	Legierungsgrau	合金灰	Gris alliage
工事蓝	Blueprint Blue	Blaupausenblau	工事藍	Bleu plan
设置已保存	Settings saved	Einstellungen gespeichert	設定已儲存	Paramètres enregistrés
所有设置已保存	All settings saved	Alle Einstellungen gespeichert	所有設定已儲存	Tous les paramètres sont enregistrés
所有设置已保存  /  仅保存在当前预览中	All settings saved	Alle Einstellungen gespeichert	所有設定已儲存	Tous les paramètres sont enregistrés
设置分类	Settings categories	Einstellungskategorien	設定分類	Catégories des paramètres
每一次空降，都从熟悉的配置开始。	Configure how the game launches.	Lege fest, wie dein Spiel startet.	設定遊戲的啟動方式。	Configurez le lancement du jeu.
Steam 游戏目录	Steam game folder	Steam-Spielordner	Steam 遊戲目錄	Dossier du jeu Steam
选择	Choose	Wählen	選擇	Choisir
国际服独立目录	Separate Global folder	Separater Global-Ordner	國際服獨立目錄	Dossier mondial séparé
Northstar 启动参数	Northstar launch arguments	Northstar-Startparameter	Northstar 啟動參數	Arguments de lancement Northstar
例如 -novid 跳过片头，-fullscreen 使用全屏。	Use -novid to skip the intro or -fullscreen for full screen.	Mit -novid überspringst du das Intro, mit -fullscreen startest du im Vollbild.	例如 -novid 略過片頭，-fullscreen 使用全螢幕。	Utilisez -novid pour passer l’introduction ou -fullscreen pour le plein écran.
国服 / 国际服独立模组配置	Separate China / Global mod profiles	Getrennte Mod-Profile für China und Global	國服／國際服獨立模組設定	Profils de mods Chine / Monde séparés
切换区域时，使用各自的模组启用状态。	Apply each region’s mod enabled states when switching.	Beim Regionswechsel wird der jeweilige Mod-Status angewendet.	切換區域時套用各自的模組啟用狀態。	Applique l’état des mods propre à chaque région lors du changement.
保留原始资源，让皮肤装配可恢复。	Keep original resources for skin recovery.	Bewahre Originalressourcen zur Skin-Wiederherstellung auf.	保留原始資源以便還原外觀。	Conservez les ressources d’origine pour restaurer les apparences.
启动前检查游戏资源，保留可恢复的原始文件。	Check game resources before launch and retain recoverable originals.	Prüfe vor dem Start die Spielressourcen und bewahre wiederherstellbare Originale auf.	啟動前檢查遊戲資源，保留可還原的原始檔案。	Vérifie les ressources avant le lancement et conserve les originaux récupérables.
原始资源快照	Original resource snapshot	Originalressourcen-Sicherung	原始資源快照	Instantané des ressources d’origine
配置检查	Configuration check	Konfigurationsprüfung	設定檢查	Vérification de la configuration
检查状态	Check status	Status prüfen	檢查狀態	Vérifier l’état
重新记录原始资源	Capture original resources again	Originalressourcen erneut sichern	重新記錄原始資源	Enregistrer de nouveau les ressources d’origine
更换皮肤前保留原始资源；可在“我的模组 / 武器库”中恢复。	Keep originals before changing skins. Restore them under My mods / Armory.	Sichere vor einem Skin-Wechsel die Originale. Unter Meine Mods / Waffenkammer kannst du sie wiederherstellen.	更換外觀前保留原始資源；可在「我的模組／武器庫」中還原。	Conservez les originaux avant de changer d’apparence. Restaurez-les dans Mes mods / Armurerie.
决定客户端如何检查和安装更新。	Configure client update checks and installation.	Konfiguriere die Suche und Installation von Client-Updates.	設定用戶端的更新檢查與安裝方式。	Configurez la recherche et l’installation des mises à jour du client.
自动检查 Northstar 更新	Check for Northstar updates automatically	Automatisch nach Northstar-Updates suchen	自動檢查 Northstar 更新	Rechercher automatiquement les mises à jour Northstar
启动 TFX 时检查所选区域的客户端版本。	Check the selected region’s client version when TFX starts.	Prüfe beim TFX-Start die Client-Version der gewählten Region.	啟動 TFX 時檢查所選區域的用戶端版本。	Vérifie la version du client de la région choisie au démarrage de TFX.
更新前备份	Back up before updating	Vor Updates sichern	更新前備份	Sauvegarder avant la mise à jour
保留当前配置与用户模组。	Keep the current configuration and user mods.	Behalte die aktuelle Konfiguration und Benutzer-Mods.	保留目前設定與使用者模組。	Conserve la configuration actuelle et les mods utilisateur.
更新时保留的目录	Folders to keep during updates	Bei Updates beibehaltene Ordner	更新時保留的目錄	Dossiers à conserver lors des mises à jour
使用英文逗号分隔目录名称。	Separate folder names with commas.	Trenne Ordnernamen durch Kommas.	請以半形逗號分隔目錄名稱。	Séparez les noms de dossiers par des virgules.
立即检查更新	Check for updates now	Jetzt nach Updates suchen	立即檢查更新	Rechercher les mises à jour
连接你偏好的社区和网络。	Configure community and network connections.	Konfiguriere Community- und Netzwerkverbindungen.	設定社群與網路連線。	Configurez les connexions communautaires et réseau.
DNS 预设	DNS preset	DNS-Vorgabe	DNS 預設	Préréglage DNS
自动 / 系统默认	Automatic / System default	Automatisch / Systemstandard	自動／系統預設	Automatique / Système
阿里 DNS  /  223.5.5.5	AliDNS  /  223.5.5.5	AliDNS  /  223.5.5.5	阿里 DNS  /  223.5.5.5	AliDNS  /  223.5.5.5
腾讯 DNS  /  119.29.29.29	Tencent DNS  /  119.29.29.29	Tencent DNS  /  119.29.29.29	騰訊 DNS  /  119.29.29.29	Tencent DNS  /  119.29.29.29
自定义 DNS	Custom DNS	Eigener DNS	自訂 DNS	DNS personnalisé
仅展示网络设置流程，不会修改系统网络。	This network settings preview does not change system networking.	Diese Netzwerkvorschau ändert keine Systemnetzwerkeinstellungen.	此網路設定預覽不會修改系統網路。	Cet aperçu ne modifie pas les paramètres réseau du système.
测试连接	Test connection	Verbindung testen	測試連線	Tester la connexion
清理 DNS 缓存	Flush DNS cache	DNS-Cache leeren	清除 DNS 快取	Vider le cache DNS
国内社区与国际社区可分别测试连接。	Test China and Global community connections separately.	Teste Verbindungen zur chinesischen und globalen Community getrennt.	可分別測試國內與國際社群連線。	Testez séparément les connexions aux communautés chinoise et mondiale.
例如 223.5.5.5	For example, 223.5.5.5	Zum Beispiel 223.5.5.5	例如 223.5.5.5	Par exemple, 223.5.5.5
清理临时内容，保持工作区整洁。	Manage temporary files and maintenance.	Verwalte temporäre Dateien und Wartungsaufgaben.	管理暫存檔案與維護工作。	Gérez les fichiers temporaires et la maintenance.
下载缓存	Download cache	Download-Cache	下載快取	Cache de téléchargement
清理	Clear	Leeren	清除	Vider
启动日志	Launch logs	Startprotokolle	啟動日誌	Journaux de lancement
查看启动、安装与更新的操作记录。	View launch, installation and update logs.	Zeige Protokolle zu Spielstarts, Installationen und Updates an.	查看啟動、安裝與更新紀錄。	Consultez les journaux de lancement, d’installation et de mise à jour.
查看日志	View logs	Protokolle anzeigen	查看日誌	Afficher les journaux
武器材质	Weapon textures	Waffentexturen	武器材質	Textures d’armes
管理 DDS / VTF 历史记录与原始文件。	Manage DDS / VTF history and original files.	Verwalte DDS-/VTF-Verläufe und Originaldateien.	管理 DDS／VTF 歷史紀錄與原始檔案。	Gérez l’historique DDS / VTF et les fichiers d’origine.
打开武器库	Open armory	Waffenkammer öffnen	開啟武器庫	Ouvrir l’armurerie
恢复默认设置	Restore default settings	Standardeinstellungen wiederherstellen	還原預設設定	Restaurer les paramètres par défaut
重置本预览中的偏好，不影响正式启动器。	Restore launcher preferences to their defaults.	Setze die Launcher-Einstellungen auf die Standardwerte zurück.	將啟動器偏好還原為預設值。	Rétablissez les préférences par défaut du lanceur.
恢复默认	Reset defaults	Zurücksetzen	還原預設	Réinitialiser
版本信息与项目致谢	Version information and credits	Versionsinformationen und Mitwirkende	版本資訊與專案致謝	Informations de version et remerciements
项目主页	Project homepage	Projektseite	專案首頁	Page du projet
合作伙伴	Partners	Partner	合作夥伴	Partenaires
特别鸣谢	Special thanks	Besonderer Dank	特別感謝	Remerciements
Northstar、NorthstarCN、Glock-雨夜、HK560、zxcPandora、R1Delta 团队	Northstar, NorthstarCN, Glock-雨夜, HK560, zxcPandora, R1Delta Team	Northstar, NorthstarCN, Glock-雨夜, HK560, zxcPandora, R1Delta Team	Northstar、NorthstarCN、Glock-雨夜、HK560、zxcPandora、R1Delta 團隊	Northstar, NorthstarCN, Glock-雨夜, HK560, zxcPandora, équipe R1Delta
许可证	License	Lizenz	授權條款	Licence
界面语言	Interface language	Oberflächensprache	介面語言	Langue de l’interface
尚未检查	Not checked	Noch nicht geprüft	尚未檢查	Non vérifié
打开页面后自动检查本地状态。	Local status is checked when this page opens.	Der lokale Status wird beim Öffnen dieser Seite geprüft.	開啟頁面後會自動檢查本機狀態。	L’état local est vérifié à l’ouverture de cette page.
重新诊断会检查本地状态及 EA 登录站点连接。	Diagnostics check local status and the EA sign-in connection.	Die Diagnose prüft den lokalen Status und die EA-Anmeldeverbindung.	重新診斷會檢查本機狀態及 EA 登入連線。	Le diagnostic vérifie l’état local et la connexion au service EA.
正在检查本地连接…	Checking local connections…	Lokale Verbindungen werden geprüft…	正在檢查本機連線…	Vérification des connexions locales…
正在启动…	Launching…	Wird gestartet…	正在啟動…	Lancement en cours…
有尚未保存的更改	Unsaved changes	Ungespeicherte Änderungen	有尚未儲存的變更	Modifications non enregistrées
保存设置	Save settings	Einstellungen speichern	儲存設定	Enregistrer les paramètres
取消	Cancel	Abbrechen	取消	Annuler
确认	Confirm	Bestätigen	確認	Confirmer
退出登录	Sign out	Abmelden	登出	Se déconnecter
重新连接	Reconnect	Erneut verbinden	重新連線	Reconnecter
登录已过期	Sign-in expired	Anmeldung abgelaufen	登入已過期	Connexion expirée
账户已连接	Account connected	Konto verbunden	帳戶已連結	Compte connecté
TITANFALL 2 已拥有	TITANFALL 2 owned	TITANFALL 2 im Besitz	已擁有 TITANFALL 2	TITANFALL 2 possédé
游戏授权将在启动时验证	Game ownership is checked at launch	Spielbesitz wird beim Start geprüft	遊戲擁有權將於啟動時驗證	La possession du jeu sera vérifiée au lancement
已过期，请刷新	Expired — refresh required	Abgelaufen – bitte aktualisieren	已過期，請重新整理	Expiré — actualisation requise
本地凭据已缓存	Local credentials cached	Zugangsdaten lokal gespeichert	本機憑證已快取	Identifiants locaux en cache
EA 账户头像	EA account avatar	EA-Kontoavatar	EA 帳戶頭像	Avatar du compte EA
运行中	Running	Wird ausgeführt	執行中	En cours d’exécution
已过期	Expired	Abgelaufen	已過期	Expiré
已缓存	Cached	Gespeichert	已快取	En cache
点击刷新账户；刷新失败时重新连接。	Refresh your account; reconnect if refreshing fails.	Aktualisiere dein Konto. Stelle die Verbindung bei einem Fehler erneut her.	請重新整理帳戶；失敗時重新連線。	Actualisez votre compte ; reconnectez-vous en cas d’échec.
本地凭据未过期；实际授权由游戏启动时验证。	Local credentials are valid; game ownership is checked at launch.	Lokale Zugangsdaten sind gültig. Der Spielbesitz wird beim Start geprüft.	本機憑證尚未過期；實際授權於啟動時驗證。	Les identifiants locaux sont valides ; la possession du jeu est vérifiée au lancement.
游戏目录检查通过。	Game folder check passed.	Spielordner erfolgreich geprüft.	遊戲目錄檢查通過。	Vérification du dossier du jeu réussie.
待配置	Not configured	Nicht konfiguriert	尚未設定	Non configuré
点击修复连接，配置本地启动桥接。	Choose Repair connection to configure the local launch bridge.	Wähle Verbindung reparieren, um die lokale Spielstart-Brücke einzurichten.	點選修復連線以設定本機啟動橋接。	Choisissez Réparer la connexion pour configurer la passerelle locale.
已连接	Connected	Verbunden	已連線	Connecté
检查失败	Check failed	Prüfung fehlgeschlagen	檢查失敗	Échec de la vérification
端口可用	Port available	Port verfügbar	連接埠可用	Port disponible
可连接	Reachable	Erreichbar	可連線	Accessible
连接失败	Connection failed	Verbindung fehlgeschlagen	連線失敗	Échec de connexion
检查通过	Checks passed	Prüfung bestanden	檢查通過	Vérifications réussies
已取消登录。	Sign-in cancelled.	Anmeldung abgebrochen.	已取消登入。	Connexion annulée.
EA 账户已连接。	EA account connected.	EA-Konto verbunden.	EA 帳戶已連結。	Compte EA connecté.
已退出 EA 账户。	Signed out of EA.	Von EA abgemeldet.	已登出 EA 帳戶。	Compte EA déconnecté.
尚未登录，请先连接 EA 账户。	Connect an EA account first.	Verbinde zuerst ein EA-Konto.	請先連結 EA 帳戶。	Connectez d’abord un compte EA.
账户状态已刷新。	Account status refreshed.	Kontostatus aktualisiert.	帳戶狀態已重新整理。	État du compte actualisé.
诊断报告已复制，可直接粘贴发送。	Diagnostic report copied. Paste it to share.	Diagnosebericht kopiert. Du kannst ihn jetzt einfügen und teilen.	診斷報告已複製，可貼上分享。	Rapport de diagnostic copié. Collez-le pour le partager.
诊断报告已复制	Diagnostic report copied	Diagnosebericht kopiert	診斷報告已複製	Rapport de diagnostic copié
部分问题仍需处理，请查看诊断项目。	Some issues remain. Review the diagnostic checks.	Einige Probleme bestehen weiterhin. Prüfe die Diagnosepunkte.	仍有部分問題，請查看診斷項目。	Certains problèmes subsistent. Consultez le diagnostic.
正在保存模拟器设置…	Saving emulator settings…	Emulatoreinstellungen werden gespeichert…	正在儲存模擬器設定…	Enregistrement des paramètres de l’émulateur…
已启用；本地服务会在启动游戏时建立。	Enabled. The local service starts when the game launches.	Aktiviert. Der lokale Dienst startet beim Spielstart.	已啟用；本機服務會在遊戲啟動時建立。	Activé. Le service local démarre au lancement du jeu.
EA 模拟器已关闭。	EA emulator disabled.	EA-Emulator deaktiviert.	EA 模擬器已關閉。	Émulateur EA désactivé.
等待 EA 登录窗口完成连接…	Waiting for EA sign-in…	Warten auf die EA-Anmeldung…	正在等待 EA 登入…	En attente de la connexion EA…
正在退出账户…	Signing out…	Abmeldung läuft…	正在登出帳戶…	Déconnexion en cours…
正在刷新账户凭据…	Refreshing account credentials…	Kontozugangsdaten werden aktualisiert…	正在重新整理帳戶憑證…	Actualisation des identifiants…
正在检查本地连接及 EA 登录站点…	Checking local connections and EA sign-in…	Lokale Verbindungen und EA-Anmeldung werden geprüft…	正在檢查本機連線與 EA 登入網站…	Vérification des connexions locales et EA…
正在修复启动桥接并复查连接…	Repairing the launch bridge and checking connections…	Spielstart-Brücke wird repariert und Verbindung geprüft…	正在修復啟動橋接並重新檢查連線…	Réparation de la passerelle et vérification des connexions…
正在复制诊断报告…	Copying diagnostic report…	Diagnosebericht wird kopiert…	正在複製診斷報告…	Copie du rapport de diagnostic…
正在打开日志…	Opening logs…	Protokolle werden geöffnet…	正在開啟日誌…	Ouverture des journaux…
游戏已启动	Game started	Spiel gestartet	遊戲已啟動	Jeu démarré
启动失败	Launch failed	Start fehlgeschlagen	啟動失敗	Échec du lancement
游戏已就绪	Game ready	Spiel bereit	遊戲已就緒	Jeu prêt
尚未选择游戏目录	No game folder selected	Kein Spielordner gewählt	尚未選擇遊戲目錄	Aucun dossier de jeu sélectionné
尚未安装此区域客户端	Client not installed for this region	Client für diese Region nicht installiert	尚未安裝此區域用戶端	Client non installé pour cette région
需要安装国际版框架	Global framework installation required	Globales Framework erforderlich	需要安裝國際版框架	Installation du framework mondial requise
导入模组	Import mod	Mod importieren	匯入模組	Importer un mod
已通过	Passed	Bestanden	已通過	Validé
待检查	Needs checking	Prüfung ausstehend	待檢查	À vérifier
可安装	Ready to install	Installationsbereit	可安裝	Prêt à installer
安装完成	Installed	Installiert	安裝完成	Installé
核心组件	Core component	Kernkomponente	核心元件	Composant principal
安装信息	Installation details	Installationsdetails	安裝資訊	Détails d’installation
兼容性	Compatibility	Kompatibilität	相容性	Compatibilité
安装到	Install to	Installieren in	安裝至	Installer dans
更改安装目标	Change installation target	Installationsziel ändern	變更安裝位置	Modifier la destination
状态	Status	Status	狀態	État
恢复原始	Restore originals	Originale wiederherstellen	還原原始檔案	Restaurer les originaux
确认还原	Confirm restore	Wiederherstellen	確認還原	Confirmer la restauration
恢复原始材质？	Restore original textures?	Originaltexturen wiederherstellen?	還原原始材質？	Restaurer les textures d’origine ?
还原已选记录？	Restore selected record?	Ausgewählten Eintrag wiederherstellen?	還原所選紀錄？	Restaurer l’historique sélectionné ?
所选武器的 DDS 和 VTF 文件将恢复为原始状态。	The selected weapon’s DDS and VTF files will be restored to their original state.	Die DDS- und VTF-Dateien der gewählten Waffe werden auf den Originalzustand zurückgesetzt.	所選武器的 DDS 與 VTF 檔案將還原為原始狀態。	Les fichiers DDS et VTF de l’arme choisie retrouveront leur état d’origine.
所选武器将切换回该历史材质记录。	The selected weapon will use this saved texture record.	Die gewählte Waffe erhält die Texturen dieses gespeicherten Eintrags.	所選武器將切換回這份歷史材質紀錄。	L’arme choisie utilisera les textures de cet historique.
还原此记录	Restore this record	Eintrag wiederherstellen	還原此紀錄	Restaurer cet historique
原始备份	Original backup	Originalsicherung	原始備份	Sauvegarde d’origine
当前	Current	Aktuell	目前	Actuel
还原完成	Restore complete	Wiederherstellung abgeschlossen	還原完成	Restauration terminée
客户端安装完成	Client installed	Client installiert	用戶端安裝完成	Client installé
DNS 缓存已清理	DNS cache cleared	DNS-Cache geleert	DNS 快取已清除	Cache DNS vidé
操作未完成	Operation incomplete	Vorgang nicht abgeschlossen	操作尚未完成	Opération incomplète
恢复启动器的默认偏好设置。	Restore the launcher’s default preferences.	Stelle die Standardeinstellungen des Launchers wieder her.	還原啟動器的預設偏好設定。	Restaurez les préférences par défaut du lanceur.
按名称排序	Name	Name	依名稱排序	Nom
按启用状态	Enabled state	Aktivierungsstatus	依啟用狀態	État d’activation
取消收藏	Remove favorite	Favorit entfernen	取消收藏	Retirer des favoris
收藏	Favorite	Favorit	收藏	Favori
全部服务器	All servers	Alle Server	全部伺服器	Tous les serveurs
我的收藏	My favorites	Meine Favoriten	我的收藏	Mes favoris
服务器已满	Server full	Server voll	伺服器已滿	Serveur complet
收藏服务器	Favorite server	Server favorisieren	收藏伺服器	Ajouter aux favoris
已收藏	Favorited	Favorisiert	已收藏	Ajouté aux favoris
导入文件	Import file	Datei importieren	匯入檔案	Importer un fichier
文件已就绪	File ready	Datei bereit	檔案已就緒	Fichier prêt
清除文件	Clear file	Datei entfernen	清除檔案	Retirer le fichier
纹理数量	Texture count	Texturanzahl	材質數量	Nombre de textures
模组数量	Mod count	Mod-Anzahl	模組數量	Nombre de mods
纹理尺寸	Texture dimensions	Texturgröße	材質尺寸	Dimensions des textures
目标位置	Target folder	Zielordner	目標位置	Dossier de destination
包含的资源	Included resources	Enthaltene Ressourcen	包含的資源	Ressources incluses
模组内容	Mod contents	Mod-Inhalt	模組內容	Contenu du mod
备份与还原记录会留在武器库中	Backups and restore history are kept in the armory	Sicherungen und Wiederherstellungsverlauf bleiben in der Waffenkammer	備份與還原紀錄會保留於武器庫	Les sauvegardes et restaurations sont conservées dans l’armurerie
模组将在“我的模组”中管理	Manage this mod under My mods	Verwalte diesen Mod unter Meine Mods	可在「我的模組」中管理此模組	Gérez ce mod dans Mes mods
安装材质	Install textures	Texturen installieren	安裝材質	Installer les textures
安装模组	Install mod	Mod installieren	安裝模組	Installer le mod
历史记录	History	Verlauf	歷史紀錄	Historique
已恢复原始	Originals restored	Originale wiederhergestellt	已還原原始檔案	Originaux restaurés
选择武器后恢复原始 DDS / VTF 文件	Choose a weapon to restore its original DDS / VTF files	Wähle eine Waffe, um ihre Originaldateien wiederherzustellen	選擇武器以還原原始 DDS／VTF 檔案	Choisissez une arme pour restaurer ses fichiers DDS / VTF d’origine
卸载用户模组？核心组件会保留。	Uninstall user mods? Core components will be kept.	Benutzer-Mods deinstallieren? Kernkomponenten bleiben erhalten.	解除安裝使用者模組？核心元件將保留。	Désinstaller les mods utilisateur ? Les composants principaux seront conservés.
退出 EA 登录？	Sign out of EA?	Von EA abmelden?	登出 EA？	Se déconnecter d’EA ?
清理下载缓存？	Clear the download cache?	Download-Cache leeren?	清除下載快取？	Vider le cache de téléchargement ?
恢复默认设置？	Restore default settings?	Standardeinstellungen wiederherstellen?	還原預設設定？	Restaurer les paramètres par défaut ?
请确认当前资源处于原版状态。记录原始资源？	Confirm the resources are unmodified. Capture originals?	Bestätige, dass die Ressourcen unverändert sind. Originale sichern?	請確認目前資源未經修改。記錄原始資源？	Confirmez que les ressources sont intactes. Enregistrer les originaux ?
后台运行未成功，请重试。	Could not run in the background. Try again.	Hintergrundbetrieb fehlgeschlagen. Versuche es erneut.	背景執行失敗，請重試。	Échec de l’exécution en arrière-plan. Réessayez.
启动器不提供直接加入服务器。	Join servers from within the game.	Tritt Servern direkt im Spiel bei.	請在遊戲中加入伺服器。	Rejoignez les serveurs depuis le jeu.
安装前备份由当前安装流程管理	Pre-installation backups are managed by the installer	Sicherungen vor der Installation werden vom Installer verwaltet	安裝前備份由安裝流程管理	Les sauvegardes sont gérées par le programme d’installation
未识别到安装文件	No installation files detected	Keine Installationsdateien erkannt	未偵測到安裝檔案	Aucun fichier d’installation détecté
突击步枪	Assault rifles	Sturmgewehre	突擊步槍	Fusils d’assaut
冲锋枪	Submachine guns	Maschinenpistolen	衝鋒槍	Pistolets-mitrailleurs
轻机枪	Light machine guns	Leichte Maschinengewehre	輕機槍	Mitrailleuses légères
狙击枪	Sniper rifles	Scharfschützengewehre	狙擊槍	Fusils de précision
霰弹枪	Shotguns	Schrotflinten	霰彈槍	Fusils à pompe
榴弹武器	Grenadier weapons	Granatwerfer	榴彈武器	Armes explosives
手枪	Pistols	Pistolen	手槍	Pistolets
反泰坦武器	Anti-Titan weapons	Anti-Titan-Waffen	反泰坦武器	Armes anti-Titans
泰坦武器	Titan weapons	Titan-Waffen	泰坦武器	Armes de Titan
启用优先	Enabled first	Aktivierte zuerst	啟用優先	Activés en premier
模组排序	Mod order	Mod-Reihenfolge	模組排序	Tri des mods
保存你的更改	Save your changes	Änderungen speichern	儲存你的變更	Enregistrer vos modifications
设置中有尚未保存的更改。离开前要保存吗？	You have unsaved settings. Save before leaving?	Du hast ungespeicherte Einstellungen. Vor dem Verlassen speichern?	設定中有尚未儲存的變更，離開前要儲存嗎？	Des paramètres ne sont pas enregistrés. Enregistrer avant de quitter ?
放弃更改	Discard changes	Änderungen verwerfen	放棄變更	Abandonner les modifications
保存并继续	Save and continue	Speichern und fortfahren	儲存並繼續	Enregistrer et continuer
更自由的安装位置	Flexible installation folders	Flexible Installationsordner	更自由的安裝位置	Dossiers d’installation flexibles
同一 NTFS 分区内，支持任意层级的独立空目录。	Use a separate empty folder at any level on the same NTFS volume.	Verwende einen separaten leeren Ordner auf demselben NTFS-Volume.	可在同一 NTFS 磁碟區使用任意層級的獨立空目錄。	Utilisez un dossier vide séparé à n’importe quel niveau du même volume NTFS.
准确的磁盘空间检查	Accurate disk space checks	Genaue Speicherplatzprüfung	準確的磁碟空間檢查	Vérification précise de l’espace disque
区分链接安装与完整复制所需空间。	Separate space estimates for linked installs and full copies.	Getrennte Speicherplatzberechnung für Verknüpfungen und vollständige Kopien.	區分連結安裝與完整複製所需空間。	Estime séparément l’espace pour les liens et les copies complètes.
统一的模组导入体验	Unified mod import	Einheitlicher Mod-Import	統一的模組匯入體驗	Importation unifiée des mods
更清晰的原版带 Mod 检查	Clearer original-game mod checks	Klarere Mod-Prüfung für das Originalspiel	更清楚的原版 Mod 檢查	Vérifications plus claires des mods du jeu d’origine
识别国际框架，并展示国服框架替换确认。	Detect the Global framework and confirm replacement of the China framework.	Erkennt das globale Framework und bestätigt den Ersatz des China-Frameworks.	辨識國際版框架，並確認替換國服框架。	Détecte le framework mondial et confirme le remplacement du framework chinois.
知道了	Got it	Verstanden	知道了	Compris
界面反馈	Interface feedback	Feedback zur Oberfläche	介面回饋	Commentaires sur l’interface
请指出需要调整的页面或界面元素。	Specify the page or interface element you want to improve.	Nenne die Seite oder das Oberflächenelement, das du verbessern möchtest.	請指出需要調整的頁面或介面元素。	Indiquez la page ou l’élément d’interface à améliorer.
继续体验	Continue	Fortfahren	繼續	Continuer
作者：	Author:	Autor:	作者：	Auteur :
分类：	Category:	Kategorie:	分類：	Catégorie :
状态：	Status:	Status:	狀態：	État :
版本	Version	Version	版本	Version
启用	Enable	Aktivieren	啟用	Activer
停用	Disable	Deaktivieren	停用	Désactiver
核心组件受到保护，无法停用或卸载。	Core components cannot be disabled or uninstalled.	Kernkomponenten können nicht deaktiviert oder deinstalliert werden.	核心元件受到保護，無法停用或解除安裝。	Les composants principaux ne peuvent pas être désactivés ou désinstallés.
用户模组可独立启用，也可以从装配中卸载。	User mods can be enabled individually or uninstalled.	Benutzer-Mods können einzeln aktiviert oder deinstalliert werden.	使用者模組可個別啟用或解除安裝。	Les mods utilisateur peuvent être activés individuellement ou désinstallés.
卸载模组	Uninstall mod	Mod deinstallieren	解除安裝模組	Désinstaller le mod
查看详情	View details	Details anzeigen	檢視詳情	Afficher les détails
安装到当前装配	Install to current profile	Im aktuellen Profil installieren	安裝至目前設定檔	Installer dans le profil actuel
客户端	Client	Client	用戶端	Client
安装	Install	Installieren	安裝	Installer
已安装	Installed	Installiert	已安裝	Installé
返回	Back	Zurück	返回	Retour
游戏根目录	Game root folder	Spiel-Hauptordner	遊戲根目錄	Dossier principal du jeu
启动模式	Launch mode	Startmodus	啟動模式	Mode de lancement
原版纯净	Original game	Originalspiel	原版純淨	Jeu d’origine
原版带 Mod	Original game with mods	Originalspiel mit Mods	原版含 Mod	Jeu d’origine avec mods
共享皮肤资源	Shared skin resources	Gemeinsame Skin-Ressourcen	共用外觀資源	Ressources d’apparence partagées
需要国际框架	Global framework required	Globales Framework erforderlich	需要國際版框架	Framework mondial requis
游戏根目录中的资源	Resources in the game folder	Ressourcen im Spielordner	遊戲目錄中的資源	Ressources du dossier du jeu
`.trim().split('\n').map(line=>line.split('\t')));
  rows.push(...`
打开模组目录	Open Addon folder	Addon-Ordner öffnen	開啟模組資料夾	Ouvrir le dossier des Addons
模组状态	Addon status	Addon-Status	模組狀態	État des Addons
文件夹	Folder	Ordner	資料夾	Dossier
打开备份目录	Open backup folder	Sicherungen öffnen	開啟備份資料夾	Ouvrir les sauvegardes
搜索模组	Search Addons	Addons suchen	搜尋模組	Rechercher des Addons
模组目录	Addon folder	Addon-Ordner	模組資料夾	Dossier des Addons
正在读取 Addon	Reading Addons	Addons werden gelesen	正在讀取模組	Lecture des Addons
修改将在下次启动 Delta 时生效	Changes apply the next time Delta starts	Änderungen gelten beim nächsten Delta-Start	變更會在下次啟動 Delta 時生效	Les changements seront appliqués au prochain lancement de Delta
选择 ZIP、VPK 或 Addon 文件夹导入。	Import a ZIP, VPK, or Addon folder.	Importiere eine ZIP-, VPK- oder Addon-Ordner.	選擇 ZIP、VPK 或模組資料夾匯入。	Importez un ZIP, un VPK ou un dossier d’Addon.
导入你的文件	Import your files	Dateien importieren	匯入檔案	Importer vos fichiers
自动识别	Auto-detect	Automatisch erkannt	自動識別	Détection automatique
把模组拖到这里	Drop an Addon here	Addon hier ablegen	將模組拖曳至此	Déposez un Addon ici
ZIP、单文件 VPK 或 Addon 文件夹	ZIP, single-file VPK, or Addon folder	ZIP, einzelnes VPK oder Addon-Ordner	ZIP、單一 VPK 或模組資料夾	ZIP, VPK autonome ou dossier d’Addon
支持的安装方式	Supported formats	Unterstützte Formate	支援的安裝方式	Formats pris en charge
VPK 直接导入；ZIP 自动识别其中的 Addon。	Import VPK files directly; Addons in ZIPs are detected automatically.	VPK direkt importieren; Addons in ZIP-Dateien werden automatisch erkannt.	直接匯入 VPK；ZIP 會自動辨識其中的 Addon。	Import direct des VPK ; détection automatique des Addons dans les ZIP.
文件夹需包含 addoninfo.txt，保留作者提供的目录结构。	Folders must include addoninfo.txt; keep the author's folder structure.	Ordner benötigen addoninfo.txt; behalte die Ordnerstruktur des Autors bei.	資料夾需包含 addoninfo.txt，並保留作者提供的目錄結構。	Les dossiers doivent contenir addoninfo.txt ; conservez la structure de l’auteur.
北极星和 Icepick 模组请切换到泰坦陨落 2 安装。	Switch to Titanfall 2 to install Northstar and Icepick mods.	Wechsle für Northstar- und Icepick-Mods zu Titanfall 2.	請切換至泰坦殞落 2 安裝 Northstar 和 Icepick 模組。	Passez à Titanfall 2 pour installer les mods Northstar et Icepick.
安装预览	Install preview	Installationsvorschau	安裝預覽	Aperçu de l’installation
清除	Clear	Leeren	清除	Vider
将替换同名模组，原文件会保留备份。	A matching Addon will be replaced; the original is backed up.	Ein gleichnamiges Addon wird ersetzt; das Original wird gesichert.	將取代同名模組，原始檔案會保留備份。	Un Addon du même nom sera remplacé ; l’original sera sauvegardé.
安装后启用	Enabled after install	Nach Installation aktiviert	安裝後啟用	Activé après l’installation
安装位置	Install location	Installationsort	安裝位置	Emplacement d’installation
等待安装	Ready to install	Installationsbereit	可安裝	Prêt à installer
安装进度	Install progress	Installationsfortschritt	安裝進度	Progression de l’installation
尚未选择模组	No Addon selected	Kein Addon ausgewählt	尚未選擇模組	Aucun Addon sélectionné
选择文件后，在这里确认安装内容和目录。	Select a file to review its contents and destination here.	Wähle eine Datei, um Inhalt und Ziel hier zu prüfen.	選擇檔案後，在此確認安裝內容與目錄。	Sélectionnez un fichier pour vérifier son contenu et sa destination.
查看已安装模组	View installed Addons	Installierte Addons ansehen	檢視已安裝模組	Voir les Addons installés
模组与 Delta 核心分开保存，更新核心时保留模组。	Addons are stored separately from the Delta core and remain when it updates.	Addons liegen getrennt vom Delta-Kern und bleiben bei Updates erhalten.	模組與 Delta 核心分開保存，更新核心時仍會保留。	Les Addons sont séparés du noyau Delta et conservés lors des mises à jour.
正在读取服务器列表	Loading server list	Serverliste wird geladen	正在讀取伺服器清單	Chargement de la liste des serveurs
Delta 服务器列表暂时不可用	Delta server list is temporarily unavailable	Delta-Serverliste ist vorübergehend nicht verfügbar	Delta 伺服器清單暫時無法使用	La liste des serveurs Delta est temporairement indisponible
连接失败，正在显示上次的服务器列表	Connection failed; showing the previous server list	Verbindung fehlgeschlagen; vorherige Serverliste wird angezeigt	連線失敗，正在顯示上次的伺服器清單	Connexion échouée ; affichage de la dernière liste
来自 R1Delta 官方主服务器	From the official R1Delta master server	Vom offiziellen R1Delta-Masterserver	來自 R1Delta 官方主伺服器	Depuis le serveur maître officiel de R1Delta
需要密码	Password required	Passwort erforderlich	需要密碼	Mot de passe requis
个服务器	servers	Server	個伺服器	serveurs
服务器地址	Server address	Serveradresse	伺服器位址	Adresse du serveur
服务器密码	Server password	Serverpasswort	伺服器密碼	Mot de passe du serveur
启动 Delta 并加入	Launch Delta and join	Delta starten und beitreten	啟動 Delta 並加入	Lancer Delta et rejoindre
复制地址	Copy address	Adresse kopieren	複製位址	Copier l’adresse
已在游戏中时，可在 Delta 内置服务器列表加入。	When the game is open, join from Delta's in-game server browser.	Bei geöffnetem Spiel kannst du über den Delta-Serverbrowser beitreten.	遊戲啟動後，可從 Delta 內建伺服器清單加入。	Une fois en jeu, rejoignez via le navigateur intégré de Delta.
服务器地址已复制	Server address copied	Serveradresse kopiert	已複製伺服器位址	Adresse du serveur copiée
已发送 Delta 加入请求	Delta join request sent	Delta-Beitrittsanfrage gesendet	已送出 Delta 加入要求	Demande de connexion Delta envoyée
此服务器需要密码	This server requires a password	Dieser Server benötigt ein Passwort	此伺服器需要密碼	Ce serveur nécessite un mot de passe
服务器已离线，请刷新列表	Server is offline; refresh the list	Server ist offline; aktualisiere die Liste	伺服器已離線，請重新整理清單	Serveur hors ligne ; actualisez la liste
Addon 名称无效	Invalid Addon name	Ungültiger Addon-Name	模組名稱無效	Nom d’Addon invalide
Addon 路径包含链接或非普通文件	Addon path contains a link or a non-regular file	Addon-Pfad enthält einen Link oder eine ungültige Datei	模組路徑包含連結或非一般檔案	Le chemin de l’Addon contient un lien ou un fichier non standard
addoninfo.txt 超过大小限制	addoninfo.txt exceeds the size limit	addoninfo.txt überschreitet das Größenlimit	addoninfo.txt 超過大小限制	addoninfo.txt dépasse la taille maximale
addoninfo.txt 格式无效	Invalid addoninfo.txt format	Ungültiges addoninfo.txt-Format	addoninfo.txt 格式無效	Format addoninfo.txt invalide
不是有效的 Delta VPK 模组	Not a valid Delta VPK Addon	Kein gültiges Delta-VPK-Addon	不是有效的 Delta VPK 模組	Ce VPK n’est pas un Addon Delta valide
VPK 文件大小无效	Invalid VPK file size	Ungültige VPK-Dateigröße	VPK 檔案大小無效	Taille de fichier VPK invalide
请选择完整的单文件 Addon VPK，分卷 VPK 请按作者说明安装	Choose a complete single-file Addon VPK; follow the author's instructions for split VPKs	Wähle ein vollständiges einzelnes Addon-VPK; bei geteilten Dateien beachte die Autorenhinweise	請選擇完整的單一 Addon VPK；分卷 VPK 請依作者說明安裝	Choisissez un VPK d’Addon autonome ; suivez les instructions de l’auteur pour les VPK fractionnés
addonlist.txt 无效，请先修复该文件	Invalid addonlist.txt; repair the file first	Ungültige addonlist.txt; repariere die Datei zuerst	addonlist.txt 無效，請先修復此檔案	addonlist.txt invalide ; réparez d’abord le fichier
addonlist.txt 格式无效	Invalid addonlist.txt format	Ungültiges addonlist.txt-Format	addonlist.txt 格式無效	Format addonlist.txt invalide
addonlist.txt 状态无效	Invalid addonlist.txt state	Ungültiger addonlist.txt-Status	addonlist.txt 狀態無效	État addonlist.txt invalide
另一个 Addon 操作正在进行	Another Addon operation is in progress	Ein anderer Addon-Vorgang läuft bereits	另一個模組操作正在進行	Une autre opération d’Addon est en cours
游戏目录已变化或 Delta 正在运行，请退出游戏后重试	The game folder changed or Delta is running; exit and retry	Spielordner geändert oder Delta aktiv; beende das Spiel und versuche es erneut	遊戲目錄已變更或 Delta 正在執行，請退出後重試	Le dossier du jeu a changé ou Delta est lancé ; quittez et réessayez
无法检查泰坦陨落 1 进程，请稍后重试	Could not check Titanfall 1 processes; retry shortly	Titanfall-1-Prozesse konnten nicht geprüft werden; versuche es erneut	無法檢查泰坦殞落 1 程序，請稍後重試	Impossible de vérifier les processus Titanfall 1 ; réessayez
请先退出泰坦陨落 1 再修改 Addon	Exit Titanfall 1 before changing Addons	Beende Titanfall 1, bevor du Addons änderst	請先退出泰坦殞落 1 再修改模組	Quittez Titanfall 1 avant de modifier les Addons
正在安装 Delta Addon	Installing Delta Addon	Delta-Addon wird installiert	正在安裝 Delta Addon	Installation de l’Addon Delta
Delta Addon 安装完成	Delta Addon installed	Delta-Addon installiert	Delta Addon 安裝完成	Addon Delta installé
Addon 状态无效	Invalid Addon state	Ungültiger Addon-Status	模組狀態無效	État d’Addon invalide
Addon 不存在	Addon not found	Addon nicht gefunden	找不到模組	Addon introuvable
预览文件已变化，请重新选择	The preview changed; select the file again	Die Vorschau hat sich geändert; wähle die Datei erneut	預覽檔案已變更，請重新選擇	L’aperçu a changé ; sélectionnez à nouveau le fichier
存在同名 Addon，请确认替换	An Addon with this name exists; confirm replacement	Ein gleichnamiges Addon existiert; bestätige den Ersatz	已有同名模組，請確認取代	Un Addon du même nom existe ; confirmez le remplacement
游戏目录已变化，请重新选择 Addon	The game folder changed; select the Addon again	Der Spielordner wurde geändert; wähle das Addon erneut	遊戲目錄已變更，請重新選擇模組	Le dossier du jeu a changé ; sélectionnez à nouveau l’Addon
预览已失效，请重新选择	The preview expired; select again	Die Vorschau ist abgelaufen; wähle erneut	預覽已失效，請重新選擇	L’aperçu a expiré ; sélectionnez à nouveau
选择本机 Addon 文件	Choose a local Addon file	Wähle eine lokale Addon-Datei	選擇本機模組檔案	Choisissez un fichier Addon local
支持 ZIP、单文件 VPK 或包含 addoninfo.txt 的文件夹	Supports ZIP, single-file VPK, or folders containing addoninfo.txt	Unterstützt ZIP, einzelne VPKs oder Ordner mit addoninfo.txt	支援 ZIP、單一 VPK 或含 addoninfo.txt 的資料夾	Prend en charge ZIP, VPK autonomes et dossiers contenant addoninfo.txt
未找到 Delta Addon：文件夹需包含 addoninfo.txt，北极星 mod.json 模组不适用于泰坦陨落 1	No Delta Addon found: folders need addoninfo.txt; Northstar mod.json packages are for Titanfall 2	Kein Delta-Addon gefunden: Ordner benötigen addoninfo.txt; Northstar-mod.json-Pakete gehören zu Titanfall 2	找不到 Delta Addon：資料夾需含 addoninfo.txt；Northstar mod.json 模組適用於泰坦殞落 2	Aucun Addon Delta trouvé : les dossiers doivent contenir addoninfo.txt ; les mods Northstar mod.json sont pour Titanfall 2
包内有同名 Addon，请拆分后导入	The package contains duplicate Addon names; import separately	Das Paket enthält gleichnamige Addons; importiere sie einzeln	套件內有同名模組，請分開匯入	Le paquet contient des Addons en double ; importez-les séparément
选择 Delta Addon	Choose a Delta Addon	Delta-Addon auswählen	選擇 Delta Addon	Choisir un Addon Delta
模组已卸载	Addon removed	Addon entfernt	模組已解除安裝	Addon supprimé
卸载此 Addon？文件会移入备份目录。	Remove this Addon? Its files will move to the backup folder.	Dieses Addon entfernen? Die Dateien werden gesichert.	解除安裝此模組？檔案會移至備份資料夾。	Supprimer cet Addon ? Ses fichiers seront sauvegardés.
服务器模式	Server mode	Servermodus	伺服器模式	Mode du serveur
服务器地图	Server map	Serverkarte	伺服器地圖	Carte du serveur
`.trim().split('\n').map(line=>line.split('\t')));
  const templates = [
    ['{count} 个启用','{count} enabled','{count} aktiviert','{count} 個啟用','{count} activés'],
    ['{count} 个模组','{count} mods','{count} Mods','{count} 個模組','{count} mods'],
    ['{count} 项','{count} items','{count} Einträge','{count} 項','{count} éléments'],
    ['{count} 个服务器  /  {players} 位铁驭在线','{count} servers  /  {players} pilots online','{count} Server  /  {players} Piloten online','{count} 個伺服器  /  {players} 位鐵馭在線','{count} serveurs  /  {players} pilotes en ligne'],
    ['模组排序：{sort}','Mod order: {sort}','Mod-Reihenfolge: {sort}','模組排序：{sort}','Tri des mods : {sort}'],
    ['{count} 条记录','{count} records','{count} Einträge','{count} 筆紀錄','{count} entrées'],
    ['TFX {version} 更新说明','TFX {version} release notes','TFX {version} – Versionshinweise','TFX {version} 更新說明','Notes de version TFX {version}'],
    ['收藏 {name}','Favorite {name}','{name} favorisieren','收藏 {name}','Ajouter {name} aux favoris'],
    ['取消收藏 {name}','Remove {name} from favorites','{name} aus Favoriten entfernen','取消收藏 {name}','Retirer {name} des favoris'],
    ['查看 {name}','View {name}','{name} anzeigen','檢視 {name}','Afficher {name}'],
    ['启用 {name}','Enable {name}','{name} aktivieren','啟用 {name}','Activer {name}'],
    ['{name} 详情','Details for {name}','Details zu {name}','{name} 詳情','Détails de {name}'],
    ['最近诊断 {time}','Last diagnosis {time}','Letzte Diagnose {time}','最近診斷 {time}','Dernier diagnostic {time}'],
    ['当前 Northstar {version}','Current Northstar {version}','Aktuell: Northstar {version}','目前 Northstar {version}','Northstar actuel {version}'],
    ['客户端已就绪  /  {version}','Client ready  /  {version}','Client bereit  /  {version}','用戶端已就緒  /  {version}','Client prêt  /  {version}'],
    ['释放下载缓存，当前占用 {size}。','Clear download cache, currently {size}.','Download-Cache leeren, derzeit {size}.','清除下載快取，目前佔用 {size}。','Vider le cache de téléchargement, actuellement {size}.'],
    ['本地端口 {port}','Local port {port}','Lokaler Port {port}','本機連接埠 {port}','Port local {port}'],
    ['端口检查返回 {code}。','Port check returned {code}.','Portprüfung meldet {code}.','連接埠檢查傳回 {code}。','La vérification du port a renvoyé {code}.'],
    ['EA 登录站点响应 {ms} ms；不代表账户已获授权。','EA sign-in responded in {ms} ms; this does not confirm game ownership.','EA-Anmeldung antwortete nach {ms} ms. Dies bestätigt keinen Spielbesitz.','EA 登入網站於 {ms} ms 內回應；不代表帳戶已獲授權。','Le service EA a répondu en {ms} ms ; cela ne confirme pas la possession du jeu.'],
    ['无法连接 EA 登录站点（{code}），请检查网络。','Cannot reach EA sign-in ({code}). Check your network.','EA-Anmeldung nicht erreichbar ({code}). Prüfe dein Netzwerk.','無法連線 EA 登入網站（{code}），請檢查網路。','Service EA inaccessible ({code}). Vérifiez votre réseau.'],
    ['{count} 项待处理','{count} issues to resolve','{count} offene Probleme','{count} 項待處理','{count} problèmes à résoudre'],
    ['诊断完成，{status}。','Diagnostics complete: {status}.','Diagnose abgeschlossen: {status}.','診斷完成，{status}。','Diagnostic terminé : {status}.'],
    ['启动桥接已修复；{status}。','Launch bridge repaired; {status}.','Spielstart-Brücke repariert; {status}.','啟動橋接已修復；{status}。','Passerelle réparée ; {status}.'],
    ['{name} 日志已打开。','{name} logs opened.','{name}-Protokolle geöffnet.','{name} 日誌已開啟。','Journaux {name} ouverts.'],
    ['卸载模组：{name}？','Uninstall mod: {name}?','Mod deinstallieren: {name}?','解除安裝模組：{name}？','Désinstaller le mod : {name} ?'],
    ['恢复 {name} 的原始 DDS / VTF 文件','Restore original DDS / VTF files for {name}','Originale DDS-/VTF-Dateien für {name} wiederherstellen','還原 {name} 的原始 DDS／VTF 檔案','Restaurer les fichiers DDS / VTF d’origine de {name}']
  ];
  rows.push(...templates);
  const strings = Object.fromEntries(['de-DE','zh-TW','fr-FR'].map((locale,index)=>[locale,Object.fromEntries(rows.map(row=>[row[1],row[index+2]]))]));
  window.TFXLocaleConfig = {
    manualSettings:true,
    strings,
    pairs:rows.map(([zh,en])=>[zh,en]),
    ignored:'.path,.mod-title>strong,.mod-row>.grow>p,.mod-meta,.catalog-name,.catalog-description,.catalog-content h2,.catalog-content>p,.catalog-meta,.server-name strong,.server-name small,.detail-title,.detail-description,.account-identity h2,.account-avatar,.file-receipt p,.install-target p,.file-table td:first-child,.history-row .grow>p,.arsenal-row .grow>strong,#ui-language option,.language-options button,code,pre',
    patterns:templates.map(([zh,en])=>{
      const tokens=[];
      const expression=zh.split(/(\{\w+\})/u).map(part=>/^\{\w+\}$/u.test(part)?(tokens.push(part),'(.+?)'):part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');
      return [new RegExp('^'+expression+'$','u'),(...args)=>en.replace(/\{\w+\}/gu,token=>{
        const value=args[tokens.indexOf(token)+1];
        return ['{status}','{sort}'].includes(token)?window.I18n.text(value,'en-US'):value;
      })];
    })
  };
})();
