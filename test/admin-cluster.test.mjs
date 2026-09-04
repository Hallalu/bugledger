import { test } from "node:test";
import assert from "node:assert/strict";
import { read, scripts, slice } from "./helpers.mjs";

const js = scripts(read("public/admin.html")).join("\n");
const src = "var SEVR={critical:0,high:1,medium:2,low:3,info:4};" + slice(js, "// ---------- clustering ----------", "var F={")
  .replace(/window\.__DATA=\{d:d,classes:classes,appMap:appMap\};[\s\S]*?render\(\);\n  \}/, "return {classes:classes,appMap:appMap};}");
const { build, cluster } = new Function("window", src + "; return { build, cluster };")({});
const inst = (o) => Object.assign({ source: "check", app: "A", title: "t", ts: 1 }, o);

test("same detector id → one class across apps", () => {
  const r = build({ instances: [inst({ app: "Abba", title: "No CSP found", detector: "NO-CSP" }), inst({ app: "Kindly", title: "Content-Security-Policy missing", detector: "NO-CSP" })], analyses: [], counts: { instances: 2 } });
  assert.equal(r.classes.length, 1); assert.equal(r.classes[0].nApps, 2);
});
test("fuzzy titles merge; unrelated titles stay apart", () => {
  const r = build({ instances: [
    inst({ app: "Abba", title: "Empty catch block swallows the error" }), inst({ app: "Kindly", title: "Empty catch blocks swallow errors" }),
    inst({ app: "Abba", title: "Service worker serves a stale build" }) ], analyses: [], counts: { instances: 3 } });
  assert.equal(r.classes.length, 2);
  assert.equal(r.classes.find((c) => /catch/i.test(c.title)).nApps, 2);
});
test("titles made of prototype words do not crash the clustering", () => {
  assert.doesNotThrow(() => cluster([inst({ title: "constructor toString __proto__ hasOwnProperty" }), inst({ title: "constructor valueOf prototype" })]));
});
test("app names are canonicalised across spelling variants", () => {
  const r = build({ instances: [inst({ app: "Bug Ledger", title: "X one" }), inst({ app: "bugledger", title: "Y two" }), inst({ app: "BugLedger", title: "Z three" })], analyses: [], counts: { instances: 3 } });
  assert.deepEqual([...new Set(r.classes.map((c) => Object.keys(c.apps)[0]))], ["Bug Ledger"]);
});
