import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = path.resolve(process.cwd());
const packageScriptPath = path.join(projectRoot, "scripts", "package-cep-extension.mjs");
const installerScriptPath = path.join(projectRoot, "installer", "windows", "curvepilot.iss");
const stagedExtensionPath = path.join(projectRoot, "build", "cep", "curvepilot");
const installerOutputPath = path.join(projectRoot, "build", "windows-installer");

function runNodeScript(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: projectRoot,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Failed while running ${path.relative(projectRoot, scriptPath)}.`);
  }
}

function readVersion() {
  const packageJsonPath = path.join(projectRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (!packageJson.version) {
    throw new Error("package.json is missing a version value.");
  }
  return String(packageJson.version);
}

function resolveCompilerPath() {
  const envPath = process.env.ISCC_PATH;
  if (envPath) {
    return envPath;
  }

  if (process.platform !== "win32") {
    throw new Error(
      "Windows installer compilation must be run on Windows with Inno Setup 6 installed, or with ISCC_PATH pointed at ISCC.exe."
    );
  }

  const candidates = [
    "iscc",
    path.join(process.env["ProgramFiles(x86)"] || "", "Inno Setup 6", "ISCC.exe"),
    path.join(process.env.ProgramFiles || "", "Inno Setup 6", "ISCC.exe")
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === "iscc") {
      return candidate;
    }

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Could not find Inno Setup Compiler. Install Inno Setup 6 or set ISCC_PATH to ISCC.exe."
  );
}

runNodeScript(packageScriptPath);

if (!fs.existsSync(installerScriptPath)) {
  throw new Error(`Missing installer script: ${path.relative(projectRoot, installerScriptPath)}`);
}

if (!fs.existsSync(stagedExtensionPath)) {
  throw new Error(`Missing staged extension folder: ${path.relative(projectRoot, stagedExtensionPath)}`);
}

fs.mkdirSync(installerOutputPath, { recursive: true });

const compilerPath = resolveCompilerPath();
const version = readVersion();
const compileArgs = [
  `/DCurvePilotAppVersion=${version}`,
  `/DCurvePilotSourceDir=${stagedExtensionPath}`,
  `/DCurvePilotInstallerOutputDir=${installerOutputPath}`,
  installerScriptPath
];

const result = spawnSync(compilerPath, compileArgs, {
  cwd: projectRoot,
  stdio: "inherit",
  shell: process.platform !== "win32" && compilerPath === "iscc"
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error("Inno Setup compilation failed.");
}

console.log(`Built Windows installer in ${installerOutputPath}`);
