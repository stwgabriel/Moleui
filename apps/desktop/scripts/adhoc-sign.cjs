// electron-builder afterPack hook: ad-hoc sign the macOS app bundle.
//
// With `mac.identity: null`, electron-builder SKIPS code signing entirely, which
// leaves the app with only the linker's bare ad-hoc signature on the main binary
// (no sealed resources). macOS rejects that on Apple Silicon — `codesign --verify
// --strict` fails and the app launches as "damaged". A proper recursive ad-hoc
// sign (`codesign --deep --force --sign -`) re-signs every nested helper/framework
// and seals resources, producing a valid signature that runs on any arm64 Mac
// once the quarantine flag is cleared — with no paid Apple Developer account.
//
// afterPack runs after the bundle is built and before the (skipped) signing step
// and dmg/zip packaging, so the artifacts ship the properly signed app.

const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);

  console.log(`[adhoc-sign] ad-hoc signing ${appPath}`);
  // --deep: sign nested Electron helpers + frameworks. No hardened runtime
  // (--options runtime) — that is only needed for notarization and would add
  // restrictions for no benefit on a free ad-hoc build.
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath], { stdio: "inherit" });
  // Fail the build loudly if the signature is not valid, rather than shipping a
  // "damaged" app.
  execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], { stdio: "inherit" });
  console.log("[adhoc-sign] valid ad-hoc signature confirmed");
};
