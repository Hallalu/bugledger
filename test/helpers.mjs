import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
export const scripts = (html) => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
// pull a named function (or a run of functions) out of a page's inline script by start/end markers
export const slice = (src, start, end) => { const a = src.indexOf(start), b = src.indexOf(end, a + 1); if (a < 0 || b < 0) throw new Error("marker missing: " + start); return src.slice(a, b); };
