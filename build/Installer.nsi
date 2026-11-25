Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!ifndef APP_DIR
  !error "Build with Build-Tauri.ps1"
!endif

; TFX's installer uses its own compact, editorial page layout. MUI is used only
; for language resources and the standard uninstaller, not for installer pages.
Name "TFX Launcher ${VERSION}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\TFX Launcher"
InstallDirRegKey HKCU "Software\TFX Launcher" "InstallLocation"
RequestExecutionLevel user
ManifestDPIAware true
SetCompressor /SOLID lzma
SetCompressorDictSize 64
ShowInstDetails nevershow
ShowUninstDetails show
AutoCloseWindow true
BrandingText " "
VIProductVersion "${FILEVERSION}"
VIAddVersionKey /LANG=1033 "ProductName" "TFX Launcher Setup"
VIAddVersionKey /LANG=1033 "FileDescription" "TFX Launcher ${VERSION} Installer"
VIAddVersionKey /LANG=1033 "FileVersion" "${FILEVERSION}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "TFX Launcher contributors"
!define MUI_ICON "..\src-tauri\icons\icon.ico"
!define MUI_UNICON "..\src-tauri\icons\icon.ico"
!define MUI_BGCOLOR "161B26"
!define MUI_TEXTCOLOR "F7F8FA"
!define MUI_CUSTOMFUNCTION_GUIINIT SetupGuiInit
!define MUI_INSTFILESPAGE_COLORS "172333 F7F8FA"
!define SETUP_CANVAS "F7F8FA"
!define SETUP_INK "172333"
!define SETUP_MUTED "475568"
!define SETUP_ACCENT "815019"
!define MUI_ABORTWARNING

Var Dialog
Var LangPicker
Var PathInput
Var BrowseButton
Var DesktopToggle
Var DesktopShortcut
Var LaunchToggle
Var HeadingFont
Var BodyFont
Var BrandFont
Var SkipWelcome

Page custom WelcomePageCreate WelcomePageLeave
Page custom InstallPathPageCreate InstallPathPageLeave
!define MUI_PAGE_CUSTOMFUNCTION_SHOW InstallProgressShow
!insertmacro MUI_PAGE_INSTFILES
Page custom CompletePageCreate CompletePageLeave

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "TradChinese"
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "German"
!insertmacro MUI_LANGUAGE "French"
SetFont "Segoe UI" 9

