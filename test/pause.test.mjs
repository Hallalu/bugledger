import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// the pause button finds each card by its footer class, so a redesign of the Now page that renames it would lose the
// button with no error: it did once (card-f became bx-foot)
test("the Now page still has the card footer the pause button looks for", () => {
  const foot = /data-cards="\.([\w-]+)"/.exec(fs.readFileSync("src/pause.mjs", "utf8"))[1];
  const now = fs.readFileSync("public/now.html", "utf8");
  assert.ok(now.includes(`class="${foot}"`), `now.html has no class="${foot}"`);
  assert.ok(/class="state /.test(now), "now.html has no state badge to mark as paused");
  assert.ok(now.includes('data-go="'), "now.html has no summary rows to mark as paused");
});
