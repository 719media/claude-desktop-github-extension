/**
 * package.mjs — builds and zips the extension into github-mcp-proxy.mcpb
 *
 * Usage:  node scripts/package.mjs
 * Output: github-mcp-proxy.mcpb  (ready to install in Claude Desktop)
 *
 * The .mcpb format is a standard zip archive containing:
 *   manifest.json
 *   server/index.js   (single-file esbuild bundle — no node_modules needed)
 */

import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");
const outFile = join(root, "github-mcp-proxy.mcpb");

// ── 1. Clean previous build ──────────────────────────────────────────────
if (existsSync(join(root, "server", "index.js"))) {
  rmSync(join(root, "server", "index.js"));
}
if (existsSync(outFile)) {
  rmSync(outFile);
}

// ── 2. Build ─────────────────────────────────────────────────────────────
console.log("Building...");
execSync("npm run build", { cwd: root, stdio: "inherit" });

if (!existsSync(join(root, "server", "index.js"))) {
  console.error("Build failed — server/index.js not found.");
  process.exit(1);
}

// ── 3. Zip ───────────────────────────────────────────────────────────────
console.log("Packaging...");
// Use the system zip tool (available on macOS/Linux).
// On Windows, use PowerShell's Compress-Archive or 7-zip.
execSync(
  `zip -r "${outFile}" manifest.json server/index.js`,
  { cwd: root, stdio: "inherit" }
);

console.log(`\n✅  Created: ${outFile}`);
console.log("Install via Claude Desktop → Settings → Extensions → Install Extension");