; Page copy — five complete installer locales, kept separate from the app locale.
LangString WelcomeTitle ${LANG_SIMPCHINESE} "安装 TFX Launcher"
LangString WelcomeTitle ${LANG_TRADCHINESE} "安裝 TFX Launcher"
LangString WelcomeTitle ${LANG_ENGLISH} "Install TFX Launcher"
LangString WelcomeTitle ${LANG_GERMAN} "TFX Launcher installieren"
LangString WelcomeTitle ${LANG_FRENCH} "Installer TFX Launcher"
LangString WelcomeBody ${LANG_SIMPCHINESE} "选择安装向导的语言，下一步设置安装位置。"
LangString WelcomeBody ${LANG_TRADCHINESE} "選擇安裝精靈的語言，下一步設定安裝位置。"
LangString WelcomeBody ${LANG_ENGLISH} "Choose a setup language, then select where to install the launcher."
LangString WelcomeBody ${LANG_GERMAN} "Wählen Sie die Sprache für das Setup und anschließend den Installationsordner."
LangString WelcomeBody ${LANG_FRENCH} "Choisissez la langue de l’installation, puis le dossier de destination."
LangString LanguageLabel ${LANG_SIMPCHINESE} "安装语言"
LangString LanguageLabel ${LANG_TRADCHINESE} "安裝語言"
LangString LanguageLabel ${LANG_ENGLISH} "Setup language"
LangString LanguageLabel ${LANG_GERMAN} "Sprache des Setups"
LangString LanguageLabel ${LANG_FRENCH} "Langue de l’installation"
LangString LanguageHint ${LANG_SIMPCHINESE} "仅影响安装向导；启动器语言可在应用内更改。"
LangString LanguageHint ${LANG_TRADCHINESE} "僅影響安裝精靈；啟動器語言可於應用程式內更改。"
LangString LanguageHint ${LANG_ENGLISH} "This changes the installer only. Set launcher language in the app."
LangString LanguageHint ${LANG_GERMAN} "Gilt nur für das Setup. Die Launcher-Sprache ändern Sie in der App."
LangString LanguageHint ${LANG_FRENCH} "Cette langue concerne le setup. Changez celle du lanceur dans l’app."
LangString PathTitle ${LANG_SIMPCHINESE} "选择安装位置"
LangString PathTitle ${LANG_TRADCHINESE} "選擇安裝位置"
LangString PathTitle ${LANG_ENGLISH} "Choose your install location"
LangString PathTitle ${LANG_GERMAN} "Installationsort auswählen"
LangString PathTitle ${LANG_FRENCH} "Choisissez l’emplacement"
LangString PathBody ${LANG_SIMPCHINESE} "请选择独立的启动器文件夹，不要选游戏目录。"
LangString PathBody ${LANG_TRADCHINESE} "請選擇獨立的啟動器資料夾，不要選遊戲資料夾。"
LangString PathBody ${LANG_ENGLISH} "Use a separate folder for the launcher, not your game folder."
LangString PathBody ${LANG_GERMAN} "Wählen Sie einen separaten Ordner, nicht den Spielordner."
LangString PathBody ${LANG_FRENCH} "Choisissez un dossier distinct de celui du jeu."
LangString FolderLabel ${LANG_SIMPCHINESE} "安装文件夹"
LangString FolderLabel ${LANG_TRADCHINESE} "安裝資料夾"
LangString FolderLabel ${LANG_ENGLISH} "Installation folder"
LangString FolderLabel ${LANG_GERMAN} "Installationsordner"
LangString FolderLabel ${LANG_FRENCH} "Dossier d’installation"
LangString BrowseLabel ${LANG_SIMPCHINESE} "浏览…"
LangString BrowseLabel ${LANG_TRADCHINESE} "瀏覽…"
LangString BrowseLabel ${LANG_ENGLISH} "Browse…"
LangString BrowseLabel ${LANG_GERMAN} "Durchsuchen…"
LangString BrowseLabel ${LANG_FRENCH} "Parcourir…"
LangString DesktopLabel ${LANG_SIMPCHINESE} "创建桌面快捷方式"
LangString DesktopLabel ${LANG_TRADCHINESE} "建立桌面捷徑"
LangString DesktopLabel ${LANG_ENGLISH} "Create a desktop shortcut"
LangString DesktopLabel ${LANG_GERMAN} "Desktop-Verknüpfung erstellen"
LangString DesktopLabel ${LANG_FRENCH} "Créer un raccourci sur le bureau"
LangString CompleteTitle ${LANG_SIMPCHINESE} "已安装"
LangString CompleteTitle ${LANG_TRADCHINESE} "已安裝"
LangString CompleteTitle ${LANG_ENGLISH} "Installation complete"
LangString CompleteTitle ${LANG_GERMAN} "Installation abgeschlossen"
LangString CompleteTitle ${LANG_FRENCH} "Installation terminée"
LangString CompleteBody ${LANG_SIMPCHINESE} "打开启动器后，可在设置中添加游戏目录。"
LangString CompleteBody ${LANG_TRADCHINESE} "開啟啟動器後，可在設定中新增遊戲資料夾。"
LangString CompleteBody ${LANG_ENGLISH} "Open TFX Launcher to add your game folders in Settings."
LangString CompleteBody ${LANG_GERMAN} "Öffnen Sie den Launcher und fügen Sie Ihre Spielordner in den Einstellungen hinzu."
LangString CompleteBody ${LANG_FRENCH} "Ouvrez le lanceur pour ajouter vos dossiers de jeu dans les paramètres."
LangString LaunchLabel ${LANG_SIMPCHINESE} "立即启动 TFX Launcher"
LangString LaunchLabel ${LANG_TRADCHINESE} "立即啟動 TFX Launcher"
LangString LaunchLabel ${LANG_ENGLISH} "Launch TFX Launcher now"
LangString LaunchLabel ${LANG_GERMAN} "TFX Launcher jetzt starten"
LangString LaunchLabel ${LANG_FRENCH} "Lancer TFX Launcher maintenant"
LangString EmptyPathError ${LANG_SIMPCHINESE} "请输入完整的安装路径，或使用「浏览」选择文件夹。"
LangString EmptyPathError ${LANG_TRADCHINESE} "請輸入完整的安裝路徑，或使用「瀏覽」選擇資料夾。"
LangString EmptyPathError ${LANG_ENGLISH} "Enter a full installation path or select a folder with Browse."
LangString EmptyPathError ${LANG_GERMAN} "Geben Sie einen vollständigen Pfad ein oder wählen Sie einen Ordner aus."
LangString EmptyPathError ${LANG_FRENCH} "Saisissez un chemin complet ou sélectionnez un dossier."
LangString MainSection ${LANG_SIMPCHINESE} "TFX Launcher 核心文件"
LangString MainSection ${LANG_TRADCHINESE} "TFX Launcher 核心檔案"
LangString MainSection ${LANG_ENGLISH} "TFX Launcher core files"
LangString MainSection ${LANG_GERMAN} "TFX Launcher-Kerndateien"
LangString MainSection ${LANG_FRENCH} "Fichiers principaux de TFX Launcher"

