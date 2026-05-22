import { chmod, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appDir, "..", "..");
const runtimeDir = path.join(appDir, ".mole-runtime");

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function copyRuntimeFile(relativePath) {
  await cp(
    path.join(repoRoot, relativePath),
    path.join(runtimeDir, relativePath),
    { recursive: true },
  );
}

await rm(runtimeDir, { recursive: true, force: true });
await mkdir(path.join(runtimeDir, "bin"), { recursive: true });
await mkdir(path.join(runtimeDir, "lib"), { recursive: true });

// Copy main mole script
await copyRuntimeFile("mole");

// Copy bin scripts
await copyRuntimeFile("bin/clean.sh");
await copyRuntimeFile("bin/status.sh");
await copyRuntimeFile("bin/uninstall.sh");
await copyRuntimeFile("bin/optimize.sh");
await copyRuntimeFile("bin/analyze.sh");
await copyRuntimeFile("bin/purge.sh");
await copyRuntimeFile("bin/installer.sh");
await copyRuntimeFile("bin/config.sh");
await copyRuntimeFile("bin/touchid.sh");
await copyRuntimeFile("bin/completion.sh");

// Copy lib directories
await copyRuntimeFile("lib/core");
await copyRuntimeFile("lib/clean");
await copyRuntimeFile("lib/ui");
await copyRuntimeFile("lib/uninstall");
await copyRuntimeFile("lib/manage");
await copyRuntimeFile("lib/optimize");
await copyRuntimeFile("lib/check");

// Build Go binaries
await run("go", ["build", "-o", path.join(runtimeDir, "bin", "status-go"), "./cmd/status"], repoRoot);
await run("go", ["build", "-o", path.join(runtimeDir, "bin", "analyze-go"), "./cmd/analyze"], repoRoot);

// Set executable permissions
await chmod(path.join(runtimeDir, "mole"), 0o755);
await chmod(path.join(runtimeDir, "bin", "clean.sh"), 0o755);
await chmod(path.join(runtimeDir, "bin", "status.sh"), 0o755);
await chmod(path.join(runtimeDir, "bin", "uninstall.sh"), 0o755);
await chmod(path.join(runtimeDir, "bin", "optimize.sh"), 0o755);
await chmod(path.join(runtimeDir, "bin", "analyze.sh"), 0o755);
await chmod(path.join(runtimeDir, "bin", "purge.sh"), 0o755);
await chmod(path.join(runtimeDir, "bin", "installer.sh"), 0o755);
await chmod(path.join(runtimeDir, "bin", "config.sh"), 0o755);
await chmod(path.join(runtimeDir, "bin", "touchid.sh"), 0o755);
await chmod(path.join(runtimeDir, "bin", "completion.sh"), 0o755);
await chmod(path.join(runtimeDir, "bin", "status-go"), 0o755);
await chmod(path.join(runtimeDir, "bin", "analyze-go"), 0o755);
