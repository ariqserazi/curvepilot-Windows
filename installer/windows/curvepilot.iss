#ifndef CurvePilotAppVersion
  #error "CurvePilotAppVersion must be supplied by the build script."
#endif

#ifndef CurvePilotSourceDir
  #error "CurvePilotSourceDir must be supplied by the build script."
#endif

#ifndef CurvePilotInstallerOutputDir
  #error "CurvePilotInstallerOutputDir must be supplied by the build script."
#endif

#define MyAppName "CurvePilot"
#define MyAppPublisher "Ariq Serazi"
#define MyAppURL "https://github.com/ariqserazi/curvepilot"
#define MyAppId "{{80F866EE-54AB-4B7E-9D24-F9FAF5BA3F87}"
#define MyExtensionFolderName "curvepilot"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#CurvePilotAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={userappdata}\Adobe\CEP\extensions\{#MyExtensionFolderName}
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir={#CurvePilotInstallerOutputDir}
OutputBaseFilename=CurvePilot-Setup-{#CurvePilotAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x86compatible x64compatible
ChangesAssociations=no
UninstallDisplayName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "enabledebugmode"; Description: "Enable Adobe CEP PlayerDebugMode for the current user (needed for unsigned CurvePilot builds)"; Flags: checkedonce

[Dirs]
Name: "{app}"

[Files]
Source: "{#CurvePilotSourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
Root: HKCU; Subkey: "Software\Adobe\CSXS.11"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: preservestringtype; Tasks: enabledebugmode
Root: HKCU; Subkey: "Software\Adobe\CSXS.12"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: preservestringtype; Tasks: enabledebugmode

[InstallDelete]
Type: filesandordirs; Name: "{app}"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
