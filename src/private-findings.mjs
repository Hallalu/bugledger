// What someone without the owner's key may read about a scan: that it ran and its counts, never what it found.
const HIDDEN = "Details are private";

export const publicCheck = (c) => ({ ...c, notFound: [], found: [], securityChecked: [], securityFindings: [], notes: null,
  coverage: c.coverage ? { ...c.coverage, missed: [], evidence: null } : null });

// a phase name only says which stage a scan reached, so it stays
export const publicEvent = (e) => ({ ...e, title: e.kind === "phase" ? e.title : HIDDEN, detail: null, impact: null, fix: null,
  file: null, ref: null, before: null, after: null, meta: null });

export const publicSubmitted = (s) => ({ ...s, title: HIDDEN, symptom: null, fix: null, file: null, shots: [] });

export const publicRollup = (r) => ({ ...r, metrics: [], verdict: null });

export const publicSession = (s) => ({ ...s, current: "", tasks: [], note: "",
  progress: s.progress ? { ...s.progress, label: "" } : null });

// one card on the Now board: the session, its progress and how many findings, nothing they say
export const publicCard = (c) => ({ ...publicSession(c), story: [], acts: [], features: [], shots: [], you: null, redacted: true });
