/**
 * Worker in front of the static Astro build. Only /api/* and /md/* reach it
 * (`assets.run_worker_first` in wrangler.jsonc); everything else is served as assets.
 *
 *   POST /api/share       { name, content, pin } → { id, url, expiresAt }   store a file for 24h
 *                         (`pin` must match the SHARE_PIN secret; only the owner creates links)
 *   GET  /api/share/:id   → { name, content, expiresAt }               read it back
 *   GET  /md/:id          → the /markdown-viewer page, which loads the share client-side
 *
 * Expiry: every read checks `expiresAt`, so links die after exactly 24h. An R2 lifecycle rule
 * on the `shares/` prefix (setup commands in wrangler.jsonc) deletes the objects afterwards.
 */

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CONTENT_BYTES = 1024 * 1024;
const MAX_NAME_LENGTH = 200;
const ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;
const KEY_PREFIX = "shares/";

type ShareMetadata = { name: string; expiresAt: string };

const json = (body: unknown, status = 200) =>
    Response.json(body, {
        status,
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }
    });

const error = (status: number, message: string) => json({ error: message }, status);

/** 12 base64url chars = 72 random bits: unguessable, still short enough for a link. */
const newId = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(9));
    return btoa(String.fromCharCode(...bytes))
        .replaceAll("+", "-")
        .replaceAll("/", "_");
};

/** Constant-time PIN check: hash both sides so lengths match, then compare. */
const pinMatches = async (given: unknown, expected: string) => {
    if (typeof given !== "string") return false;
    const encoder = new TextEncoder();
    const [a, b] = await Promise.all([
        crypto.subtle.digest("SHA-256", encoder.encode(given)),
        crypto.subtle.digest("SHA-256", encoder.encode(expected))
    ]);
    return crypto.subtle.timingSafeEqual(a, b);
};

const createShare = async (request: Request, env: Env, origin: string) => {
    // Rate limit first: it also caps PIN guessing at 10 tries per minute per IP.
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await env.SHARE_LIMITER.limit({ key: ip });
    if (!success) return error(429, "Too many attempts. Try again in a minute.");

    // Fail closed if the secret isn't set (`wrangler secret put SHARE_PIN`).
    if (!env.SHARE_PIN) return error(503, "Sharing isn't configured on this server.");

    const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
    if (declaredLength > MAX_CONTENT_BYTES + 4096) return error(413, "File is larger than 1 MB.");

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return error(400, "Expected a JSON body.");
    }
    const { name, content, pin } = (body ?? {}) as {
        name?: unknown;
        content?: unknown;
        pin?: unknown;
    };
    if (!(await pinMatches(pin, env.SHARE_PIN))) return error(401, "Wrong PIN.");
    if (typeof content !== "string" || content.length === 0) return error(400, "Nothing to share.");
    if (new TextEncoder().encode(content).byteLength > MAX_CONTENT_BYTES)
        return error(413, "File is larger than 1 MB.");
    const fileName =
        typeof name === "string" && name.trim()
            ? name.trim().slice(0, MAX_NAME_LENGTH)
            : "shared.md";

    const id = newId();
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
    await env.SHARES.put(KEY_PREFIX + id, content, {
        httpMetadata: { contentType: "text/markdown; charset=utf-8" },
        customMetadata: { name: fileName, expiresAt } satisfies ShareMetadata
    });

    return json({ id, url: `${origin}/md/${id}`, expiresAt }, 201);
};

const readShare = async (id: string, env: Env, ctx: ExecutionContext) => {
    const object = await env.SHARES.get(KEY_PREFIX + id);
    const meta = object?.customMetadata as ShareMetadata | undefined;
    if (!object || !meta) return error(404, "This link doesn't exist or has expired.");

    if (Date.parse(meta.expiresAt) <= Date.now()) {
        // The lifecycle rule would delete it eventually; do it now.
        ctx.waitUntil(env.SHARES.delete(KEY_PREFIX + id));
        return error(404, "This link doesn't exist or has expired.");
    }
    return json({ name: meta.name, content: await object.text(), expiresAt: meta.expiresAt });
};

/** Serves the viewer page for a share link; never indexed, since the content is temporary. */
const viewerPage = async (request: Request, env: Env) => {
    const page = await env.ASSETS.fetch(new URL("/markdown-viewer", request.url));
    const response = new Response(page.body, page);
    response.headers.set("X-Robots-Tag", "noindex");
    response.headers.set("Cache-Control", "no-store");
    return response;
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const { pathname } = url;

        if (pathname === "/api/share") {
            if (request.method !== "POST") return error(405, "Use POST.");
            return createShare(request, env, url.origin);
        }

        const apiMatch = pathname.match(/^\/api\/share\/([^/]+)$/);
        if (apiMatch) {
            if (request.method !== "GET") return error(405, "Use GET.");
            const id = apiMatch[1]!;
            if (!ID_PATTERN.test(id)) return error(404, "This link doesn't exist or has expired.");
            return readShare(id, env, ctx);
        }

        if (/^\/md\/[^/]+$/.test(pathname) && request.method === "GET") {
            return viewerPage(request, env);
        }

        return env.ASSETS.fetch(request);
    }
} satisfies ExportedHandler<Env>;
