Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!ifndef APP_DIR
  !error "Build with build/Build.ps1"
!endif
Name "TFX Launcher ${VERSION}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\TFX Launcher"
InstallDirRegKey HKCU "Software\TFX Launcher" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 32
ShowInstDetails show
ShowUninstDetails show
BrandingText "TFX Launcher  •  ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1033 "ProductName" "TFX Launcher Setup"
VIAddVersionKey /LANG=1033 "FileDescription" "TFX Launcher ${VERSION} Installer"
VIAddVersionKey /LANG=1033 "FileVersion" "${VERSION}.0"
VIAddVersionKey /LANG=1033 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "TFX Launcher contributors"
!define MUI_ICON "..\src\assets\icons\icon.ico"
!define MUI_UNICON "..\src\assets\icons\icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "wizard.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "wizard.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "header.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "header.bmp"
!define MUI_ABORTWARNING
!define MUI_LANGDLL_ALLLANGUAGES
!define MUI_LANGDLL_WINDOWTITLE "TFX Launcher — Language / 语言"
!define MUI_LANGDLL_INFO "Select installer language / 请选择安装语言"
!define MUI_WELCOMEPAGE_TITLE "TFX Launcher ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "$(WelcomeText)"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\TFX-Launcher.exe"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "TradChinese"
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "German"
!insertmacro MUI_LANGUAGE "French"
!insertmacro MUI_RESERVEFILE_LANGDLL
LangString WelcomeText ${LANG_SIMPCHINESE} "欢迎安装 TFX Launcher。$\r$\n$\r$\n统一管理游戏启动、模组、皮肤和 EA 模拟器。$\r$\n$\r$\n接下来可选择快捷方式与安装目录。安装语言不影响启动器内的语言设置。$\r$\n$\r$\n安装前请先退出正在运行的启动器。"
LangString WelcomeText ${LANG_TRADCHINESE} "歡迎安裝 TFX Launcher。$\r$\n$\r$\n統一管理遊戲啟動、模組、外觀與 EA 模擬器。$\r$\n$\r$\n接下來可選擇捷徑與安裝目錄。安裝語言不影響啟動器內的語言設定。$\r$\n$\r$\n安裝前請先結束正在執行的啟動器。"
LangString WelcomeText ${LANG_ENGLISH} "Welcome to TFX Launcher.$\r$\n$\r$\nYour games, mods, skins and EA emulator in one place.$\r$\n$\r$\nChoose your shortcuts and installation folder in the next steps. Installer language does not change your launcher language.$\r$\n$\r$\nPlease close the launcher before installing."
LangString WelcomeText ${LANG_GERMAN} "Willkommen bei TFX Launcher.$\r$\n$\r$\nSpiele, Mods, Skins und EA-Emulator an einem Ort.$\r$\n$\r$\nWählen Sie Verknüpfungen und Installationsordner. Die Sprache des Launchers bleibt unverändert.$\r$\n$\r$\nBitte schließen Sie den Launcher vor der Installation."
LangString WelcomeText ${LANG_FRENCH} "Bienvenue dans TFX Launcher.$\r$\n$\r$\nJeux, mods, skins et émulateur EA au même endroit.$\r$\n$\r$\nChoisissez les raccourcis et le dossier d'installation. La langue du lanceur reste inchangée.$\r$\n$\r$\nVeuillez fermer le lanceur avant l'installation."
LangString MainSection ${LANG_SIMPCHINESE} "TFX Launcher（必需）"
LangString MainSection ${LANG_TRADCHINESE} "TFX Launcher（必要）"
LangString MainSection ${LANG_ENGLISH} "TFX Launcher (required)"
LangString MainSection ${LANG_GERMAN} "TFX Launcher (erforderlich)"
LangString MainSection ${LANG_FRENCH} "TFX Launcher (requis)"
LangString DesktopSection ${LANG_SIMPCHINESE} "创建桌面快捷方式"
LangString DesktopSection ${LANG_TRADCHINESE} "建立桌面捷徑"
LangString DesktopSection ${LANG_ENGLISH} "Create a desktop shortcut"
LangString DesktopSection ${LANG_GERMAN} "Desktop-Verknüpfung erstellen"
LangString DesktopSection ${LANG_FRENCH} "Créer un raccourci sur le bureau"
LangString MainDescription ${LANG_SIMPCHINESE} "安装启动器及其内置工具。游戏文件需在启动器内单独设置。"
LangString MainDescription ${LANG_TRADCHINESE} "安裝啟動器及其內建工具。遊戲檔案需在啟動器內另行設定。"
LangString MainDescription ${LANG_ENGLISH} "Install the launcher and bundled tools. Configure game folders inside the launcher."
LangString MainDescription ${LANG_GERMAN} "Launcher und integrierte Werkzeuge installieren. Spielordner im Launcher auswählen."
LangString MainDescription ${LANG_FRENCH} "Installer le lanceur et ses outils. Configurez les dossiers de jeu dans le lanceur."
LangString DesktopDescription ${LANG_SIMPCHINESE} "在当前用户的桌面添加启动入口。"
LangString DesktopDescription ${LANG_TRADCHINESE} "在目前使用者的桌面新增啟動捷徑。"
LangString DesktopDescription ${LANG_ENGLISH} "Add a launcher shortcut to your desktop."
LangString DesktopDescription ${LANG_GERMAN} "Eine Verknüpfung auf Ihrem Desktop hinzufügen."
LangString DesktopDescription ${LANG_FRENCH} "Ajouter un raccourci sur votre bureau."
Function .onInit
  SetShellVarContext current
  ${GetParameters} $R0
  ${GetOptions} $R0 "/LANG=" $R1
  ${If} $R1 != ""
    StrCpy $LANGUAGE $R1
  ${Else}
    IfSilent noLanguageDialog
    !insertmacro MUI_LANGDLL_DISPLAY
    noLanguageDialog:
  ${EndIf}
FunctionEnd
Section "$(MainSection)" Main
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "${APP_DIR}\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\TFX Launcher" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\TFX Launcher" "InstallerLanguage" "$LANGUAGE"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "DisplayName" "TFX Launcher"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "Publisher" "TFX Launcher contributors"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "DisplayIcon" "$INSTDIR\TFX-Launcher.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "QuietUninstallString" '$\"$INSTDIR\Uninstall.exe$\" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "EstimatedSize" $0
  CreateDirectory "$SMPROGRAMS\TFX Launcher"
  CreateShortcut "$SMPROGRAMS\TFX Launcher\TFX Launcher.lnk" "$INSTDIR\TFX-Launcher.exe"
  CreateShortcut "$SMPROGRAMS\TFX Launcher\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd
Section "$(DesktopSection)" Desktop
  CreateShortcut "$DESKTOP\TFX Launcher.lnk" "$INSTDIR\TFX-Launcher.exe"
SectionEnd
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${Main} "$(MainDescription)"
  !insertmacro MUI_DESCRIPTION_TEXT ${Desktop} "$(DesktopDescription)"
!insertmacro MUI_FUNCTION_DESCRIPTION_END
Function un.onInit
  SetShellVarContext current
  ReadRegStr $LANGUAGE HKCU "Software\TFX Launcher" "InstallerLanguage"
FunctionEnd
Section "Uninstall"
  !include "${UNINSTALL_MANIFEST}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\TFX Launcher\TFX Launcher.lnk"
  Delete "$SMPROGRAMS\TFX Launcher\Uninstall.lnk"
  RMDir "$SMPROGRAMS\TFX Launcher"
  Delete "$DESKTOP\TFX Launcher.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher"
  DeleteRegKey HKCU "Software\TFX Launcher"
SectionEnd
