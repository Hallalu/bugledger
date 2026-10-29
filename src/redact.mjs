// Redaction for everything the public can read on the ledger. The ledger records bugs from the owner's apps,
// and those notes often name the AI models, providers and infrastructure behind them — which the owner keeps
// confidential. Public pages and public API reads say what kind of thing it was ("[image model]",
// "[database]"), never which one. The repo keeps the full text; owner-only routes are untouched.
//
// Used by gen.mjs (every file it writes into public/) and by the Worker (public GET responses).
// This file is public, so it carries only well-known names; the owner's own extra terms come from
// ~/.bugledger-stack.json (gen.mjs) or the STACK_TERMS secret (Worker), never from the repo.

const CATEGORIES = [
  ['[AI platform]', ['Workers AI']],
  ['[billing gateway]', ['AI Gateway', 'unified billing']],
  ['[image service]', ['Cloudflare Images']],
  ['[stateful worker]', ['Durable Objects', 'Durable Object']],
  ['[host]', ['Cloudflare']],
  ['[deploy tool]', ['wrangler']],
  ['[runtime]', ['workerd']],
  ['[compute units]', ['Neurons', 'neurons', 'Neuron', 'neuron']],
  ['[image model]', ['Black Forest Labs FLUX', 'FLUX.2 klein', 'FLUX.2 dev', 'FLUX.2', 'FLUX.1', 'FLUX', 'Stable Diffusion', 'SDXL',
    'Lucid Origin', 'Seedream', 'Imagen', 'DALL-E', 'DALL·E', 'Nano Banana', 'klein 9B', 'klein 4B', 'klein-9b', 'klein-4b', 'klein', 'schnell', 'Flash Image']],
  ['[provider watermark]', ['SynthID']],
  ['[video model]', ['Seedance', 'Kling', 'Hailuo', 'MiniMax', 'P-Video', 'Runway', 'Veo', 'Sora', 'Wan2', 'Hunyuan']],
  ['[speech model]', ['Grok STT', 'Whisper', 'Deepgram', 'Nova-3', 'Aura-2', 'Inworld', 'TTS-2', 'ElevenLabs']],
  ['[language model]', ['Claude Opus', 'Claude Sonnet', 'Claude Haiku', 'Opus 5.5', 'Sonnet 5.5', 'Haiku 5.5', 'GPT-5', 'GPT-4o', 'GPT-4',
    'ChatGPT', 'Llama', 'Gemini', 'Qwen', 'Mistral', 'Grok', 'Claude', 'Opus', 'Sonnet', 'Haiku', 'Fable']],
  ['[model provider]', ['Black Forest Labs', 'Stability AI', 'ByteDance', 'Anthropic', 'OpenAI', 'Google AI', 'xAI', 'Pruna',
    'Replicate', 'fal.ai', 'Together AI', 'Higgsfield', 'Leonardo.Ai', 'Leonardo', 'Hugging Face']],
  ['[cut-out model]', ['BiRefNet']],
  ['[3D body library]', ['MakeHuman']],
];
/* short infra names: exact case only, so ordinary words and ids are left alone */
const EXACT = [['[database]', 'D1'], ['[file storage]', 'R2'], ['[key-value store]', 'KV']];
/* the coding assistant that writes these notes is not part of any app's stack */
const KEEP = /Claude Code|claude-code|\.claude\b/g;   /* incl. its ~/.claude config folder in paths */
const MODEL_ID = /@cf\/[\w./-]+|\b(?:claude-(?:opus|sonnet|haiku|3|4|5)[\w.:-]*|gpt-[\w.:-]+|llama-[\w.:-]+|gemini-[\w.:-]+|qwen[\w.:-]*\d[\w.:-]*|mistral-[\w.:-]+|flux-[\w.:-]+|sdxl[\w.:-]*|sd15[\w.:-]*|whisper-[\w.:-]+|black-forest-labs\/[\w.:-]+|anthropic\/[\w.:-]+|openai\/[\w.:-]+|pruna\/[\w.:-]+)/gi;
const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;
/* camelCase code names that start with a provider or model (geminiModel, claudeKey, whisperUrl) */
const IDENT = /(?<![A-Za-z0-9])(?:[Gg]emini|[Cc]laude|[Oo]pen[Aa][Ii]|[Aa]nthropic|[Ww]hisper|[Ff]lux|[Ll]lama|[Qq]wen|[Mm]istral|[Gg]rok|[Pp]runa|[Ii]nworld|[Dd]eepgram|[Ee]leven[Ll]abs|[Ss]eedance|[Kk]ling)(?=[A-Z0-9])[A-Za-z0-9]*/g;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function makeRedactor(extra = []) {
  const known = new Set(CATEGORIES.flatMap(([, t]) => t.map(x => x.toLowerCase())));
  const cats = [...CATEGORIES];
  const own = [...new Set(extra.map(String).filter(t => t.length > 1 && !known.has(t.toLowerCase())))];
  if (own.length) cats.push(['[AI model or provider]', own]);
  /* one pass, longest names first, whole words, case-insensitive */
  const pairs = cats.flatMap(([label, terms]) => terms.map(t => [t, label])).sort((a, b) => b[0].length - a[0].length);
  const label = new Map(pairs.map(([t, l]) => [t.toLowerCase(), l]));
  /* underscores count as boundaries, so provider names inside env vars (ANTHROPIC_API_KEY) are caught too */
  const words = new RegExp(`(?<![A-Za-z0-9])(?:${pairs.map(([t]) => esc(t)).join('|')})(?![A-Za-z0-9])`, 'gi');
  const exact = new RegExp(`(?<![A-Za-z0-9_/.-])(?:${EXACT.map(([, t]) => esc(t)).join('|')})(?![A-Za-z0-9_-])`, 'g');
  const exactLabel = new Map(EXACT.map(([l, t]) => [t, l]));
  const sensitive = (s) => { words.lastIndex = 0; MODEL_ID.lastIndex = 0; return words.test(s) || MODEL_ID.test(s); };

  return function redact(text) {
    if (typeof text !== 'string' || !text) return text;
    const kept = []; /* protect "Claude Code" while the rest is rewritten */
    let s = text.replace(KEEP, (m) => `\u0000${kept.push(m) - 1}\u0000`);
    s = s.replace(URL_RE, (u) => (sensitive(u) ? '[link removed]' : u));
    s = s.replace(MODEL_ID, '[model id]');
    s = s.replace(IDENT, '[code name]');
    s = s.replace(words, (m) => label.get(m.toLowerCase()) || '[AI model or provider]');
    s = s.replace(exact, (m) => exactLabel.get(m) || m);
    /* a version number left right after a placeholder still identifies the model ("[language model] 3.1") */
    s = s.replace(/(\[(?:image|video|speech|language) model\]) v?\d+(?:\.\d+)+\b/g, '$1');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[+i]);
  };
}

/* Worker: rewrite the text of public read responses. Owner routes, writes and binary bodies pass through. */
const PUBLIC_READ = /^\/(?:api\/(?:bugs|activity|sessions|session|story|checks)$|story\/|prompts\/)/;
let cached = null;
export async function redactPublic(request, env, res) {
  if (!res || (request.method !== 'GET' && request.method !== 'HEAD')) return res;
  const { pathname } = new URL(request.url);
  if (!PUBLIC_READ.test(pathname)) return res;
  const type = res.headers.get('content-type') || '';
  if (!/json|html|text|javascript/.test(type)) return res;
  if (!cached || cached.key !== (env.STACK_TERMS || '')) {
    let extra = []; try { extra = JSON.parse(env.STACK_TERMS || '[]'); } catch {}
    cached = { key: env.STACK_TERMS || '', fn: makeRedactor(Array.isArray(extra) ? extra : extra.terms || []) };
  }
  const headers = new Headers(res.headers); headers.delete('content-length'); headers.delete('etag');
  if (request.method === 'HEAD') return new Response(null, { status: res.status, headers });
  return new Response(cached.fn(await res.text()), { status: res.status, statusText: res.statusText, headers });
}
