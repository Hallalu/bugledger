import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./helpers.mjs";

const run = (args, cwd) => spawnSync("node", [path.join(ROOT, "worklog.mjs"), ...args], { encoding: "utf8", cwd });
test("worklog.mjs with no command prints usage and exits 0", () => {
  const r = run([], os.tmpdir());
  assert.equal(r.status, 0); assert.match(r.stdout, /usage: worklog\.mjs/); assert.match(r.stdout, /found "…" --sev/);
});
test("story commands refuse to run without a session and say why", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bl-wl-"));
  for (const cmd of [["say", "x"], ["found", "x"], ["verdict", "x"], ["story"]]) {
    const r = run(cmd, dir);
    assert.equal(r.status, 1, cmd[0]); assert.match(r.stderr, /no \.\/\.worklog\.json/);
  }
});
test("worklog.mjs documents every story command in its header", () => {
  const src = fs.readFileSync(path.join(ROOT, "worklog.mjs"), "utf8");
  for (const c of ["phase", "say", "found", "fixed", "clean", "metric", "caveat", "verdict", "story", "id", "events"]) assert.match(src, new RegExp("worklog\\.mjs " + c + "\\b"), c);
});
