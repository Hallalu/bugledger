#!/usr/bin/env node
/* switch-host.mjs — move THIS Mac's pointers from the old ledger host to the new one (or back with --back).
   Run only AFTER the new worker is live with its secret: the script first checks that the new host answers
   /api/sessions, and changes nothing if it does not.
   Touches: ~/.bugledger.json (its `base`) and the Claude hooks / commands / skills that quote the host.
   Prints every change; never prints the token.      --dry shows what would change. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const OLD = "bugledger.coconvo.workers.dev";
const NEW = "breadledger.coconvo.workers.dev";
const back = process.argv.includes("--back");
const dry = process.argv.includes("--dry");
const [from, to] = back ? [NEW, OLD] : [OLD, NEW];
const H = os.homedir();
const show = (f) => f.startsWith(H) ? "~" + f.slice(H.length) : f;

const FILES = [
  ".claude/hooks/bugledger-journal.mjs",                  // Prompt Journal hook (fallback host)
  ".claude/convo-sync/post_ledger.mjs",                   // hard-coded host
  ".claude/convo-sync/apz_update.mjs",                    // live URL in the Aprizely sync
  ...["showwork", "aiscan", "fullscan", "bugcheck", "securitysweep", "deepscan", "optimise"].map((c) => `.claude/commands/${c}.md`),
  ".claude/skills/deploy/SKILL.md",
  ".claude/skills/deploy/references/ship-checklist.md",
  ".claude/skills/sell/references/sell-playbook.md",
  ".claude/skills/sellpost/references/sell-playbook.md",
  ".claude/CLAUDE.md",                                    // the owner's global rules quote the host
].map((f) => path.join(H, f));

if (!back && !dry) {
  const r = await fetch(`https://${to}/api/sessions?limit=1`).catch(() => null);
  if (!r || !r.ok) {
    console.error(`✘ https://${to}/api/sessions is not answering (${r ? r.status : "no response"}) — deploy the new worker first. Nothing changed.`);
    process.exit(1);
  }
}

let changed = 0;
const cfgPath = path.join(H, ".bugledger.json");
try {
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const want = `https://${to}`;
  if (cfg.base !== want) {
    if (!dry) fs.writeFileSync(cfgPath, JSON.stringify({ ...cfg, base: want }, null, 2) + "\n", { mode: 0o600 });
    changed++;
    console.log(`✓ ~/.bugledger.json  base → ${want}`);
  } else console.log(`· ~/.bugledger.json  already ${want}`);
} catch (e) {
  console.log(`· ~/.bugledger.json  not readable (${e.message}) — skipped`);
}

for (const f of FILES) {
  let s;
  try { s = fs.readFileSync(f, "utf8"); } catch { console.log(`· missing  ${show(f)}`); continue; }
  const n = s.split(from).length - 1;
  if (!n) continue;
  if (!dry) fs.writeFileSync(f, s.split(from).join(to));
  changed++;
  console.log(`✓ ${show(f)}  ${n} × ${from} → ${to}`);
}
console.log(`${dry ? "(dry run) " : ""}${changed} file(s) ${back ? "restored to" : "moved to"} https://${to}`);
