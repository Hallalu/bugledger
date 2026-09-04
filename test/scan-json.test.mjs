import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./helpers.mjs";

// The contract every /deepscan depends on: with --json, stdout is ONE JSON document — nothing before, nothing after.
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bl-fixture-"));
  fs.writeFileSync(path.join(dir, "index.html"), `<!doctype html><html><head><title>t</title></head><body>
<input placeholder="unlabelled"><div onclick="x()">click</div><script>try{a()}catch{}</script></body></html>`);
  fs.writeFileSync(path.join(dir, "app.js"), `const d = new Date().toISOString().slice(0,10); localStorage.setItem("token", t);\nel.innerHTML = "<b>" + req.body.name + "</b>";`);
  return dir;
}
test("scan.mjs --json prints exactly one JSON document to stdout", () => {
  const dir = fixture();
  const out = execFileSync("node", [path.join(ROOT, "scan.mjs"), dir, "--json", "--app", "Fixture"], { encoding: "utf8" });
  const j = JSON.parse(out);                       // throws if anything trails or precedes the document
  assert.equal(j.app, "Fixture");
  assert.ok(Array.isArray(j.findings) && j.findings.length > 0, "the fixture should trip at least one detector");
  assert.ok(j.byCategory && typeof j.byCategory === "object");
});
test("scan.mjs --json --story keeps stdout pure even when there is no session (hook reports on stderr)", () => {
  const dir = fixture();
  const r = spawnSync("node", [path.join(ROOT, "scan.mjs"), dir, "--json", "--story", "--app", "Fixture"], { encoding: "utf8" });
  assert.doesNotThrow(() => JSON.parse(r.stdout));
  assert.match(r.stderr, /--story: no \.\/\.worklog\.json/);
});
test("scan.mjs findings carry confidence and the fixture's known classes", () => {
  const dir = fixture();
  const j = JSON.parse(execFileSync("node", [path.join(ROOT, "scan.mjs"), dir, "--json", "--app", "Fixture"], { encoding: "utf8" }));
  const dets = new Set(j.findings.map((f) => f.detector));
  for (const d of ["A11Y-INPUT-NOLABEL", "A11Y-CLICK-NONINTERACTIVE", "XSS-INNERHTML", "DATE-TOISO"]) assert.ok(dets.has(d), "expected " + d);
  assert.ok(j.findings.every((f) => f.confidence === "high" || f.confidence === "review"));
});
