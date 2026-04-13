import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = path.resolve(process.cwd());
const stageRoot = path.join(projectRoot, "build", "cep", "curvepilot");
const runtimeFiles = [
  ".debug",
  "index.html"
];
const runtimeDirectories = [
  "CSXS",
  "assets",
  "jsx",
  "lib",
  "js"
];
const runtimeNestedFiles = [
  "src/styles.css"
];

function runNodeScript(relativeScriptPath) {
  const scriptPath = path.join(projectRoot, relativeScriptPath);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: projectRoot,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Failed while running ${relativeScriptPath}.`);
  }
}

function resetDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
  fs.mkdirSync(directoryPath, { recursive: true });
}

function ensureExists(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required runtime path: ${relativePath}`);
  }
  return absolutePath;
}

function copyFileToStage(relativePath) {
  const sourcePath = ensureExists(relativePath);
  const destinationPath = path.join(stageRoot, relativePath);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function copyDirectoryToStage(relativePath) {
  const sourcePath = ensureExists(relativePath);
  const destinationPath = path.join(stageRoot, relativePath);
  fs.cpSync(sourcePath, destinationPath, {
    recursive: true
  });
}

function readVersion() {
  const packageJsonPath = path.join(projectRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (!packageJson.version) {
    throw new Error("package.json is missing a version value.");
  }
  return String(packageJson.version);
}

runNodeScript("scripts/build-cep-bundle.mjs");
resetDirectory(stageRoot);

runtimeFiles.forEach(copyFileToStage);
runtimeNestedFiles.forEach(copyFileToStage);
runtimeDirectories.forEach(copyDirectoryToStage);

const version = readVersion();
console.log(`Packaged CurvePilot ${version} into ${stageRoot}`);
