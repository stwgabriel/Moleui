// electron-builder afterPack step: give the bundle a full set of switchable,
// theming-compatible app icons.
//
// macOS 26 (Tahoe) renders the dark / clear / tinted icon appearances from a
// compiled asset catalog — an app cannot produce those at runtime. Every icon
// the user can pick in Settings therefore ships pre-compiled in Assets.car:
// build/AppIcon.icon is the primary and each build/AppIcon-*.icon an alternate.
// Switching is done by rewriting CFBundleIconName / CFBundleIconFile in the
// installed bundle (see applyBundleAppIcon in main.mjs), so this step also
// generates a legacy .icns per variant for pre-Tahoe systems.
//
// actool ships with full Xcode (26+), not the Command Line Tools. When it is
// missing the step still produces the per-variant .icns files (icon switching
// keeps working, minus the Tahoe appearances) and logs a notice.
//
// Keep the variant list in sync with APP_ICONS in main.mjs.

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PRIMARY_ICON = "AppIcon";
const ICONS = [
  { asset: "AppIcon", basePng: "public/assets/base/molui-purple.png" },
  { asset: "AppIcon-Midnight", basePng: "public/assets/base/molui-midnight.png" },
  { asset: "AppIcon-Cream", basePng: "public/assets/base/molui-light.png" },
  { asset: "AppIcon-Porcelain", basePng: "public/assets/base/molui-white.png" },
];
const ICNS_SIZES = [16, 32, 128, 256, 512];

function findActool() {
  try {
    return execFileSync("xcrun", ["--find", "actool"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// Build <asset>.icns from the flattened squircle PNG so pre-Tahoe systems can
// display every variant via CFBundleIconFile.
function buildIcns(basePng, icnsPath, tmpRoot) {
  const iconset = path.join(tmpRoot, `${path.basename(icnsPath, ".icns")}.iconset`);
  fs.mkdirSync(iconset, { recursive: true });
  for (const size of ICNS_SIZES) {
    execFileSync("sips", ["-z", String(size), String(size), basePng, "--out", path.join(iconset, `icon_${size}x${size}.png`)], { stdio: "ignore" });
    const retina = size * 2;
    execFileSync("sips", ["-z", String(retina), String(retina), basePng, "--out", path.join(iconset, `icon_${size}x${size}@2x.png`)], { stdio: "ignore" });
  }
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", icnsPath], { stdio: "inherit" });
}

exports.default = async function embedAppIcon(context) {
  if (context.electronPlatformName !== "darwin") return;

  const projectDir = context.packager.projectDir;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const resourcesDir = path.join(context.appOutDir, appName, "Contents", "Resources");
  const infoPlist = path.join(context.appOutDir, appName, "Contents", "Info.plist");

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moleui-appicon-"));
  try {
    for (const icon of ICONS) {
      const basePng = path.join(projectDir, icon.basePng);
      if (!fs.existsSync(basePng)) {
        throw new Error(`missing icon source ${basePng}`);
      }
      buildIcns(basePng, path.join(resourcesDir, `${icon.asset}.icns`), tmpRoot);
    }
    execFileSync("plutil", ["-replace", "CFBundleIconFile", "-string", `${PRIMARY_ICON}.icns`, infoPlist]);
    console.log(`[appicon] generated ${ICONS.length} fallback .icns variants`);

    if (!findActool()) {
      console.log("[appicon] actool unavailable (full Xcode 26+ required); skipping Assets.car (no Tahoe appearances)");
      return;
    }

    const carPath = path.join(resourcesDir, "Assets.car");
    if (fs.existsSync(carPath)) {
      // Electron does not ship an Assets.car today; refuse to clobber one if
      // that ever changes rather than silently merging incompatible catalogs.
      console.warn("[appicon] Assets.car already present in bundle, skipping icon embed");
      return;
    }

    const iconInputs = [];
    const alternateFlags = [];
    for (const icon of ICONS) {
      const bundle = path.join(projectDir, "build", `${icon.asset}.icon`);
      if (!fs.existsSync(bundle)) {
        throw new Error(`missing icon bundle ${bundle}`);
      }
      iconInputs.push(bundle);
      if (icon.asset !== PRIMARY_ICON) {
        alternateFlags.push("--alternate-app-icon", icon.asset);
      }
    }

    const outDir = path.join(tmpRoot, "actool-out");
    fs.mkdirSync(outDir);
    execFileSync(
      "xcrun",
      [
        "actool",
        ...iconInputs,
        "--compile", outDir,
        "--output-format", "human-readable-text",
        "--notices", "--warnings", "--errors",
        "--output-partial-info-plist", path.join(outDir, "partial.plist"),
        "--app-icon", PRIMARY_ICON,
        ...alternateFlags,
        "--include-all-app-icons",
        "--enable-on-demand-resources", "NO",
        "--development-region", "en",
        "--target-device", "mac",
        "--minimum-deployment-target", "26.0",
        "--platform", "macosx",
      ],
      { stdio: "inherit" },
    );

    const compiledCar = path.join(outDir, "Assets.car");
    if (!fs.existsSync(compiledCar)) {
      throw new Error("actool completed without producing Assets.car");
    }
    fs.copyFileSync(compiledCar, carPath);
    execFileSync("plutil", ["-replace", "CFBundleIconName", "-string", PRIMARY_ICON, infoPlist]);
    console.log("[appicon] embedded Assets.car with dark/clear/tinted appearances for all icon variants");
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
};
