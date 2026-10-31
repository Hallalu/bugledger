#!/usr/bin/env node
/*
 Breadledger — push to the site as soon as an upgrade is ready. A commit pushed to origin/main goes live by itself,
 from a clean copy of exactly that commit (never the working folder, which other sessions may have half-edited).

   node autodeploy.mjs            deploy origin/main if it is newer than what is live (fetches first)
   node autodeploy.mjs --dry      do every check, stop before the deploy
   node autodeploy.mjs --force    deploy origin/main even if it is already live
   node autodeploy.mjs --ref HEAD --dry   run every check on a local commit before pushing it
   node autodeploy.mjs install    the launchd watcher: runs this on every push, and every 5 min as a fallback
   node autodeploy.mjs uninstall

 Checks before anything ships: no conflict markers, every server file parses, the whole test suite passes.
 The deploy stamps the commit into bread-shell.js and build.json, so an open page notices the new build and
 offers "A newer Breadledger is ready · Refresh" (the same pattern as Hallalu CRM).
 State + log: ~/.breadboard/autodeploy/ (last.json, autodeploy.log).
*/
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const HOME = os.homedir(), REPO = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(HOME, ".breadboard", "autodeploy"), LOG = path.join(DIR, "autodeploy.log"), LAST = path.join(DIR, "last.json");
const LOCK = path.join(DIR, "lock"), LABEL = "com.hallalu.breadledger-autodeploy";
const PLIST = path.join(HOME, "Library", "LaunchAgents", LABEL + ".plist");
const argv = process.argv.slice(2), DRY = argv.includes("--dry"), FORCE = argv.includes("--force");
const REF = argv.includes("--ref") ? argv[argv.indexOf("--ref") + 1] : "origin/main";   // --ref HEAD --dry tests a local commit
fs.mkdirSync(DIR, { recursive: true });
process.env.PATH = ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin", process.env.PATH].join(":");

const log = (m) => { const l = `${new Date().toISOString()} ${m}`; fs.appendFileSync(LOG, l + "\n"); console.log(l); };
const sh = (c, o = {}) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...o }).trim();
const notify = (t) => { try { execSync(`osascript -e ${JSON.stringify(`display notification ${JSON.stringify(t)} with title "Breadledger"`)}`); } catch {} };

if (argv[0] === "install" || argv[0] === "uninstall") {
  try { execSync(`launchctl unload ${JSON.stringify(PLIST)}`, { stdio: "ignore" }); } catch {}
  if (argv[0] === "uninstall") { try { fs.unlinkSync(PLIST); } catch {} console.log("Auto-deploy watcher removed."); process.exit(0); }
  const git = path.join(REPO, ".git");
  fs.writeFileSync(PLIST, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>${process.execPath}</string><string>${path.join(REPO, "autodeploy.mjs")}</string></array>
  <key>WatchPaths</key><array><string>${path.join(git, "refs", "remotes", "origin")}</string><string>${path.join(git, "packed-refs")}</string></array>
  <key>StartInterval</key><integer>300</integer>
  <key>ThrottleInterval</key><integer>20</integer>
  <key>StandardOutPath</key><string>${path.join(DIR, "launchd.out.log")}</string>
  <key>StandardErrorPath</key><string>${path.join(DIR, "launchd.err.log")}</string>
  <key>ProcessType</key><string>Background</string>
</dict></plist>
`);
  execSync(`launchctl load ${JSON.stringify(PLIST)}`);
  console.log(`Auto-deploy watcher on: every push to main goes live by itself. Log: ${LOG}`);
  process.exit(0);
}

// one deploy at a time; a lock older than 15 min is a crashed run
try { fs.mkdirSync(LOCK); } catch {
  if (Date.now() - fs.statSync(LOCK).mtimeMs < 15 * 60e3) process.exit(0);
  fs.rmSync(LOCK, { recursive: true, force: true }); fs.mkdirSync(LOCK);
}
let work = "";
function run() {
  try { sh("git fetch -q origin main", { cwd: REPO, timeout: 60e3 }); } catch (e) { log("fetch failed, using the local origin/main: " + String(e.message).split("\n")[0]); }
  const sha = sh(`git rev-parse ${REF}`, { cwd: REPO }), short = sha.slice(0, 7);
  const last = (() => { try { return JSON.parse(fs.readFileSync(LAST, "utf8")); } catch { return {}; } })();
  if (last.sha === sha && !FORCE) return;
  if (last.failed === sha && !FORCE && !DRY) return;   // a commit that failed its checks waits for the next push
  const subject = sh(`git log -1 --format=%s ${sha}`, { cwd: REPO });
  log(`${short} "${subject}" — checking`);

  work = fs.mkdtempSync(path.join(DIR, "build-"));
  execSync(`git archive ${sha} | tar -x -C ${JSON.stringify(work)}`, { cwd: REPO, shell: "/bin/zsh" });
  fs.symlinkSync(path.join(REPO, "node_modules"), path.join(work, "node_modules"));

  const fail = (why) => { log(`${short} NOT deployed — ${why}`); if (!DRY) fs.writeFileSync(LAST, JSON.stringify({ ...last, failed: sha, failedWhy: why, failedAt: new Date().toISOString() }, null, 2)); notify(`Not deployed: ${why}`); throw Object.assign(new Error(why), { quiet: true }); };
  try { const m = sh(`grep -rlE '^(<<<<<<<|>>>>>>>) ' src public || true`, { cwd: work }); if (m) fail("conflict markers in " + m.split("\n").join(", ")); } catch (e) { if (e.quiet) throw e; }
  for (const f of fs.readdirSync(path.join(work, "src")).filter((f) => /\.(m?js)$/.test(f))) {
    try { sh(`node --check ${JSON.stringify(path.join(work, "src", f))}`); } catch (e) { fail(`src/${f} does not parse`); }
  }
  try { sh("npm test --silent", { cwd: work, timeout: 180e3 }); } catch (e) { fail("tests failed: " + (String(e.stdout || "").match(/# fail \d+/) || ["see log"])[0]); }

  // stamp the build so open pages can tell a newer one is live
  const build = { build: short, sha, subject, at: new Date().toISOString() };
  const shell = path.join(work, "public", "bread-shell.js"), src = fs.readFileSync(shell, "utf8");
  if (!src.includes("var BUILD = 'dev';")) fail("bread-shell.js has no BUILD stamp line");
  fs.writeFileSync(shell, src.replace("var BUILD = 'dev';", `var BUILD = '${short}';`));
  fs.writeFileSync(path.join(work, "public", "build.json"), JSON.stringify(build));

  if (DRY) { log(`${short} passed every check (dry run, not deployed)`); return; }
  const out = sh("npx wrangler@4.28.1 deploy", { cwd: work, timeout: 300e3 });
  const ver = (out.match(/Current Version ID: ([\w-]+)/) || [])[1] || "";
  fs.writeFileSync(LAST, JSON.stringify({ ...build, version: ver }, null, 2));
  log(`${short} LIVE${ver ? " (version " + ver.slice(0, 8) + ")" : ""} — "${subject}"`);
  notify(`Live: ${subject}`);
}
try { run(); } catch (e) {
  if (!e.quiet) { log("error: " + String(e.stderr || e.message).split("\n").slice(0, 3).join(" | ")); notify("Auto-deploy hit an error — see the log"); }
  process.exitCode = 1;
} finally {
  if (work) fs.rmSync(work, { recursive: true, force: true });
  fs.rmSync(LOCK, { recursive: true, force: true });
}