LangString SetupRestartError ${LANG_SIMPCHINESE} "无法切换安装语言。请重试。"
LangString SetupRestartError ${LANG_TRADCHINESE} "無法切換安裝語言。請重試。"
LangString SetupRestartError ${LANG_ENGLISH} "Could not switch the setup language. Please try again."
LangString SetupRestartError ${LANG_GERMAN} "Die Setup-Sprache konnte nicht geändert werden. Bitte erneut versuchen."
LangString SetupRestartError ${LANG_FRENCH} "Impossible de changer la langue. Veuillez réessayer."

LangString StepLanguage ${LANG_SIMPCHINESE} "01 / 04    语言"
LangString StepLanguage ${LANG_TRADCHINESE} "01 / 04    語言"
LangString StepLanguage ${LANG_ENGLISH} "01 / 04    LANGUAGE"
LangString StepLanguage ${LANG_GERMAN} "01 / 04    SPRACHE"
LangString StepLanguage ${LANG_FRENCH} "01 / 04    LANGUE"

LangString StepLocation ${LANG_SIMPCHINESE} "02 / 04    位置"
LangString StepLocation ${LANG_TRADCHINESE} "02 / 04    位置"
LangString StepLocation ${LANG_ENGLISH} "02 / 04    LOCATION"
LangString StepLocation ${LANG_GERMAN} "02 / 04    INSTALLATIONSORT"
LangString StepLocation ${LANG_FRENCH} "02 / 04    EMPLACEMENT"

LangString StepInstall ${LANG_SIMPCHINESE} "03 / 04    正在安装"
LangString StepInstall ${LANG_TRADCHINESE} "03 / 04    正在安裝"
LangString StepInstall ${LANG_ENGLISH} "03 / 04    INSTALLING"
LangString StepInstall ${LANG_GERMAN} "03 / 04    INSTALLATION LÄUFT"
LangString StepInstall ${LANG_FRENCH} "03 / 04    INSTALLATION EN COURS"

LangString StepComplete ${LANG_SIMPCHINESE} "04 / 04    完成"
LangString StepComplete ${LANG_TRADCHINESE} "04 / 04    完成"
LangString StepComplete ${LANG_ENGLISH} "04 / 04    COMPLETE"
LangString StepComplete ${LANG_GERMAN} "04 / 04    FERTIG"
LangString StepComplete ${LANG_FRENCH} "04 / 04    TERMINÉ"


