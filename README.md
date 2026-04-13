# CurvePilot for Windows

CurvePilot is an Adobe Premiere Pro CEP extension packaged for Windows with:

- a repeatable CEP staging flow
- a real per-user Windows installer built with Inno Setup
- uninstall support for the installed extension files

If you want the macOS version, use:

- [https://github.com/ariqserazi/curvepilot](https://github.com/ariqserazi/curvepilot)

This repo uses the existing CEP architecture and packages it for the classic Adobe extension workflow on Windows:

1. build or unpack the extension folder
2. install it into the Adobe CEP extensions directory
3. enable `PlayerDebugMode` for unsigned CEP installs
4. restart Premiere Pro
5. open the panel from `Window > Extensions`

No UXP Developer Tool is required. No `.ccx` package is required. No Creative Cloud Desktop install flow is required.

## What Changed From The UXP Version

- Removed the UXP `manifest.json` packaging path
- Added a CEP `CSXS/manifest.xml`
- Replaced UXP entrypoints with a CEP panel boot path
- Replaced UXP host calls with a CEP `CSInterface` bridge and ExtendScript host script
- Replaced UXP sandbox persistence with local browser `localStorage`
- Replaced UXP preset import/export file access with ExtendScript file dialogs
- Removed any dependency on UXP Developer Tool or `.ccx` installation

One important tradeoff came with that conversion:

- The old UXP transaction API is gone in CEP, so single-step grouped undo is not guaranteed by the documented CEP/ExtendScript scripting path

## Current CEP Feature Set

### Panel UI

- Dark dockable CEP panel
- Custom curve editor with draggable bezier handles
- Live miniature preview
- Numeric handle controls
- Reset, invert, mirror, and flip controls

### Presets

- Built-in presets:
  - Linear
  - Lift Off
  - Soft Arrival
  - Balanced Ease
  - Punch In
  - Punch Out
  - Spring Arc
  - Velvet S
- Save custom presets locally
- Rename custom presets
- Duplicate presets
- Delete custom presets
- Import presets from JSON
- Export presets to JSON
- Persist last-used settings between Premiere restarts through `localStorage`

### Targeting

- Detect active Premiere project
- Detect active sequence
- Detect selected video clips
- Supported built-in property targets:
  - Position
  - Scale
  - Rotation
  - Opacity
- Advanced mode for shared numeric effect params when the ExtendScript DOM exposes keyframe methods for them

### Time Span Modes

- Clip bounds
- Existing endpoint keyframes
- Custom normalized span

### Apply Flow

- Dry-run preview summary
- Existing-key warning before overwrite
- Dense-region warning
- Curve sampling with Low, Medium, High, and Custom densities
- Interpolation choices:
  - Bezier
  - Linear
  - Hold
- Endpoint value preservation while rebuilding the chosen span

## Repo Layout

```text
curvepilot/
├── .debug
├── CSXS/
│   └── manifest.xml
├── assets/
│   └── icons/
├── jsx/
│   └── curvepilot-host.jsx
├── lib/
│   └── CSInterface.js
├── package.json
├── README.md
├── scripts/
│   └── validate.mjs
└── src/
    ├── cep/
    ├── easing/
    ├── index.html
    ├── main.js
    ├── styles.css
    ├── ui/
    └── utils/
```

## Requirements

- Windows
- Adobe Premiere Pro with CEP panel support
- For the current target, Premiere Pro 2025 / 25.x is the intended path
- Node.js v24 or later if you want to run the local build and validation commands
- Inno Setup 6 if you want to compile the Windows installer

## Build Outputs

Running the packaging scripts produces:

- `build/cep/curvepilot/`
  - clean staged CEP extension folder for manual install or installer input
- `build/windows-installer/`
  - generated Windows installer output

The staged CEP folder includes the runtime files Premiere needs:

- `CSXS/manifest.xml`
- `index.html`
- `js/app.bundle.js`
- `src/styles.css`
- `jsx/`
- `lib/`
- `assets/`
- `.debug`

## Windows Build And Install

### 1. Build the staged CEP extension folder

From the repo root:

```bash
npm run build:cep
```

That writes the clean extension folder to:

- `build/cep/curvepilot/`

### 2. Build the Windows installer

On Windows, after installing Inno Setup 6:

```bash
npm run build:windows-installer
```

That script:

- rebuilds `js/app.bundle.js`
- refreshes `build/cep/curvepilot/`
- compiles `installer/windows/curvepilot.iss`

Installer output is written to:

- `build/windows-installer/CurvePilot-Setup-<version>.exe`

If `ISCC.exe` is not on `PATH`, set `ISCC_PATH` to the full path of `ISCC.exe` before running the command.

### 3. Install CurvePilot on Windows

Run the generated installer:

- it installs CurvePilot per user to `%APPDATA%\Adobe\CEP\extensions\curvepilot`
- it does not require admin by default
- it offers to enable `PlayerDebugMode` for `HKCU\Software\Adobe\CSXS.11` and `HKCU\Software\Adobe\CSXS.12`
- it registers an uninstaller

After install:

1. quit Premiere Pro completely
2. reopen Premiere Pro
3. open `Window > Extensions > CurvePilot`
4. if needed, also check `Window > Extensions (Legacy) > CurvePilot`

### 4. Uninstall on Windows

Use the normal Windows uninstall entry for CurvePilot, or run the generated uninstaller.

The uninstaller removes the installed extension folder from:

- `%APPDATA%\Adobe\CEP\extensions\curvepilot`

The installer intentionally does not turn `PlayerDebugMode` back off during uninstall, because that setting may also be needed by other unsigned CEP extensions in the same user profile.

## Windows Build And Install

### 1. Build the staged CEP extension folder

The staged folder must directly contain:

- `CSXS/manifest.xml`
- `index.html`
- `jsx/`
- `lib/`
- `js/`

From the repo root:

```bash
npm run build:cep
```

That writes the clean extension folder to:

- `build/cep/curvepilot/`

### 2. Build the Windows installer

After installing Inno Setup 6:

```bash
npm run build:windows-installer
```

That script:

- rebuilds `js/app.bundle.js`
- refreshes `build/cep/curvepilot/`
- compiles `installer/windows/curvepilot.iss`

Installer output is written to:

- `build/windows-installer/CurvePilot-Setup-<version>.exe`

If `ISCC.exe` is not on `PATH`, set `ISCC_PATH` to the full path of `ISCC.exe` before running the command.

### 3. Install CurvePilot on Windows

Run the generated installer:

- it installs CurvePilot per user to `%APPDATA%\Adobe\CEP\extensions\curvepilot`
- it does not require admin by default
- it offers to enable `PlayerDebugMode` for `HKCU\Software\Adobe\CSXS.11` and `HKCU\Software\Adobe\CSXS.12`
- it registers an uninstaller

After install:

1. quit Premiere Pro completely
2. reopen Premiere Pro
3. open `Window > Extensions > CurvePilot`
4. if needed, also check `Window > Extensions (Legacy) > CurvePilot`

### 4. Manual install without the installer

If you want to test the staged CEP folder directly, copy `build/cep/curvepilot/` to:

- `%APPDATA%\Adobe\CEP\extensions\curvepilot`

Then enable:

- `HKEY_CURRENT_USER\Software\Adobe\CSXS.11\PlayerDebugMode = "1"`
- `HKEY_CURRENT_USER\Software\Adobe\CSXS.12\PlayerDebugMode = "1"`

Then restart Premiere Pro and open CurvePilot from `Window > Extensions`.

## Verify The Extension Loaded

Use this checklist after restarting Premiere:

1. Open `Window > Extensions`
2. Look for `CurvePilot`
3. Open it
4. Confirm the panel renders its dark CurvePilot UI
5. Select clips in an active sequence and click `Refresh` in the Targeting section

If the menu entry is missing, jump to the troubleshooting section below.

## Local Development

This repo does not require dependency installation for the panel itself.

Run the local validation pass:

```bash
npm run check
```

That validation currently checks:

- required CEP project files exist
- `package.json` parses
- `CSXS/manifest.xml` exists and looks like a CEP manifest
- the Windows installer script targets the per-user CEP extensions directory
- the Windows installer script includes `PlayerDebugMode` registry handling
- panel-side JS and host-side JSX parse successfully

Build the browser bundle only:

```bash
npm run build
```

Build the clean staged CEP extension folder:

```bash
npm run build:cep
```

Build the Windows installer on Windows:

```bash
npm run build:windows-installer
```

## How To Use CurvePilot

1. Open CurvePilot from `Window > Extensions`.
2. Adjust the curve by dragging the handles or editing the numeric fields.
3. Select one or more video clips in the active Premiere sequence.
4. Click `Refresh` in the Targeting section if the timeline selection changed.
5. Choose one or more supported properties.
6. Pick the apply span mode.
7. Choose the sample density and interpolation mode.
8. Review the dry-run summary.
9. If CurvePilot warns that existing keyframes will be replaced in the span, acknowledge the warning.
10. Click `Apply curve`.

## Updating Or Removing The Extension

### Update

1. Quit Premiere Pro
2. Replace the existing installed folder at:
   - `%APPDATA%\Adobe\CEP\extensions\curvepilot`
3. Reopen Premiere Pro
4. Open CurvePilot again from `Window > Extensions`

### Remove

1. Quit Premiere Pro
2. Use the Windows uninstaller, or delete:
   - `%APPDATA%\Adobe\CEP\extensions\curvepilot`

3. Reopen Premiere Pro

CurvePilot should no longer appear under `Window > Extensions`.

## Limitations

1. CurvePilot samples your easing curve into keyframes. It does not edit Premiere's native graph handles directly.

2. Existing keyframes inside the chosen span are removed and rebuilt from the sampled curve after the span endpoint values are preserved.

3. Position uses a shared easing progress across X and Y.

4. Advanced mode is intentionally conservative. It only exposes shared numeric parameters when the CEP/ExtendScript DOM exposes the keyframe methods CurvePilot needs.

5. The CEP version does not have the UXP `executeTransaction()` API. Because of that, CurvePilot cannot honestly promise one grouped undo step for the whole apply operation.

6. If the selected property has no start/end value delta over the chosen span, the generated sampled keys may not create visible motion.

7. Preset persistence in this CEP version uses panel `localStorage`, which is appropriate for long-term personal manual installs but is not a shared multi-user storage system.

## Troubleshooting

### CurvePilot does not appear under `Window > Extensions`

- Confirm the installed folder path is exactly:
  - `%APPDATA%\Adobe\CEP\extensions\curvepilot`
- Confirm the folder contains `CSXS/manifest.xml`
- Confirm `PlayerDebugMode` is enabled for the CEP version Premiere is using
- Restart Premiere Pro after enabling debug mode
- If your build uses the legacy label, also check `Window > Extensions (Legacy)`

### The extension folder is present, but Premiere still does not see it

- Make sure you copied the extension folder itself, not just its contents
- Make sure `manifest.xml` is inside a `CSXS` folder at the extension root
- Re-run:

```bash
defaults read com.adobe.CSXS.12 PlayerDebugMode
defaults read com.adobe.CSXS.11 PlayerDebugMode
```

On Windows, verify the current-user registry values exist:

- `HKEY_CURRENT_USER\Software\Adobe\CSXS.12\PlayerDebugMode`
- `HKEY_CURRENT_USER\Software\Adobe\CSXS.11\PlayerDebugMode`

### Manifest issues

- The root extension folder must contain `CSXS/manifest.xml`
- The extension id in `CSXS/manifest.xml` must stay consistent with `.debug`
- If you edit the manifest, restart Premiere Pro before expecting the change to show up

### Windows installer build fails before compilation

- Install Inno Setup 6 on Windows
- Re-run `npm run build:windows-installer`
- If `ISCC.exe` is not on `PATH`, set `ISCC_PATH` to the full path to `ISCC.exe`

### The panel opens, but the UI is blank

- Run `npm run check` in the repo first
- Make sure the installed copy includes:
  - `src/`
  - `lib/`
  - `jsx/`
  - `assets/`
- If you changed files after copying, replace the installed folder with the updated one

### The panel opens, but targeting shows nothing

- Open a project
- Open an active sequence
- Select video clips in the timeline
- Click `Refresh`
- Start with Motion properties and Opacity before trying Advanced mode

### Apply did not create visible motion

- Check whether the chosen property already has different start and end values over the selected span
- If not, CurvePilot may only create a flat sampled keyframe set
- Existing endpoint keyframes mode is the most reliable way to drive a visible easing change

### Import or export dialogs fail

- CEP file operations here are handled by the ExtendScript host layer
- Make sure Premiere is not blocked by OS permission prompts
- Retry after reopening the panel

## Verification Status

What was verified directly in this workspace:

- CEP folder structure exists
- `CSXS/manifest.xml` exists
- `.debug` exists
- panel-side JS parses
- host-side JSX parses
- `npm run check` passes

What was not verified in-host here:

- running the generated Windows installer on a real Windows machine
- registry changes under real Windows `HKCU\Software\Adobe\CSXS.11` and `HKCU\Software\Adobe\CSXS.12`
- live appearance under `Window > Extensions` on Windows Premiere
- end-to-end apply behavior against a real Premiere sequence

That final host-side verification still needs to be done on a real Windows Premiere environment.
