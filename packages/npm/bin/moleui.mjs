#!/usr/bin/env node

// Moleui Desktop — npm launcher
// Downloads the correct DMG for the current architecture from GitHub Releases,
// mounts it, copies the app to /Applications, then launches it.

import { existsSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { arch, platform, tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const pkgPath = join(__filename, "..", "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const VERSION = pkg.version;
const DESKTOP_VERSION = pkg.moleuiDesktopVersion || VERSION;

const APP_NAME = "Moleui Desktop.app";
const APP_PATH = `/Applications/${APP_NAME}`;

function fatal(msg) {
  console.error(`\x1b[31m✗\x1b[0m ${msg}`);
  process.exit(1);
}

function info(msg) {
  console.log(`\x1b[34m●\x1b[0m ${msg}`);
}

function success(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}

if (platform() !== "darwin") {
  fatal("Moleui Desktop is only available on macOS.");
}

function getArch() {
  const a = arch();
  if (a === "arm64") return "arm64";
  if (a === "x64") return "x64";
  fatal(`Unsupported architecture: ${a}`);
}

function getDmgUrl() {
  const a = getArch();
  return `https://github.com/stwgabriel/moleui/releases/download/V${VERSION}/Moleui.Desktop-${DESKTOP_VERSION}-${a}.dmg`;
}

function isInstalled() {
  return existsSync(APP_PATH);
}

function getInstalledVersion() {
  const plistPath = join(APP_PATH, "Contents", "Info.plist");
  if (!existsSync(plistPath)) return null;
  try {
    const out = execSync(
      `/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${plistPath}"`,
      { encoding: "utf8" },
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

function launchApp() {
  info("Launching Moleui Desktop...");
  spawn("open", ["-a", APP_PATH], { detached: true, stdio: "ignore" }).unref();
}

async function downloadAndInstall() {
  const url = getDmgUrl();
  const dmgPath = join(tmpdir(), `MoleuiDesktop-${DESKTOP_VERSION}-${getArch()}.dmg`);
  const mountPoint = join(tmpdir(), "moleui-dmg-mount");

  info(`Downloading Moleui Desktop v${DESKTOP_VERSION} (${getArch()})...`);

  try {
    execSync(`curl -fsSL --connect-timeout 15 --max-time 120 -o "${dmgPath}" "${url}"`, {
      stdio: "inherit",
    });
  } catch {
    fatal(
      `Failed to download from ${url}\nCheck https://github.com/stwgabriel/moleui/releases for available versions.`,
    );
  }

  info("Installing to /Applications...");

  try {
    // Mount DMG silently
    execSync(`hdiutil attach "${dmgPath}" -nobrowse -mountpoint "${mountPoint}"`, {
      stdio: "pipe",
    });

    // Copy app (replace existing)
    execSync(`rm -rf "${APP_PATH}"`, { stdio: "pipe" });
    execSync(`cp -R "${mountPoint}/${APP_NAME}" "${APP_PATH}"`, { stdio: "pipe" });

    // Clear quarantine
    execSync(`xattr -cr "${APP_PATH}"`, { stdio: "pipe" });

    success(`Installed Moleui Desktop v${DESKTOP_VERSION} to /Applications`);
  } catch (err) {
    fatal(`Installation failed: ${err.message}`);
  } finally {
    // Unmount and clean up
    try {
      execSync(`hdiutil detach "${mountPoint}" -quiet`, { stdio: "pipe" });
    } catch {
      // Ignore unmount errors
    }
    try {
      execSync(`rm -f "${dmgPath}"`, { stdio: "pipe" });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

if (command === "--help" || command === "-h") {
  console.log(`
Moleui Desktop v${VERSION}
Deep clean and optimize your Mac.

Usage:
  moleui              Launch the desktop app (install if needed)
  moleui install      Download and install the desktop app
  moleui --version    Show version
  moleui --help       Show this help

More info: https://github.com/stwgabriel/moleui
`);
  process.exit(0);
}

if (command === "--version" || command === "-v") {
  console.log(VERSION);
  process.exit(0);
}

if (command === "install") {
  await downloadAndInstall();
  process.exit(0);
}

// Default: launch (install if needed)
const installedVersion = getInstalledVersion();

if (!isInstalled()) {
  info("Moleui Desktop is not installed. Installing...");
  await downloadAndInstall();
  launchApp();
} else if (installedVersion && installedVersion !== DESKTOP_VERSION) {
  info(`Updating Moleui Desktop from v${installedVersion} to v${DESKTOP_VERSION}...`);
  await downloadAndInstall();
  launchApp();
} else {
  launchApp();
}