!macro SetupLabel X Y W H TEXT FONT COLOR
  ${NSD_CreateLabel} ${X} ${Y} ${W} ${H} "${TEXT}"
  Pop $0
  SendMessage $0 ${WM_SETFONT} ${FONT} 0
  SetCtlColors $0 ${COLOR} ${SETUP_CANVAS}
!macroend

; The built-in parent dialog is also laid out in dialog units.
!macro PositionSetupControl ID X Y W H
  GetDlgItem $0 $HWNDPARENT ${ID}
  System::Call '*(i ${X}, i ${Y}, i ${W}, i ${H}) p.r1'
  System::Call 'user32::MapDialogRect(p $HWNDPARENT, p r1)'
  System::Call '*$1(i.r2, i.r3, i.r4, i.r5)'
  System::Free $1
  System::Call 'user32::SetWindowPos(p r0, p 0, i r2, i r3, i r4, i r5, i 0x14)'
!macroend

Function .onInit
  SetShellVarContext current
  StrCpy $DesktopShortcut ${BST_CHECKED}
  ReadRegStr $0 HKCU "Software\TFX Launcher" "InstallerLanguage"
  ${If} $0 != ""
    StrCpy $LANGUAGE $0
  ${EndIf}
  ${GetParameters} $R0
  ${GetOptions} $R0 "/LANG=" $R1
  ${If} $R1 == ${LANG_SIMPCHINESE}
  ${OrIf} $R1 == ${LANG_TRADCHINESE}
  ${OrIf} $R1 == ${LANG_ENGLISH}
  ${OrIf} $R1 == ${LANG_GERMAN}
  ${OrIf} $R1 == ${LANG_FRENCH}
    StrCpy $LANGUAGE $R1
  ${EndIf}
  ClearErrors
  ${GetOptions} $R0 "/TFX-LOCATION" $R1
  ${IfNot} ${Errors}
    StrCpy $SkipWelcome 1
  ${EndIf}
FunctionEnd

Function SetupGuiInit
  SetCtlColors $HWNDPARENT ${SETUP_INK} ${SETUP_CANVAS}
  GetDlgItem $0 $HWNDPARENT 1256
  ShowWindow $0 ${SW_HIDE}
  !insertmacro PositionSetupControl 1037 20 5 260 14
  CreateFont $BrandFont "Segoe UI Semibold" 11
  SendMessage $0 ${WM_SETFONT} $BrandFont 0
  !insertmacro PositionSetupControl 1038 20 20 260 13
  !insertmacro PositionSetupControl 3 123 200 61 16
  !insertmacro PositionSetupControl 1 190 200 61 16
  !insertmacro PositionSetupControl 2 257 200 61 16
FunctionEnd

Function SetupHeader
  Exch $1
  !insertmacro MUI_HEADER_TEXT "TFX Launcher" "$1"
  Pop $1
FunctionEnd

Function SetupPage
  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}
  SetCtlColors $Dialog ${SETUP_INK} ${SETUP_CANVAS}
  CreateFont $HeadingFont "Segoe UI Semibold" 17
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_GETFONT} 0 0 $BodyFont
FunctionEnd

