#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.join(__dirname, "..");
const DEFAULT_OUT_DIR = path.join(ROOT_DIR, "releases");
const MANIFEST_PATH = path.join(ROOT_DIR, "manifest.json");

const INCLUDE_ITEMS = [
  "manifest.json",
  "background.js",
  "popup.js",
  "content.js",
  "options.js",
  "page-analyzer.js",
  "injected_script.js",
  "chat_ui.js",
  "popup.html",
  "options.html",
  "icon16.png",
  "icon48.png",
  "icon128.png",
  "core",
];

function parseArgs(argv) {
  const options = {
    date: null,
    build: null,
    version: null,
    outDir: null,
    updateManifestPath: null,
    dryRun: false,
    noZip: false,
    noUpdateManifest: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--date" && argv[i + 1]) {
      options.date = argv[++i];
      continue;
    }
    if (arg.startsWith("--date=")) {
      options.date = arg.split("=")[1];
      continue;
    }
    if (arg === "--build" && argv[i + 1]) {
      options.build = Number(argv[++i]);
      continue;
    }
    if (arg.startsWith("--build=")) {
      options.build = Number(arg.split("=")[1]);
      continue;
    }
    if (arg === "--version" && argv[i + 1]) {
      options.version = argv[++i];
      continue;
    }
    if (arg.startsWith("--version=")) {
      options.version = arg.split("=")[1];
      continue;
    }
    if ((arg === "--out" || arg === "--out-dir") && argv[i + 1]) {
      options.outDir = argv[++i];
      continue;
    }
    if (arg.startsWith("--out=")) {
      options.outDir = arg.split("=")[1];
      continue;
    }
    if (arg.startsWith("--out-dir=")) {
      options.outDir = arg.split("=")[1];
      continue;
    }
    if (arg === "--update-manifest" && argv[i + 1]) {
      options.updateManifestPath = argv[++i];
      continue;
    }
    if (arg.startsWith("--update-manifest=")) {
      options.updateManifestPath = arg.split("=")[1];
      continue;
    }
    if (arg === "--dry-run") options.dryRun = true;
    if (arg === "--no-zip") options.noZip = true;
    if (arg === "--no-update-manifest") options.noUpdateManifest = true;
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseDateParts(dateStr) {
  if (!dateStr) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }

  const normalized = String(dateStr).trim();
  const dashMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dashMatch) {
    return {
      year: Number(dashMatch[1]),
      month: Number(dashMatch[2]),
      day: Number(dashMatch[3]),
    };
  }

  const dotMatch = normalized.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (dotMatch) {
    return {
      year: Number(dotMatch[1]),
      month: Number(dotMatch[2]),
      day: Number(dotMatch[3]),
    };
  }

  throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD or YYYY.M.D`);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isValidVersion(version) {
  const parts = String(version || "").split(".");
  if (parts.length < 1 || parts.length > 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const num = Number(part);
    return Number.isInteger(num) && num >= 0 && num <= 65535;
  });
}

function computeNextVersion(currentVersion, options) {
  if (options.version) {
    if (!isValidVersion(options.version)) {
      throw new Error(`Invalid version: ${options.version}`);
    }
    return options.version;
  }

  const { year, month, day } = parseDateParts(options.date);
  const baseVersion = `${year}.${pad2(month)}.${pad2(day)}`;

  if (!isValidVersion(baseVersion)) {
    throw new Error(`Invalid base version: ${baseVersion}`);
  }

  const currentParts = String(currentVersion || "").split(".");
  const currentBase = currentParts.slice(0, 3).join(".");
  const sameDate = currentBase === baseVersion;

  if (options.build !== null && !Number.isInteger(options.build)) {
    throw new Error(`Invalid build number: ${options.build}`);
  }

  if (options.build !== null && options.build >= 0) {
    const nextVersion = `${baseVersion}.${options.build}`;
    if (!isValidVersion(nextVersion)) {
      throw new Error(`Invalid version: ${nextVersion}`);
    }
    return nextVersion;
  }

  if (sameDate) {
    const currentBuild = currentParts[3] ? Number(currentParts[3]) : 0;
    const nextBuild = Number.isNaN(currentBuild) ? 1 : currentBuild + 1;
    const nextVersion = `${baseVersion}.${nextBuild}`;
    if (!isValidVersion(nextVersion)) {
      throw new Error(`Invalid version: ${nextVersion}`);
    }
    return nextVersion;
  }

  return baseVersion;
}

function copyEntry(src, dest) {
  if (!fs.existsSync(src)) return false;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      if (entry === ".DS_Store") continue;
      copyEntry(path.join(src, entry), path.join(dest, entry));
    }
    return true;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

function buildZip(version, outDir) {
  ensureDir(outDir);

  const zipName = `chrome-extension_${version}.zip`;
  const zipPath = path.join(outDir, zipName);
  const tempDir = path.join(ROOT_DIR, ".tmp-release");
  const bundleDir = path.join(tempDir, "chrome-extension");

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  ensureDir(bundleDir);

  for (const item of INCLUDE_ITEMS) {
    const srcPath = path.join(ROOT_DIR, item);
    const destPath = path.join(bundleDir, item);
    copyEntry(srcPath, destPath);
  }

  const dittoCmd = `ditto -c -k --sequesterRsrc --keepParent "${bundleDir}" "${zipPath}"`;
  try {
    execSync(dittoCmd, { stdio: "inherit" });
  } catch (error) {
    const zipCmd = `cd "${tempDir}" && zip -r "${zipPath}" "chrome-extension"`;
    execSync(zipCmd, { stdio: "inherit" });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(`Zip created: ${zipPath}`);
}

function updateUpdateManifest(updateManifestPath, version) {
  if (!updateManifestPath || !fs.existsSync(updateManifestPath)) {
    console.warn(`WARN: update_manifest.xml not found at ${updateManifestPath}`);
    return;
  }

  const xml = fs.readFileSync(updateManifestPath, "utf-8");
  const updated = xml.replace(
    /(updatecheck[^>]*\\bversion=')([^']+)(')/,
    `$1${version}$3`
  );

  fs.writeFileSync(updateManifestPath, updated, "utf-8");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = readJson(MANIFEST_PATH);
  const currentVersion = manifest.version;
  const nextVersion = computeNextVersion(currentVersion, options);

  if (!isValidVersion(nextVersion)) {
    throw new Error(`Computed invalid version: ${nextVersion}`);
  }

  const outDir = options.outDir || (fs.existsSync(DEFAULT_OUT_DIR) ? DEFAULT_OUT_DIR : path.join(ROOT_DIR, "releases"));
  const updateManifestPath = options.updateManifestPath || path.join(outDir, "update_manifest.xml");

  console.log(`Current version: ${currentVersion}`);
  console.log(`Next version:    ${nextVersion}`);
  console.log(`Output dir:      ${outDir}`);
  console.log(`Update manifest: ${updateManifestPath}`);

  if (options.dryRun) return;

  manifest.version = nextVersion;
  writeJson(MANIFEST_PATH, manifest);

  if (!options.noZip) {
    buildZip(nextVersion, outDir);
  }

  if (!options.noUpdateManifest) {
    updateUpdateManifest(updateManifestPath, nextVersion);
  }

  const crxPath = path.join(outDir, "ai-assistant.crx");
  if (fs.existsSync(crxPath)) {
    console.warn("WARN: ai-assistant.crx not rebuilt. Update it if you publish CRX updates.");
  }

  console.log("Release completed.");
}

main();
