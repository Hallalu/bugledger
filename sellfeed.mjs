#!/usr/bin/env node
/*
 Sell feed CLI — capture a verified fact worth selling with, from any session, in one line; the scheduled run turns
 each new fact into a content pack (/sell) and marks it done.

   node ~/BugLedger/sellfeed.mjs add --fact "The CMA fined Wayfair £4.8m on 14 Oct 2026 for fake countdown deals" \
        --kind fine --source https://www.gov.uk/… --verified [--app Breadledger] [--date 2026-10-14] [--angle "how Breadledger helps"]
   node ~/BugLedger/sellfeed.mjs list [--status new|done|all] [--app Breadledger]
   node ~/BugLedger/sellfeed.mjs done <id> --pack pack.md [--link https://…]…

 kinds: fine · law · competitor · stat · news · customer · feature · brief (the owner's own creative idea, made as given). --verified only when the fact was checked on the
 primary source (the official page, the company's own announcement). Unverified signals are fine to add: the content
 run words them as "reported", never as fact. Uses the owner key in ~/.bugledger.json.
*/
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const argv = process.argv.slice(2), cmd = argv[0];
const flag = (n) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null; };
const all = (n) => argv.flatMap((a, i) => a === "--" + n && argv[i + 1] ? [argv[i + 1]] : []);
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".bugledger.json"), "utf8")); } catch {}
const BASE = (process.env.BUGLEDGER_BASE || cfg.base || "https://breadledger.coconvo.workers.dev").replace(/\/$/, "");
const KEY = process.env.BUGLEDGER_TOKEN || cfg.token || "";
const call = (p, body) => fetch(BASE + p, body ? { method: "POST", headers: { "content-type": "application/json", "x-ledger-key": KEY }, body: JSON.stringify(body) } : { headers: { "x-ledger-key": KEY } })
  .then((r) => r.json()).catch((e) => ({ ok: false, error: e.message }));

if (cmd === "add") {
  const r = await call("/api/sellfeed", { app: flag("app") || "Breadledger", kind: flag("kind"), fact: flag("fact"), source: flag("source"),
    verified: argv.includes("--verified"), date: flag("date"), angle: flag("angle") });
  console.log(r.ok ? (r.dup ? `= already in the sell feed (${r.id})` : `+ added to the sell feed (${r.id}) — the next content run turns it into posts`) : `sell feed: ${r.error}`);
} else if (cmd === "list") {
  const q = new URLSearchParams({ status: flag("status") || "new", ...(flag("app") ? { app: flag("app") } : {}) });
  const r = await call("/api/sellfeed?" + q);
  if (!r.ok) { console.error("sell feed:", r.error); process.exit(1); }
  if (argv.includes("--json")) { console.log(JSON.stringify(r.items, null, 2)); process.exit(0); }
  if (!r.items.length) console.log("Nothing new in the sell feed.");
  for (const x of r.items) console.log(`• ${x.id} [${x.kind}${x.verified ? " · verified" : " · reported"}] ${x.app} — ${x.fact}${x.source ? `\n    source: ${x.source}` : ""}${x.angle ? `\n    angle: ${x.angle}` : ""}`);
} else if (cmd === "done") {
  const id = argv[1], packFile = flag("pack");
  const pack = packFile ? fs.readFileSync(packFile, "utf8") : "";
  const r = await call(`/api/sellfeed/${id}/done`, { pack, links: all("link") });
  console.log(r.ok ? `✓ ${id} marked done` : `sell feed: ${r.error || "not found"}`);
} else {
  console.log("usage: sellfeed.mjs add --fact … --kind … --source … [--verified] | list [--status new] | done <id> --pack file --link url");
}