Function WelcomePageCreate
  ${If} $SkipWelcome == 1
    StrCpy $SkipWelcome 0
    Abort
  ${EndIf}
  Push "${VERSION}"
  Call SetupHeader
  Call SetupPage
  !insertmacro SetupLabel 5u 0u 290u 13u "$(StepLanguage)" $BodyFont ${SETUP_ACCENT}
  !insertmacro SetupLabel 5u 16u 290u 28u "$(WelcomeTitle)" $HeadingFont ${SETUP_INK}
  !insertmacro SetupLabel 5u 45u 290u 27u "$(WelcomeBody)" $BodyFont ${SETUP_MUTED}
  !insertmacro SetupLabel 5u 82u 290u 13u "$(LanguageLabel)" $BodyFont ${SETUP_INK}
  ${NSD_CreateDropList} 5u 98u 173u 95u ""
  Pop $LangPicker
  SendMessage $LangPicker ${WM_SETFONT} $BodyFont 0
  ${NSD_CB_AddString} $LangPicker "简体中文"
  ${NSD_CB_AddString} $LangPicker "繁體中文"
  ${NSD_CB_AddString} $LangPicker "English"
  ${NSD_CB_AddString} $LangPicker "Deutsch"
  ${NSD_CB_AddString} $LangPicker "Français"
  ${If} $LANGUAGE == ${LANG_SIMPCHINESE}
    StrCpy $0 0
  ${ElseIf} $LANGUAGE == ${LANG_TRADCHINESE}
    StrCpy $0 1
  ${ElseIf} $LANGUAGE == ${LANG_GERMAN}
    StrCpy $0 3
  ${ElseIf} $LANGUAGE == ${LANG_FRENCH}
    StrCpy $0 4
  ${Else}
    StrCpy $0 2
  ${EndIf}
  SendMessage $LangPicker ${CB_SETCURSEL} $0 0
  !insertmacro SetupLabel 5u 115u 290u 22u "$(LanguageHint)" $BodyFont ${SETUP_MUTED}
  nsDialogs::Show
  System::Call 'gdi32::DeleteObject(p $HeadingFont)'
FunctionEnd

Function WelcomePageLeave
  SendMessage $LangPicker ${CB_GETCURSEL} 0 0 $0
  ${If} $0 == 0
    StrCpy $0 ${LANG_SIMPCHINESE}
  ${ElseIf} $0 == 1
    StrCpy $0 ${LANG_TRADCHINESE}
  ${ElseIf} $0 == 3
    StrCpy $0 ${LANG_GERMAN}
  ${ElseIf} $0 == 4
    StrCpy $0 ${LANG_FRENCH}
  ${Else}
    StrCpy $0 ${LANG_ENGLISH}
  ${EndIf}
  ; Native buttons and the folder browser take their locale from .onInit.
  ${If} $0 != $LANGUAGE
    ClearErrors
    Exec '"$EXEPATH" /LANG=$0 /TFX-LOCATION /D=$INSTDIR'
    ${If} ${Errors}
      MessageBox MB_ICONEXCLAMATION|MB_OK "$(SetupRestartError)"
      Abort
    ${EndIf}
    Quit
  ${EndIf}
FunctionEnd

Function OnBrowseInstallPath
  Pop $0
  ${NSD_GetText} $PathInput $0
  nsDialogs::SelectFolderDialog "$(PathTitle)" $0
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $PathInput $0
  ${EndIf}
FunctionEnd

Function RememberPathOptions
  ${NSD_GetState} $DesktopToggle $DesktopShortcut
  ${NSD_GetText} $PathInput $INSTDIR
FunctionEnd

Function InstallPathPageCreate
  Push "${VERSION}"
  Call SetupHeader
  Call SetupPage
  !insertmacro SetupLabel 5u 0u 290u 13u "$(StepLocation)" $BodyFont ${SETUP_ACCENT}
  !insertmacro SetupLabel 5u 16u 290u 28u "$(PathTitle)" $HeadingFont ${SETUP_INK}
  !insertmacro SetupLabel 5u 45u 290u 26u "$(PathBody)" $BodyFont ${SETUP_MUTED}
  !insertmacro SetupLabel 5u 78u 290u 13u "$(FolderLabel)" $BodyFont ${SETUP_INK}
  ${NSD_CreateText} 5u 95u 212u 15u "$INSTDIR"
  Pop $PathInput
  SendMessage $PathInput ${WM_SETFONT} $BodyFont 0
  System::Call 'user32::SendMessageW(p $PathInput, i 0x00D3, p 3, p 0x00050005)'
  ${NSD_CreateButton} 224u 95u 71u 15u "$(BrowseLabel)"
  Pop $BrowseButton
  SendMessage $BrowseButton ${WM_SETFONT} $BodyFont 0
  ${NSD_OnClick} $BrowseButton OnBrowseInstallPath
  ${NSD_CreateCheckbox} 5u 122u 290u 15u "$(DesktopLabel)"
  Pop $DesktopToggle
  SendMessage $DesktopToggle ${WM_SETFONT} $BodyFont 0
  SetCtlColors $DesktopToggle ${SETUP_INK} ${SETUP_CANVAS}
  ${NSD_SetState} $DesktopToggle $DesktopShortcut
  GetFunctionAddress $0 RememberPathOptions
  nsDialogs::OnBack $0
  nsDialogs::Show
  System::Call 'gdi32::DeleteObject(p $HeadingFont)'
