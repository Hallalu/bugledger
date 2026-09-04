import { test } from "node:test";
import assert from "node:assert/strict";
import { read, scripts, slice } from "./helpers.mjs";

// The Scan history lineage: histRow renders a prior scan (linked to its own story) or the current one.
const js = scripts(read("public/report.html")).join("\n");
const fnSrc =
  "var SEVORDER=['critical','high','medium','low','info'];" +
  "var SEV={critical:{ic:'C',lbl:'Critical'},high:{ic:'H',lbl:'High'},medium:{ic:'M',lbl:'Medium'},low:{ic:'L',lbl:'Low'},info:{ic:'I',lbl:'Info'}};" +
  "function esc(s){return String(s==null?'':s);}" +
  "function shortts(t){return 'TS';}" +
  slice(js, "function histRow(h,isCurrent)", "function findCard");
const { histRow } = new Function(fnSrc + "; return { histRow };")();

test("a prior scan links to its own full story", () => {
  const h = { id: "sess-123", started: 1, title: "Deep scan", status: "done",
    rollup: { real: 3, bySev: { high: 1, medium: 2 }, byStatus: { fixed: 2, open: 1 } } };
  const row = histRow(h, false);
  assert.match(row, /href="\/story\/sess-123"/);      // each earlier scan is one click from its full story
  assert.match(row, /open story →/);
  assert.match(row, /2 fixed/);
  assert.match(row, /1 open/);
  assert.match(row, /⚠/);                              // 1 open → warn, not clean
});

test("the current scan is marked, not linked away", () => {
  const cur = { id: "self", started: 1, title: "This run", status: "done", verdict: "Clean",
    rollup: { real: 0, bySev: {}, byStatus: {} } };
  const row = histRow(cur, true);
  assert.doesNotMatch(row, /href=/);                   // you're already reading it
  assert.match(row, /this scan/);
  assert.match(row, /you’re here/);
  assert.match(row, /✓ /);                             // real:0, done → clean/ok
});

test("a live prior scan reads as in-progress, never clean", () => {
  const row = histRow({ id: "x", started: 1, title: "Live", status: "live",
    rollup: { real: 0, bySev: {}, byStatus: {} } }, false);
  assert.match(row, /live/);
  assert.match(row, /⚠/);                              // in progress is not a clean verdict
});
