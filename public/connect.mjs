#!/usr/bin/env node
/*
 Breadledger — connect this computer's Claude Code to your board. You get this as one line from
 "Connect Claude Code" on breadledger; it carries your agent key, so there is nothing else to type.

   node connect.mjs <your agent key> [site]

 It keeps everything in ~/.breadledger (your key is saved there, readable by you only), installs the chat reporter
 into Claude Code's hooks (your settings are backed up first; `node ~/.breadledger/chathook.mjs uninstall` removes it),
 then puts the chats you have open on your board. Only short descriptions of what each chat does, its plan and your
 own prompts are sent — to your private board, which only you can see.
*/
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const [key, site = "https://breadledger.coconvo.workers.dev"] = process.argv.slice(2);
const base = site.replace(/\/$/, "");
const fail = (m) => { console.error("\n✗ " + m + "\n"); process.exit(1); };
if (!/^blk_[a-f0-9]{40}$/.test(key || "")) fail("That isn't a Breadledger agent key. Copy the whole line again from Connect Claude Code.");
if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) fail("That site address doesn't look right.");

const dir = path.join(os.homedir(), ".breadledger");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

// 1. the key reaches Breadledger and belongs to a signed-in account
console.log("Checking your key…");
const probe = await fetch(base + "/api/now?probe=1", { headers: { "x-ledger-key": key } }).then((r) => r.json()).catch(() => null);
if (!probe || !probe.owner) fail("Breadledger didn't accept that key. Make a new line from Connect Claude Code and try again.");

// 2. the chat reporter, from the same site
console.log("Fetching the chat reporter…");
const res = await fetch(base + "/chathook.mjs");
if (!res.ok) fail("Couldn't download the chat reporter (" + res.status + "). Try again in a minute.");
fs.writeFileSync(path.join(dir, "chathook.mjs"), await res.text());
fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ base, token: key }, null, 2) + "\n", { mode: 0o600 });
fs.chmodSync(path.join(dir, "config.json"), 0o600);

// 3. Claude Code reports every chat from now on, then the chats already open go up
const env = process.env;
execFileSync(process.execPath, [path.join(dir, "chathook.mjs"), "install"], { stdio: "inherit", env });
console.log("Putting the chats you have open on your board…");
try { execFileSync(process.execPath, [path.join(dir, "chathook.mjs"), "scan", "--mins", "120"], { stdio: "ignore", env, timeout: 120000 }); } catch {}

console.log(`\n✓ Connected. Every Claude Code chat on this computer now shows on your board:\n  ${base}/now\n`);
