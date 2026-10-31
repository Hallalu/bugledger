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
test("worklog.mjs documents the Now board: waves, step notes, features and board shots", () => {
  const src = fs.readFileSync(path.join(ROOT, "worklog.mjs"), "utf8");
  for (const c of ["#Wave", "::", "--desc", "worklog.mjs feature", "--stage before", "/now/"]) assert.ok(src.includes(c), c);
  const r = run([], os.tmpdir());
  assert.match(r.stdout, /feature "…"/);
});
test("feature refuses to run without a session", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bl-wl-"));
  const r = run(["feature", "x"], dir);
  assert.equal(r.status, 1); assert.match(r.stderr, /no \.\/\.worklog\.json/);
});
test("breadhook.mjs stays silent with no board, and never leaks paths or keys", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bl-hook-"));
  const r = spawnSync("node", [path.join(ROOT, "breadhook.mjs")], { cwd: dir, encoding: "utf8", env: { ...process.env, HOME: dir },
    input: JSON.stringify({ session_id: "x", cwd: dir, tool_name: "Read", tool_input: { file_path: "/Users/a/b.js" } }) });
  assert.equal(r.status, 0); assert.equal(r.stdout, "");
  const src = fs.readFileSync(path.join(ROOT, "breadhook.mjs"), "utf8");
  assert.match(src, /const scrub/); assert.match(src, /\[key\]/);
});