FunctionEnd

Function InstallPathPageLeave
  ${NSD_GetText} $PathInput $0
  System::Call 'shlwapi::PathIsRelativeW(w r0)i.r1'
  StrCpy $2 $0 1
  ${If} $0 == ""
  ${OrIf} $1 != 0
  ${OrIf} $2 == "\"
    ; A single leading backslash is relative to the current drive.
    StrCpy $2 $0 2
    ${If} $2 != "\\"
      MessageBox MB_ICONEXCLAMATION|MB_OK "$(EmptyPathError)"
      System::Call 'user32::SetFocus(p $PathInput)'
      Abort
    ${EndIf}
  ${EndIf}
  Call RememberPathOptions
FunctionEnd

Function InstallProgressShow
  Push "$(StepInstall)"
  Call SetupHeader
  SetCtlColors $mui.InstFilesPage ${SETUP_INK} ${SETUP_CANVAS}
  SetCtlColors $mui.InstFilesPage.Text ${SETUP_MUTED} ${SETUP_CANVAS}
FunctionEnd

Function CompletePageCreate
  IfAbort 0 +2
    Abort
  Push "${VERSION}"
  Call SetupHeader
  Call SetupPage
  !insertmacro SetupLabel 5u 0u 290u 13u "$(StepComplete)" $BodyFont ${SETUP_ACCENT}
  !insertmacro SetupLabel 5u 16u 290u 28u "$(CompleteTitle)" $HeadingFont ${SETUP_INK}
  !insertmacro SetupLabel 5u 45u 290u 30u "$(CompleteBody)" $BodyFont ${SETUP_MUTED}
  ${NSD_CreateCheckbox} 5u 91u 290u 17u "$(LaunchLabel)"
  Pop $LaunchToggle
  SendMessage $LaunchToggle ${WM_SETFONT} $BodyFont 0
  SetCtlColors $LaunchToggle ${SETUP_INK} ${SETUP_CANVAS}
  ${NSD_SetState} $LaunchToggle ${BST_CHECKED}
  nsDialogs::Show
  System::Call 'gdi32::DeleteObject(p $HeadingFont)'
FunctionEnd

Function CompletePageLeave
  ${NSD_GetState} $LaunchToggle $0
  ${If} $0 == ${BST_CHECKED}
    ExecShell "open" "$INSTDIR\TFX-Launcher.exe"
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
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "QuietUninstallString" "$\"$INSTDIR\Uninstall.exe$\" /S"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TFXLauncher" "EstimatedSize" $0
  CreateDirectory "$SMPROGRAMS\TFX Launcher"
  CreateShortcut "$SMPROGRAMS\TFX Launcher\TFX Launcher.lnk" "$INSTDIR\TFX-Launcher.exe"
  CreateShortcut "$SMPROGRAMS\TFX Launcher\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  ${If} $DesktopShortcut == ${BST_CHECKED}
    CreateShortcut "$DESKTOP\TFX Launcher.lnk" "$INSTDIR\TFX-Launcher.exe"
  ${EndIf}
SectionEnd

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
