import { test } from "node:test";
import assert from "node:assert/strict";
import { publicCheck, publicEvent, publicSubmitted, publicRollup, publicSession, publicCard } from "../src/private-findings.mjs";

const SECRET = "SECRET-FINDING";
const hasSecret = (o) => JSON.stringify(o).includes(SECRET);

test("a found event keeps its severity and loses everything it says", () => {
  const e = publicEvent({ kind: "found", severity: "high", title: SECRET, detail: SECRET, impact: SECRET, fix: SECRET, file: SECRET, ref: SECRET, before: SECRET, after: SECRET, meta: { x: SECRET } });
  assert.equal(hasSecret(e), false);
  assert.equal(e.severity, "high");
});
test("a phase keeps its name", () => assert.equal(publicEvent({ kind: "phase", title: "Security" }).title, "Security"));
test("a check keeps counts only", () => {
  const c = publicCheck({ foundCount: 3, found: [SECRET], notFound: [SECRET], securityChecked: [SECRET], securityFindings: [SECRET], notes: SECRET, coverage: { pct: 100, missed: [SECRET], evidence: SECRET } });
  assert.equal(hasSecret(c), false);
  assert.equal(c.foundCount, 3);
  assert.equal(c.coverage.pct, 100);
});
test("a submitted finding says nothing", () => assert.equal(hasSecret(publicSubmitted({ severity: "high", title: SECRET, symptom: SECRET, fix: SECRET, file: SECRET, shots: [SECRET] })), false));
test("a rollup keeps counts, not metrics or verdict", () => {
  const r = publicRollup({ findings: 2, metrics: [{ label: SECRET }], verdict: SECRET });
  assert.equal(hasSecret(r), false);
  assert.equal(r.findings, 2);
});
test("a session keeps progress, not what it is doing", () => {
  const s = publicSession({ title: "Scan", done: 1, total: 2, current: SECRET, tasks: [{ text: SECRET }], note: SECRET, progress: { done: 1, total: 2, label: SECRET } });
  assert.equal(hasSecret(s), false);
  assert.equal(s.progress.total, 2);
});
test("a board card hides story, actions, features, shots and asks", () => {
  const c = publicCard({ title: "Scan", findings: 4, current: SECRET, tasks: [], note: "", story: [SECRET], acts: [SECRET], features: [SECRET], shots: [SECRET], you: { text: SECRET } });
  assert.equal(hasSecret(c), false);
  assert.equal(c.findings, 4);
});
