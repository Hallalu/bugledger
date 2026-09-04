import { test } from "node:test";
import assert from "node:assert/strict";
import { read, scripts, slice } from "./helpers.mjs";

// The story renderer's core: a later "fixed" event resolves an earlier "found" WITHOUT editing it.
const js = scripts(read("public/report.html")).join("\n");
const fnSrc = "var norm=" + slice(js, "function norm(t)", "\n") + ";" + slice(js, "function resolveFindings(events)", "function pct(");
const { resolveFindings } = new Function(fnSrc + "; return { resolveFindings };")();

test("a fixed event by ref changes the status of the found it references", () => {
  const ev = [
    { id: "a", kind: "found", title: "Labels not linked", status: "open", ts: 1 },
    { id: "b", kind: "found", title: "No CSP", status: "open", ts: 2 },
    { id: "c", kind: "fixed", ref: "a", title: "Labels not linked", status: "fixed", fix: "for= added", ts: 3 },
  ];
  const f = resolveFindings(ev);
  assert.equal(f.length, 2);
  assert.equal(f.find((x) => x.id === "a").status, "fixed");
  assert.equal(f.find((x) => x.id === "a").fix, "for= added");
  assert.equal(f.find((x) => x.id === "b").status, "open");
});
test("a fixed event by title (no ref) still resolves, and false-positive is a valid resolution", () => {
  const ev = [
    { id: "a", kind: "found", title: "NO-CSP ×5", status: "open", ts: 1 },
    { id: "c", kind: "fixed", title: "no-csp ×5", status: "false-positive", fix: "header-level CSP", ts: 3 },
  ];
  const f = resolveFindings(ev);
  assert.equal(f[0].status, "false-positive");
});
test("the original found events are not mutated", () => {
  const found = { id: "a", kind: "found", title: "X", status: "open", ts: 1 };
  resolveFindings([found, { id: "c", kind: "fixed", ref: "a", title: "X", status: "fixed", ts: 2 }]);
  assert.equal(found.status, "open");
});
