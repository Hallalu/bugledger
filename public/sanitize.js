/*!
 * Bug Ledger — Text Sanitizer core engine  (v1)
 * ------------------------------------------------------------------------
 * One dependency-free module that detects and cleans hidden / AI-inserted /
 * steganographic Unicode from essays, code and any pasted text. It is the
 * SINGLE SOURCE OF TRUTH shared by:
 *   • the /sanitize page (browser, window.Sanitize)
 *   • the ledger API      (Cloudflare Worker, import)
 *   • the code scanner    (scan.mjs, require via createRequire)
 *
 * Design law — grounded in verified research, NOT assumption:
 *   1. DETECTION is safe; DELETION is the dangerous act. Default to a preview
 *      that lists every finding (name · U+XXXX · count · plain-English risk).
 *   2. PROTECT emoji + multilingual text by default. ZWJ builds emoji
 *      (👨‍👩‍👧), ZWNJ is *required* in Persian/Arabic/Indic, VS16 makes emoji
 *      render in colour, bidi marks lay out RTL. Blindly stripping these
 *      silently CORRUPTS valid content — the cardinal failure mode.
 *   3. This is NOT an "AI-watermark remover." The only deployed LLM watermark
 *      (Google SynthID-Text) lives in token choice, not characters, and cannot
 *      be removed by stripping. We clean third-party hidden chars, prompt-
 *      injection / steganography payloads and formatting artefacts — honestly.
 *   4. Em-dash / curly quotes / ellipsis are NOT proof of AI (Twain out-dashes
 *      GPT; Word/Docs autocorrect them for everyone). They live in a separate
 *      "smart punctuation" pass that is OFF by default.
 *
 * Action model — every code point resolves to exactly one of:
 *   STRIP  (delete)   · NORMALIZE (→ ASCII space / newline / plain punctuation)
 *   FLAG   (report, never auto-change) · PRESERVE (protected, never touch)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Node / esbuild (CJS)
  if (root) root.Sanitize = api;                                          // browser global
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const hex = (cp) => cp.toString(16).toUpperCase().padStart(4, "0");
  const U = (cp) => "U+" + hex(cp);
  const inR = (cp, a, b) => cp >= a && cp <= b;

  // ---------------------------------------------------------------- script context
  // Emoji-ish: enough coverage to protect real emoji sequences (base ± joiner/VS).
  function isEmoji(cp) {
    return (
      inR(cp, 0x1f000, 0x1faff) || // pictographs, symbols, supplemental
      inR(cp, 0x2600, 0x27bf)  ||  // misc symbols + dingbats
      inR(cp, 0x2b00, 0x2bff)  ||  // arrows / stars
      inR(cp, 0x1f1e6, 0x1f1ff) || // regional indicators (flags)
      inR(cp, 0x2190, 0x21ff)  ||  // arrows
      cp === 0x2764 || cp === 0x2b50 || cp === 0x2705 || cp === 0x274c ||
      cp === 0x00a9 || cp === 0x00ae || cp === 0x2122 || cp === 0x203c ||
      cp === 0x2049 || inR(cp, 0x0023, 0x0039) /* keycap bases #,*,0-9 */ ||
      cp === 0xfe0f || cp === 0xfe0e
    );
  }
  // Scripts where ZWJ/ZWNJ change the rendered word (never blind-strip).
  function isJoiningScript(cp) {
    return (
      inR(cp, 0x0600, 0x06ff) || inR(cp, 0x0750, 0x077f) || // Arabic
      inR(cp, 0x08a0, 0x08ff) || inR(cp, 0xfb50, 0xfdff) || // Arabic ext / presentation
      inR(cp, 0xfe70, 0xfeff) ||                            // Arabic presentation-B
      inR(cp, 0x0900, 0x0dff) || // Devanagari … Malayalam (Indic block span)
      inR(cp, 0x0f00, 0x0fff) || // Tibetan
      inR(cp, 0x1000, 0x109f)    // Myanmar
    );
  }
  function isCJK(cp) {
    return (
      inR(cp, 0x3400, 0x4dbf) || inR(cp, 0x4e00, 0x9fff) ||
      inR(cp, 0xf900, 0xfaff) || inR(cp, 0x20000, 0x3ffff)
    );
  }
  const isAsciiLetter = (cp) => (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a);

  // Cyrillic / Greek look-alikes → their Latin twin (FLAG only, never auto-swap).
  const CONFUSABLE = {
    0x0410: "A", 0x0412: "B", 0x0415: "E", 0x041a: "K", 0x041c: "M", 0x041d: "H",
    0x041e: "O", 0x0420: "P", 0x0421: "C", 0x0422: "T", 0x0423: "Y", 0x0425: "X",
    0x0430: "a", 0x0435: "e", 0x043a: "k", 0x043e: "o", 0x0440: "p", 0x0441: "c",
    0x0443: "y", 0x0445: "x", 0x0456: "i", 0x0458: "j", 0x0405: "S", 0x0455: "s",
    0x0391: "A", 0x0392: "B", 0x0395: "E", 0x0396: "Z", 0x0397: "H", 0x0399: "I",
    0x039a: "K", 0x039c: "M", 0x039d: "N", 0x039f: "O", 0x03a1: "P", 0x03a4: "T",
    0x03a5: "Y", 0x03a7: "X", 0x03bf: "o", 0x03b1: "a", 0x0501: "d",
  };

  // ---------------------------------------------------------------- categories
  // group: "hidden" (invisible), "space" (looks-like-a-space), "security",
  //        "context" (depends on neighbours), "info" (flag only), "style" (opt-in).
  const CAT = {
    "zero-width":    { label: "Zero-width characters", group: "hidden",   action: "strip",     icon: "⌀",
      risk: "ZWSP / word-joiner — invisible, no role in prose or code; classic steganography carriers. Safe to remove." },
    "bom":           { label: "Byte-order mark (mid-text)", group: "hidden", action: "strip",  icon: "⌦",
      risk: "U+FEFF inside text breaks string compares, JSON and search. Safe to remove (a single leading BOM in a file is left alone)." },
    "tag":           { label: "Tag-block smuggling", group: "security",    action: "strip",     icon: "🏴",
      risk: "U+E0000–E007F encodes hidden ASCII invisibly — the #1 invisible-prompt-injection / exfiltration vector. Always removed." },
    "bidi-override": { label: "Bidi overrides (Trojan Source)", group: "security", action: "strip", icon: "⇄",
      risk: "RLO/LRO reorder what a human vs a compiler see — the Trojan-Source code-injection attack (CVE-2021-42574). Always removed." },
    "invisible-math":{ label: "Invisible math operators", group: "security", action: "strip",    icon: "∻",
      risk: "U+2061–2064 have no use in plain text and are an active covert binary channel. Safe to remove." },
    "invisible-blank":{ label: "Invisible blanks / fillers", group: "hidden", action: "strip",   icon: "␀",
      risk: "Mongolian vowel separator, Hangul fillers — render empty and imitate blanks. Safe to remove." },
    "annotation":    { label: "Annotation controls", group: "hidden",      action: "strip",     icon: "❰",
      risk: "U+FFF9–FFFB — Unicode marks these 'not for interchange'. Safe to remove." },
    "soft-hyphen":   { label: "Soft hyphens", group: "hidden",             action: "strip",     icon: "-",
      risk: "U+00AD is invisible unless a line breaks there; a classic paste artefact. Usually safe to remove." },
    "cgj":           { label: "Combining grapheme joiner", group: "hidden", action: "strip",    icon: "◌",
      risk: "U+034F is almost never intentional in pasted text; an obfuscation aid. Usually safe to remove." },
    "control":       { label: "Control characters", group: "hidden",       action: "strip",     icon: "␛",
      risk: "C0/C1 control codes (tab, newline and carriage-return are kept). No place in pasted text." },
    "exotic-space":  { label: "Look-alike spaces", group: "space",         action: "normalize", icon: "␣", to: " ",
      risk: "Non-breaking / narrow / en / em / ideographic spaces look normal but diff differently and stop wrapping. Normalised to a plain space." },
    "line-sep":      { label: "Line / paragraph separators", group: "space", action: "normalize", icon: "¶", to: "\n",
      risk: "U+2028 / U+2029 are invisible line breaks that confuse parsers. Normalised to a newline." },
    // --- context-aware (protected by default) ---
    "joiner":        { label: "Joiners (ZWJ / ZWNJ)", group: "context",    action: "flag",      icon: "🔗",
      risk: "REQUIRED in emoji (👨‍👩‍👧) and Persian/Arabic/Indic text. Protected when it sits in emoji or joining-script context; only flagged (never auto-stripped) when orphaned." },
    "variation-selector": { label: "Variation selectors", group: "context", action: "flag",     icon: "◈",
      risk: "VS16 makes emoji render in colour and VS-supplement selects CJK variants — kept after a valid base. Long invisible runs after a non-emoji base are flagged as smuggling." },
    "bidi-format":   { label: "Bidi formatting controls", group: "context", action: "flag",     icon: "↔",
      risk: "LRM/RLM/isolates legitimately lay out Arabic/Hebrew mixed with Latin. Kept in prose (flagged); stripped only in Code mode, where any bidi in source is a red flag." },
    // --- information only ---
    "replacement":   { label: "Replacement / object marks", group: "info", action: "flag",      icon: "⬚",
      risk: "U+FFFD / U+FFFC are evidence of an earlier decode error or a stripped embedded object — flagged, never silently deleted (that would hide data loss)." },
    "homoglyph":     { label: "Look-alike letters (homoglyphs)", group: "info", action: "flag", icon: "𝐚",
      risk: "Cyrillic/Greek letters posing as Latin inside a word (spoofing / Trojan identifiers). Flagged with the Latin look-alike — never auto-swapped, which could corrupt real multilingual text." },
    // --- opt-in cosmetic (OFF by default) ---
    "style":         { label: "Smart punctuation", group: "style",         action: "flag",      icon: "—",
      risk: "Em/en-dashes, curly quotes and the ellipsis character. These are valid human typography and NOT proof of AI — left as-is unless you turn on 'normalise smart punctuation'." },
  };

  // Named code points (for the audit list). Fallback is U+XXXX.
  const NAMES = {
    0x200b: "Zero-width space", 0x2060: "Word joiner", 0xfeff: "Zero-width no-break space / BOM",
    0x200c: "Zero-width non-joiner (ZWNJ)", 0x200d: "Zero-width joiner (ZWJ)",
    0x00ad: "Soft hyphen", 0x034f: "Combining grapheme joiner", 0x180e: "Mongolian vowel separator",
    0x3164: "Hangul filler", 0xffa0: "Halfwidth Hangul filler", 0x115f: "Hangul choseong filler", 0x1160: "Hangul jungseong filler",
    0x061c: "Arabic letter mark", 0x200e: "Left-to-right mark", 0x200f: "Right-to-left mark",
    0x202a: "Left-to-right embedding", 0x202b: "Right-to-left embedding", 0x202c: "Pop directional formatting",
    0x202d: "Left-to-right override", 0x202e: "Right-to-left override",
    0x2066: "Left-to-right isolate", 0x2067: "Right-to-left isolate", 0x2068: "First-strong isolate", 0x2069: "Pop directional isolate",
    0x2061: "Function application", 0x2062: "Invisible times", 0x2063: "Invisible separator", 0x2064: "Invisible plus",
    0xfff9: "Interlinear annotation anchor", 0xfffa: "Interlinear annotation separator", 0xfffb: "Interlinear annotation terminator",
    0xfffc: "Object replacement character", 0xfffd: "Replacement character",
    0x00a0: "No-break space", 0x202f: "Narrow no-break space", 0x2007: "Figure space", 0x2009: "Thin space", 0x200a: "Hair space",
    0x2002: "En space", 0x2003: "Em space", 0x3000: "Ideographic space", 0x205f: "Medium mathematical space", 0x1680: "Ogham space mark",
    0x2028: "Line separator", 0x2029: "Paragraph separator",
    0xfe0e: "Variation selector-15 (text)", 0xfe0f: "Variation selector-16 (emoji)",
    0x2013: "En dash", 0x2014: "Em dash", 0x2018: "Left single quote", 0x2019: "Right single quote",
    0x201c: "Left double quote", 0x201d: "Right double quote", 0x2026: "Horizontal ellipsis",
  };
  function nameOf(cp) {
    if (NAMES[cp]) return NAMES[cp];
    if (inR(cp, 0xe0000, 0xe007f)) return "Tag character " + U(cp);
    if (inR(cp, 0xfe00, 0xfe0d)) return "Variation selector " + U(cp);
    if (inR(cp, 0xe0100, 0xe01ef)) return "Variation selector supplement " + U(cp);
    if (CONFUSABLE[cp]) return "Look-alike of “" + CONFUSABLE[cp] + "”";
    return U(cp);
  }
  // Short chip label for the reveal-invisibles view.
  const CHIP = {
    0x200b: "ZWSP", 0x2060: "WJ", 0xfeff: "BOM", 0x200c: "ZWNJ", 0x200d: "ZWJ",
    0x00ad: "SHY", 0x034f: "CGJ", 0x061c: "ALM", 0x200e: "LRM", 0x200f: "RLM",
    0x202d: "LRO", 0x202e: "RLO", 0x202a: "LRE", 0x202b: "RLE", 0x202c: "PDF",
    0x2066: "LRI", 0x2067: "RLI", 0x2068: "FSI", 0x2069: "PDI",
    0x2061: "f()", 0x2062: "×", 0x2063: "sep", 0x2064: "+",
    0x00a0: "NBSP", 0x202f: "NNBSP", 0x2003: "EM-SP", 0x2002: "EN-SP", 0x2009: "THIN", 0x200a: "HAIR",
    0x3000: "IDSP", 0x205f: "MMSP", 0x2007: "FIG", 0x1680: "OGSP",
    0x2028: "LSEP", 0x2029: "PSEP", 0xfffd: "REPL", 0xfffc: "OBJ",
    0xfe0f: "VS16", 0xfe0e: "VS15", 0x180e: "MVS", 0x3164: "HFILL",
    0xfff9: "IAA", 0xfffa: "IAS", 0xfffb: "IAT",
  };
  function chipFor(cp) {
    if (CHIP[cp]) return CHIP[cp];
    if (inR(cp, 0xe0000, 0xe007f)) return "TAG";
    if (inR(cp, 0xfe00, 0xfe0d) || inR(cp, 0xe0100, 0xe01ef)) return "VS";
    if (CONFUSABLE[cp]) return CONFUSABLE[cp] + "?";
    return U(cp);
  }

  // ---------------------------------------------------------------- classify one code point
  // Returns a category id (string) or null when the code point is ordinary.
  function classify(cp) {
    if (cp === 0x200b || cp === 0x2060) return "zero-width";
    if (cp === 0xfeff) return "bom";
    if (cp === 0x200c || cp === 0x200d) return "joiner";
    if (inR(cp, 0xe0000, 0xe007f)) return "tag";
    if (cp === 0x202d || cp === 0x202e) return "bidi-override";
    if (cp === 0x061c || cp === 0x200e || cp === 0x200f ||
        inR(cp, 0x202a, 0x202c) || inR(cp, 0x2066, 0x2069) || inR(cp, 0x206a, 0x206f)) return "bidi-format";
    if (inR(cp, 0x2061, 0x2064)) return "invisible-math";
    if (cp === 0x00ad) return "soft-hyphen";
    if (cp === 0x034f) return "cgj";
    if (cp === 0x180e || cp === 0x3164 || cp === 0xffa0 || cp === 0x115f || cp === 0x1160 ||
        cp === 0x17b4 || cp === 0x17b5) return "invisible-blank";
    if (inR(cp, 0xfff9, 0xfffb)) return "annotation";
    if (cp === 0xfffc || cp === 0xfffd) return "replacement";
    if (inR(cp, 0xfe00, 0xfe0f) || inR(cp, 0xe0100, 0xe01ef)) return "variation-selector";
    // look-alike spaces (Zs) + ogham + line/para separators
    if (cp === 0x00a0 || cp === 0x1680 || inR(cp, 0x2000, 0x200a) ||
        cp === 0x202f || cp === 0x205f || cp === 0x3000) return "exotic-space";
    if (cp === 0x2028 || cp === 0x2029) return "line-sep";
    // C0/C1 controls, keeping tab (09), newline (0A), carriage-return (0D)
    if ((cp <= 0x08) || cp === 0x0b || cp === 0x0c || inR(cp, 0x0e, 0x1f) || inR(cp, 0x7f, 0x9f)) return "control";
    // smart punctuation (opt-in cosmetic)
    if (cp === 0x2013 || cp === 0x2014 || cp === 0x2018 || cp === 0x2019 ||
        cp === 0x201c || cp === 0x201d || cp === 0x2026) return "style";
    if (CONFUSABLE[cp]) return "homoglyph";
    return null;
  }

  const STYLE_MAP = { 0x2013: "-", 0x2014: "--", 0x2018: "'", 0x2019: "'", 0x201c: '"', 0x201d: '"', 0x2026: "..." };

  // Default option set. `enabled` decides which categories actually clean;
  // context categories decide per-occurrence.
  function defaults() {
    return {
      preset: "safe",
      codeMode: false,
      stripOrphanJoiners: false, // orphan ZWJ/ZWNJ (not emoji/multilingual) — flag by default
      normalizeSpaces: true,     // exotic-space + line-sep
      smartPunct: false,         // style category → normalize
      flagHomoglyphs: true,
      // category on/off (the strip/normalize workhorses)
      enabled: {
        "zero-width": true, "bom": true, "tag": true, "bidi-override": true,
        "invisible-math": true, "invisible-blank": true, "annotation": true,
        "soft-hyphen": true, "cgj": true, "control": true,
      },
    };
  }
  const PRESETS = {
    safe:      (o) => o,
    minimal:   (o) => Object.assign(o, {
      normalizeSpaces: false, stripOrphanJoiners: false, smartPunct: false,
      enabled: Object.assign(o.enabled, { "soft-hyphen": false, "cgj": false, "invisible-blank": false, "annotation": false }),
    }),
    aggressive:(o) => Object.assign(o, { normalizeSpaces: true, stripOrphanJoiners: true, smartPunct: true }),
    code:      (o) => Object.assign(o, { codeMode: true, normalizeSpaces: true, smartPunct: false }),
  };
  function withPreset(options) {
    const o = defaults();
    if (options && options.preset && PRESETS[options.preset]) { o.preset = options.preset; PRESETS[options.preset](o); }
    if (options) {
      for (const k of ["codeMode", "stripOrphanJoiners", "normalizeSpaces", "smartPunct", "flagHomoglyphs"])
        if (k in options) o[k] = options[k];
      if (options.enabled) Object.assign(o.enabled, options.enabled);
    }
    return o;
  }

  // Resolve the effective action for one finding given context + options.
  // → "strip" | "normalize" | "flag" | "preserve"
  function resolveAction(cat, cp, prev, next, o) {
    switch (cat) {
      case "joiner": {
        const emojiCtx = isEmoji(prev) || isEmoji(next);
        const scriptCtx = isJoiningScript(prev) || isJoiningScript(next);
        if (emojiCtx || scriptCtx) return "preserve";      // required — never touch
        return o.stripOrphanJoiners ? "strip" : "flag";     // orphaned
      }
      case "variation-selector": {
        if (cp === 0xfe0f || cp === 0xfe0e) return isEmoji(prev) ? "preserve" : (o.stripOrphanJoiners ? "strip" : "flag");
        if (isCJK(prev)) return "preserve";                 // legit IVD variant
        return o.stripOrphanJoiners ? "strip" : "flag";     // run/orphan after non-CJK = smuggling
      }
      case "bidi-format":
        if (inR(cp, 0x206a, 0x206f)) return "strip";        // deprecated shaping controls
        return o.codeMode ? "strip" : "flag";               // prose keeps + flags; code strips
      case "exotic-space":
      case "line-sep":
        return o.normalizeSpaces ? "normalize" : "flag";
      case "style":
        return o.smartPunct ? "normalize" : "flag";
      case "homoglyph": {
        const mixed = isAsciiLetter(prev) || isAsciiLetter(next);
        return (o.flagHomoglyphs && mixed) ? "flag" : (mixed ? "flag" : "preserve");
      }
      case "replacement":
        return "flag";                                      // never silently delete
      default:
        return (CAT[cat] && CAT[cat].action === "strip" && o.enabled[cat]) ? "strip" : "flag";
    }
  }

  // ---------------------------------------------------------------- main
  // analyze(text, options) → { findings, categories, stats } (no mutation)
  // sanitizeText(text, options) → { cleaned, findings, categories, stats }
  function run(text, options, mutate) {
    text = text == null ? "" : String(text);
    const o = withPreset(options);
    const out = [];               // cleaned pieces
    const findings = [];          // per-occurrence
    const byCat = new Map();       // id -> { action counts, samples, count }
    const cps = [];
    for (let k = 0; k < text.length; ) {
      const cp = text.codePointAt(k);
      const len = cp > 0xffff ? 2 : 1;
      cps.push({ cp, i: k, len });
      k += len;
    }
    for (let j = 0; j < cps.length; j++) {
      const { cp, i } = cps[j];
      const cat = classify(cp);
      if (cat === null) { if (mutate) out.push(String.fromCodePoint(cp)); continue; }
      // a leading BOM at offset 0 is a legitimate file marker — leave it.
      if (cat === "bom" && i === 0) { if (mutate) out.push(String.fromCodePoint(cp)); continue; }
      const prev = j > 0 ? cps[j - 1].cp : 0;
      const next = j + 1 < cps.length ? cps[j + 1].cp : 0;
      const action = resolveAction(cat, cp, prev, next, o);
      // record
      const f = { index: i, cp, hex: U(cp), name: nameOf(cp), chip: chipFor(cp), category: cat, action };
      if (cat === "homoglyph") f.suggest = CONFUSABLE[cp];
      findings.push(f);
      let rec = byCat.get(cat);
      if (!rec) { rec = { id: cat, count: 0, strip: 0, normalize: 0, flag: 0, preserve: 0, cps: new Set(), meta: CAT[cat] }; byCat.set(cat, rec); }
      rec.count++; rec[action]++; if (rec.cps.size < 12) rec.cps.add(cp);
      // apply
      if (mutate) {
        if (action === "strip") { /* drop */ }
        else if (action === "normalize") {
          out.push(cat === "style" ? (STYLE_MAP[cp] || "") : (CAT[cat].to != null ? CAT[cat].to : " "));
        } else { out.push(String.fromCodePoint(cp)); } // flag / preserve keep the char
      }
    }
    const stats = { total: findings.length, strip: 0, normalize: 0, flag: 0, preserve: 0 };
    for (const f of findings) stats[f.action]++;
    stats.changed = stats.strip + stats.normalize;
    const categories = [...byCat.values()].map((r) => ({
      id: r.id, label: r.meta.label, group: r.meta.group, icon: r.meta.icon, risk: r.meta.risk,
      count: r.count, strip: r.strip, normalize: r.normalize, flag: r.flag, preserve: r.preserve,
      // dominant effective action for the badge
      action: r.strip ? "strip" : r.normalize ? "normalize" : r.preserve && !r.flag ? "preserve" : "flag",
      samples: [...r.cps].map((cp) => ({ cp, hex: U(cp), name: nameOf(cp), chip: chipFor(cp) })),
    })).sort((a, b) => (rank(a) - rank(b)) || (b.count - a.count));
    const res = { findings, categories, stats, options: o, version: VERSION };
    if (mutate) res.cleaned = out.join("");
    return res;
  }
  const groupRank = { security: 0, hidden: 1, space: 2, context: 3, info: 4, style: 5 };
  function rank(c) { return groupRank[c.group] != null ? groupRank[c.group] : 9; }

  function analyze(text, options) { return run(text, options, false); }
  function sanitizeText(text, options) { return run(text, options, true); }

  // Convenience for servers/scanners: just the cleaned string with a conservative preset.
  function clean(text, options) { return sanitizeText(text, options).cleaned; }
  // Is there anything worth cleaning? (cheap gate — skips the common all-ASCII path).
  // Built from \\u escapes so this file's OWN source stays free of hidden characters.
  const SUSPECT = new RegExp(
    "[\\u00A0\\u00AD\\u0340-\\u036F\\u0600-\\u06FF\\u061C\\u115F\\u1160\\u1680\\u17B4\\u17B5" +
    "\\u180E\\u2000-\\u200F\\u2011\\u2013\\u2014\\u2018\\u2019\\u201C\\u201D\\u2026\\u2028\\u2029" +
    "\\u202A-\\u202F\\u205F\\u2060-\\u2064\\u2066-\\u206F\\u3000\\u3164\\uFE00-\\uFE0F\\uFEFF" +
    "\\uFFF9-\\uFFFC\\uFFFD\\uFFA0\\u0400-\\u04FF\\u0370-\\u03FF]" +
    "|[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]" +
    "|[\\uDB40][\\uDC00-\\uDFFF]" +
    "|[\\uDB40-\\uDB43][\\uDD00-\\uDFFF]"
  );
  function hasSuspect(text) { return SUSPECT.test(text == null ? "" : String(text)); }

  return {
    VERSION, analyze, sanitizeText, clean, hasSuspect,
    classify, nameOf, chipFor, hex, U, isEmoji, isJoiningScript,
    CATEGORIES: CAT, PRESETS: Object.keys(PRESETS), defaults,
  };
});
