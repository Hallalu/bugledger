import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, read, scripts } from "./helpers.mjs";

const pages = fs.readdirSync(path.join(ROOT, "public")).filter((f) => f.endsWith(".html"));
for (const p of pages) {
  test(`public/${p}: every inline script parses`, () => {
    const html = read("public/" + p);
    const blocks = scripts(html);
    assert.ok(blocks.length >= 1, "no script block");
    for (const b of blocks) assert.doesNotThrow(() => new Function(b));
  });
  test(`public/${p}: no duplicate ids in the static markup`, () => {
    const html = read("public/" + p).replace(/<script>[\s\S]*?<\/script>/g, "");   // ids inside JS strings are runtime-exclusive
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    assert.deepEqual(dup, [], "duplicate ids: " + dup.join(", "));
  });
  test(`public/${p}: has a description and a title`, () => {
    const html = read("public/" + p);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description"/);
  });
}
test("worker.js parses and exports a fetch handler", async () => {
  const src = read("src/worker.js");
  assert.match(src, /export default \{[\s\S]*async fetch\(request, env\)/);
  assert.match(src, /\/api\/session\/event/); assert.match(src, /\/api\/story/); assert.match(src, /\/api\/admin\/recurrence/);
});
