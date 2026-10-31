import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, read } from "./helpers.mjs";
import { scrubSecrets, extractPrompts, userText, isRelayed, isBuiltin, resolveProject, folderProject } from "../public/journal.mjs";
import { scrubSecrets as serverScrub } from "../src/journal.mjs";

const line = (o) => JSON.stringify(o) + "\n";
const fixture = () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bl-journal-")), "sess.jsonl");
  const px = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  fs.writeFileSync(f,
    line({ type: "user", uuid: "u1", timestamp: "2026-10-31T10:00:00.000Z", cwd: "/Users/x/BugLedger", sessionId: "s1", gitBranch: "main", message: { role: "user", content: "Kindly   build  the thing\n\nwith two   spaces and a trailing newline\n" } }) +
    line({ type: "user", uuid: "u2", timestamp: "2026-10-31T10:00:30.000Z", isMeta: true, message: { role: "user", content: "Base directory for this skill: …" } }) +
    line({ type: "user", uuid: "u3", timestamp: "2026-10-31T10:01:00.000Z", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "ok" }] } }) +
    line({ type: "attachment", uuid: "a1", timestamp: "2026-10-31T10:02:00.000Z", attachment: { type: "queued_command", prompt: "also make it blue", commandMode: "prompt", origin: { kind: "human" }, timestamp: "2026-10-31T10:01:50.000Z" } }) +
    line({ type: "attachment", uuid: "a2", timestamp: "2026-10-31T10:02:10.000Z", attachment: { type: "queued_command", prompt: "" } }) +
    line({ type: "user", uuid: "u4", timestamp: "2026-10-31T10:03:00.000Z", message: { role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: px } }] } }) +
    line({ type: "user", uuid: "u5", timestamp: "2026-10-31T10:03:05.000Z", message: { role: "user", content: [{ type: "text", text: "here is the screenshot, fix the gap" }, { type: "image", source: { type: "base64", media_type: "image/png", data: px } }] } }) +
    line({ type: "user", uuid: "u6", timestamp: "2026-10-31T10:04:00.000Z", message: { role: "user", content: "<command-name>/perfectly</command-name><command-args>the footer</command-args>" } }) +
    line({ type: "user", uuid: "u7", timestamp: "2026-10-31T10:04:30.000Z", message: { role: "user", content: "<command-name>/clear</command-name>" } }) +
    line({ type: "user", uuid: "u8", timestamp: "2026-10-31T10:05:00.000Z", message: { role: "user", content: "<task-notification>agent finished</task-notification>" } }) +
    line({ type: "user", uuid: "u9", timestamp: "2026-10-31T10:05:30.000Z", message: { role: "user", content: "This session is being continued from a previous conversation…" } }) +
    line({ type: "user", uuid: "u10", timestamp: "2026-10-31T10:06:00.000Z", isSidechain: true, message: { role: "user", content: "subagent brief, not the owner" } }) +
    line({ type: "user", uuid: "u11", timestamp: "2026-10-31T10:07:00.000Z", message: { role: "user", content: "continue" } }) +
    line({ type: "user", uuid: "u12", timestamp: "2026-10-31T10:08:00.000Z", message: { role: "user", content: "continue" } }) +
    line({ type: "user", uuid: "u13", timestamp: "2026-10-31T10:09:00.000Z", message: { role: "user", content: "fix it <system-reminder>harness text</system-reminder>" } }) +
    line({ type: "user", uuid: "u14", timestamp: "2026-10-31T10:10:00.000Z", message: { role: "user", content: "<cross-session-message from=\"local_x\">hello from another session</cross-session-message>" } }) +
    line({ type: "user", uuid: "u15", timestamp: "2026-10-31T10:11:00.000Z", message: { role: "user", content: "Task (from the session that started this one):\nBackground (from the session that started this one): do X" } }) +
    line({ type: "user", uuid: "u16", timestamp: "2026-10-31T10:12:00.000Z", message: { role: "user", content: "<pasted_content id=\"1\">the owner pasted this</pasted_content> make it so" } }) +
    line({ type: "user", uuid: "u17", timestamp: "2026-10-31T10:13:00.000Z", message: { role: "user", content: "Background (from the session that started this one):\nThe owner asked: do Y" } }) +
    "not json\n");
  return f;
};

