// Legacy worker for the OLD name `bugledger` (deployed with wrangler.legacy.json).
// The ledger moved to breadledger.coconvo.workers.dev; this keeps every old link and tool working:
//   • a person opening a page (GET/HEAD with Accept: text/html, outside /api/) → 301 to the same path + query on the new host
//   • everything else — /api/*, checklist.json, bugs.json, data.js, journal.mjs, AGENT.md, llms.txt, og.png —
//     is proxied through a service binding to the new worker, URL rewritten, method/headers/body untouched,
//     so `curl -s` without -L, the hooks and the CLIs keep working until they are switched.
// No D1, no R2, no secret here: the new worker owns the data; this one only forwards.
const NEW_HOST = "breadledger.coconvo.workers.dev";
const MOVED = { "x-ledger-moved": "https://" + NEW_HOST };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    url.protocol = "https:";
    url.hostname = NEW_HOST;
    url.port = ""; // hostname alone keeps an old port (wrangler dev :8831); the new host is plain https
    const isApi = url.pathname === "/api" || url.pathname.startsWith("/api/");
    const pageView = (request.method === "GET" || request.method === "HEAD")
      && /text\/html/i.test(request.headers.get("accept") || "");
    if (pageView && !isApi) {
      return new Response(null, {
        status: 301,
        headers: { location: url.toString(), "cache-control": "public, max-age=3600", ...MOVED },
      });
    }
    const forwarded = new Request(url.toString(), request);
    let res;
    try {
      res = env.LEDGER ? await env.LEDGER.fetch(forwarded) : await fetch(forwarded);
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: "ledger moved to https://" + NEW_HOST + " and the forward failed: " + String(e) }),
        { status: 502, headers: { "content-type": "application/json; charset=utf-8", ...MOVED } });
    }
    const out = new Response(res.body, res);
    out.headers.set("x-ledger-moved", MOVED["x-ledger-moved"]);
    return out;
  },
};
