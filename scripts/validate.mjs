import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = path.resolve(process.cwd())
const requiredFiles = [
  "CSXS/manifest.xml",
  ".debug",
  "package.json",
  "installer/windows/curvepilot.iss",
  "lib/CSInterface.js",
  "jsx/curvepilot-host.jsx",
  "src/index.html",
  "src/main.js",
  "src/styles.css",
  "src/cep/bridge.js",
  "src/ui/curve-editor.js",
  "src/ui/preview.js",
  "src/ui/preset-list.js",
  "src/ui/property-picker.js",
  "src/easing/bezier.js",
  "src/easing/sampler.js",
  "src/easing/preset-store.js",
  "src/easing/apply-curve.js",
  "src/utils/logger.js",
  "src/utils/errors.js",
  "src/utils/math.js",
  "scripts/build-cep-bundle.mjs",
  "scripts/package-cep-extension.mjs",
  "scripts/build-windows-installer.mjs"
]

for (const relativeFile of requiredFiles) {
  const absoluteFile = path.join(root, relativeFile)
  if (!fs.existsSync(absoluteFile)) {
    throw new Error(`Missing required file: ${relativeFile}`)
  }
}

JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))

const manifestXml = fs.readFileSync(path.join(root, "CSXS/manifest.xml"), "utf8")
if (!manifestXml.includes("<ExtensionManifest") || !manifestXml.includes("CurvePilot")) {
  throw new Error("CSXS manifest.xml is missing required CEP extension metadata.")
}

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(absolutePath, files)
      continue
    }

    if (absolutePath.endsWith(".js")) {
      files.push(absolutePath)
    }
  }

  return files
}

const jsFiles = walk(path.join(root, "src"))
  .concat(walk(path.join(root, "jsx")))
  .concat(walk(path.join(root, "lib")))
  .concat([
    path.join(root, "scripts/validate.mjs"),
    path.join(root, "scripts/build-cep-bundle.mjs"),
    path.join(root, "scripts/package-cep-extension.mjs"),
    path.join(root, "scripts/build-windows-installer.mjs")
  ])

const installerScript = fs.readFileSync(path.join(root, "installer/windows/curvepilot.iss"), "utf8")
if (!installerScript.includes("DefaultDirName={userappdata}\\Adobe\\CEP\\extensions\\{#MyExtensionFolderName}")) {
  throw new Error("Windows installer script is not targeting the per-user Adobe CEP extensions directory.")
}

if (!installerScript.includes("PlayerDebugMode")) {
  throw new Error("Windows installer script is missing PlayerDebugMode registry handling.")
}

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8"
  })

  if (result.status !== 0) {
    throw new Error(`Syntax check failed for ${path.relative(root, file)}\n${result.stderr}`)
  }
}

console.log("CurvePilot validation passed.")