test("extractPrompts keeps every human prompt, in order, exactly as typed", async () => {
  const { prompts, meta } = await extractPrompts(fixture());
  assert.deepEqual(prompts.map((p) => p.uuid), ["u1", "a1", "u5", "u6", "u11", "u12", "u13", "u16"], "another session's message and brief are skipped; the owner's own paste is kept");
  assert.equal(prompts[0].text, "Kindly   build  the thing\n\nwith two   spaces and a trailing newline\n", "inner spacing and the trailing newline survive");
  assert.equal(prompts[1].kind, "mid-turn"); assert.equal(prompts[1].time, "2026-10-31T10:01:50.000Z");
  assert.equal(prompts[2].imageCount, 2, "an image-only turn is folded into the next prompt"); assert.equal(prompts[2].images.length, 2);
  assert.equal(prompts[3].text, "/perfectly the footer"); assert.equal(prompts[3].kind, "command");
  assert.equal(prompts[4].text, "continue"); assert.equal(prompts[5].text, "continue", "a repeated prompt is NOT dropped");
  assert.equal(prompts[6].text, "fix it", "harness reminders are not the owner's words");
  assert.deepEqual(prompts.map((p) => p.n), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(meta.cwd, "/Users/x/BugLedger"); assert.equal(meta.sessionId, "s1"); assert.equal(meta.branch, "main");
  assert.equal(prompts[0].cwd, "/Users/x/BugLedger", "each prompt remembers the folder it was typed in"); assert.equal(prompts[1].cwd, null);
  assert.equal(meta.dominantCwd, "/Users/x/BugLedger", "the folder the session mostly worked in");
});
test("relayed notices, app commands and compaction summaries are not prompts", () => {
  assert.ok(isRelayed("<agent-message>…")); assert.ok(isRelayed("[Request interrupted by user]")); assert.ok(!isRelayed("Kindly add <b>bold</b>"));
  assert.ok(isRelayed("Background (from the session that started this one):\nx") && isRelayed("Task (from the session that started this one):\nx"), "another session's brief is not a prompt");
  assert.ok(!isRelayed("kindly continue from the session that started this one"), "the owner mentioning it mid-sentence is still a prompt");
  assert.ok(isBuiltin("/clear")); assert.ok(isBuiltin(" /model ")); assert.ok(!isBuiltin("/perfectly the footer")); assert.ok(!isBuiltin("/deploy"));
  assert.deepEqual(userText("<command-name>/x</command-name><command-args>  a b  </command-args>"), { text: "/x a b", kind: "command", images: [] });
});
test("scrubSecrets removes only secret shapes, counts them, and leaves ordinary words byte-identical (client and server agree)", () => {
  const plain = "Kindly set the token in ~/.bugledger.json and keep the password field; x-ledger-key: $KEY — 'localtest' is fine. 日本語 🙂  double  space\n";
  for (const fn of [scrubSecrets, serverScrub]) {
    assert.equal(fn(plain).text, plain); assert.equal(fn(plain).n, 0);
    const s = fn("key sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 and ghp_abcdefghijklmnopqrstuvwxyz0123456789 password: Hunter2abc!9 token=blk_" + "a".repeat(40));
    assert.equal(s.n, 4, s.text); assert.ok(!/sk-ant|ghp_|Hunter2|blk_a/.test(s.text)); assert.match(s.text, /password: \[secret removed\]/);
  }
});
test("folderProject: longest rule wins, dot-folders and home are nothing, an unknown folder keeps its name", () => {
  const home = os.homedir(), map = { _about: "x", foo: { app: "Foo" }, "foo/bar": { app: "Bar", project: "foo-bar" } };
  assert.deepEqual(folderProject(home + "/foo/x/y", map), { project: "foo", app: "Foo", via: "folder-map" });
  assert.deepEqual(folderProject(home + "/foo/bar/baz", map), { project: "foo-bar", app: "Bar", via: "folder-map" });
  assert.equal(folderProject(home, map), null); assert.equal(folderProject(home + "/.claude/projects/x", map), null); assert.equal(folderProject("/tmp/elsewhere", map), null);
  assert.deepEqual(folderProject(home + "/zz-no-such-folder-9f3/deep", {}), { project: "zz-no-such-folder-9f3", app: null, via: "cwd" });
});
test("resolveProject prefers the session's Aprizely board, else the folder the prompt was typed in, else where the session mostly worked, never the bare home path", () => {
  const home = os.homedir();
  assert.deepEqual(resolveProject("no-such-session", home), { project: "home", app: null, via: "cwd" });
  assert.equal(resolveProject("no-such-session", home, { lineCwd: home + "/zz-no-such-folder-9f3" }).project, "zz-no-such-folder-9f3", "the prompt's own folder");
  assert.equal(resolveProject("no-such-session", home, { lineCwd: home, dominantCwd: home + "/zz-other-folder-9f3/sub" }).project, "zz-other-folder-9f3", "typed from ~, but the session worked in a project");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bl-proj-")); fs.writeFileSync(path.join(dir, ".aprizely.worklog.json"), JSON.stringify({ id: "x", app: "Bug Ledger", project: "BugLedger" }));
  assert.deepEqual(resolveProject(null, dir), { project: "BugLedger", app: "Bug Ledger", via: "board" });
});
test("journal.mjs: help exits 0, unknown command exits 1, hook with junk stdin exits 0 and prints nothing", () => {
  const cli = path.join(ROOT, "public", "journal.mjs");
  assert.equal(spawnSync("node", [cli, "help"], { encoding: "utf8" }).status, 0);
  assert.equal(spawnSync("node", [cli, "nope"], { encoding: "utf8" }).status, 1);
  const h = spawnSync("node", [cli, "hook"], { encoding: "utf8", input: "{not json" }); assert.equal(h.status, 0); assert.equal(h.stdout, "");
  const h2 = spawnSync("node", [cli, "hook"], { encoding: "utf8", input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "<task-notification>x</task-notification>", session_id: "t" }) }); assert.equal(h2.status, 0); assert.equal(h2.stdout, "");
});
test("worker: journal routes are wired, owner-gated, and the page is noindex", () => {
  const w = read("src/worker.js"), j = read("src/journal.mjs"), html = read("public/journal.html");
  assert.match(w, /handleJournal\(request, env, url\)/);
  for (const r of ["/api/journal", "/api/journal/photo", "/api/journal/refile", "/api/journal/img/", "/journal"]) assert.ok(j.includes(`"${r}"`) || j.includes(`'${r}'`) || j.includes(r), r);
  assert.match(j, /unauthorized — the prompt journal is private/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.ok(!/style-src[^;]*fonts\.googleapis/.test(read("public/_headers")) && !/fonts\.googleapis/.test(html), "the page must not load external fonts (CSP forbids them)");
  const sql = read("schema-journal.sql");
  for (const t of ["journal_no_update", "journal_no_delete", "journal_photos_no_update", "journal_photos_no_delete", "journal_refile_no_update", "journal_refile_no_delete", "journal_pairs_no_update", "journal_pairs_no_delete"]) assert.ok(sql.includes(t), t);
  assert.ok(!/photos\.slice\(0, ?\d+\)/.test(j) && !/images\.slice\(0, ?\d+\)/.test(read("public/journal.mjs")), "no invented cap on pasted pictures");
  assert.match(j, /journal_pairs/, "a transcript message pairs with one hook row and the pairing is recorded");
});
