import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./helpers.mjs";

// The 11 QA bug types: every new detector must fire on a planted example AND stay quiet on the correct version.
const scan = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bl-qa11-"));
  for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), c); }
  return JSON.parse(execFileSync("node", [path.join(ROOT, "scan.mjs"), dir, "--json", "--app", "QA11"], { encoding: "utf8" }));
};
const ids = (j) => new Set(j.findings.map((f) => f.detector));

const BAD = {
  "public/index.html": `<!doctype html><html lang="en"><head><title>t</title><meta name="viewport" content="width=device-width"><style>
.tiny{font-size:10px} .hero{height:100vh} .bar{backdrop-filter:blur(8px)}</style></head><body>
<a href="/settingz">Settings</a><a href="/other">Other</a><button onclick="saveEverything()">Save</button>
<label for="n">Name</label><input id="n" type="text"><textarea id="t" aria-label="notes"></textarea>
<script>var a = {;</script><script src="/app.js"></script></body></html>`,
  "public/other.html": `<!doctype html><html lang="en"><head><title>o</title></head><body>o</body></html>`,
  "public/app.js": `if (total === NaN) show();
if (typeof list === "array") go();
items.forEach(async (it) => { await save(it); });
if (user = admin) grant();
fetch("/api/report").then((r) => r.json());
fetch("/api/profilez").then((r) => r.json());
for (let i = 0; i <= rows.length; i++) draw(rows[i]);
const last = rows[rows.length];
setInterval(tick, 16);
const x = new XMLHttpRequest(); x.open("GET", "/api/report", false);
async function all(urls) { for (const u of urls) { await fetch(u); } }
history.pushState({}, "", "/view");
document.getElementById("nothing-has-this-id").textContent = "hi";
`,
  "data.json": `{ "a": 1, }`,
  "broken.mjs": `export function f( { return 1 }\n`,
  "conflict.js": `const a = 1;\n<<<<<<< HEAD\nconst b = 2;\n=======\nconst b = 3;\n>>>>>>> branch\n`,
  "src/worker.js": `export default { async fetch(request) { const { pathname } = new URL(request.url);
  if (pathname === "/api/report") return new Response("{}"); return new Response("nf", { status: 404 }); } };\n`,
};
const GOOD = {
  "public/index.html": `<!doctype html><html lang="en"><head><title>t</title><meta name="viewport" content="width=device-width"><style>
.body{font-size:15px} .hero{min-height:100vh;min-height:100dvh} .bar{-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}</style></head><body>
<a href="/other">Other</a><button onclick="saveEverything()">Save</button>
<label for="n">Name</label><input id="n" type="text" maxlength="80"><input type="checkbox" aria-label="ok">
<script>var a = { b: 1 };</script><script src="/app.js"></script></body></html>`,
  "public/other.html": `<!doctype html><html lang="en"><head><title>o</title></head><body>o</body></html>`,
  "public/app.js": `function saveEverything() {}
if (Number.isNaN(total)) show();
if (Array.isArray(list)) go();
for (const it of items) await save(it);
if (user === admin) grant();
fetch("/api/report").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
for (let i = 0; i < rows.length; i++) draw(rows[i]);
const last = rows[rows.length - 1];
setInterval(tick, 1000);
history.pushState({}, "", "/view"); addEventListener("popstate", render);
document.getElementById("n").focus();
`,
  "data.json": `{ "a": 1 }`,
  "ok.mjs": `export function f() { return 1; }\n`,
  "src/worker.js": `export default { async fetch(request) { const { pathname } = new URL(request.url);
  if (pathname === "/api/report") return new Response("{}"); return new Response("nf", { status: 404 }); } };\n`,
};
const NEW = ["SYNTAX-JS", "SYNTAX-JSON", "SYNTAX-INLINE-SCRIPT", "SYNTAX-CONFLICT", "LOGIC-NAN-COMPARE", "LOGIC-TYPEOF-TYPO",
  "LOGIC-ASYNC-FOREACH", "LOGIC-ASSIGN-IN-IF", "FUNC-MISSING-ID", "FUNC-UNDEFINED-HANDLER", "INTEG-DEAD-ROUTE",
  "INTEG-NO-RES-OK", "USAB-TINY-TEXT", "WORKFLOW-NO-POPSTATE", "WORKFLOW-DEAD-LINK", "COMPAT-100VH", "COMPAT-BACKDROP-NO-WEBKIT",
  "PERF-SYNC-XHR", "PERF-AWAIT-IN-LOOP", "PERF-TIGHT-INTERVAL", "BOUND-LE-LENGTH", "BOUND-ARRAY-LAST", "BOUND-INPUT-NO-MAX"];

test("every new QA-type detector fires on its planted bug", () => {
  const got = ids(scan(BAD));
  const missing = NEW.filter((d) => !got.has(d));
  assert.deepEqual(missing, [], "did not fire: " + missing.join(", "));
});
test("none of the new QA-type detectors fire on the correct code", () => {
  const got = ids(scan(GOOD));
  const wrong = NEW.filter((d) => got.has(d));
  assert.deepEqual(wrong, [], "false alarms: " + wrong.join(", "));
});
test("the dead-route check names the missing route and leaves the real one alone", () => {
  const routes = scan(BAD).findings.filter((f) => f.detector === "INTEG-DEAD-ROUTE").map((f) => f.excerpt).join(" ");
  assert.match(routes, /\/api\/profilez/);
  assert.doesNotMatch(routes, /\/api\/report/);
});
test("every scan reports all 11 QA bug types, each with at least one check", () => {
  const q = scan(GOOD).qa11;
  assert.deepEqual(q.map((x) => x.type), ["Syntax", "Logical", "Functional", "Unit-level", "System integration", "Usability",
    "Workflow", "Compatibility", "Performance", "Security", "Out-of-bound"]);
  for (const x of q) assert.ok(x.checks > 0, x.type + " has no checks");
});
