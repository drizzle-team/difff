/** Client for the Markdown share API in worker/index.ts. */

export type CreatedShare = { id: string; url: string; expiresAt: string };
export type Share = { name: string; content: string; expiresAt: string };

/** Share id from a `/md/:id` link, or null on any other page. */
export const shareIdFromPath = (pathname: string) => pathname.match(/^\/md\/([^/]+)$/)?.[1] ?? null;

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message);
    }
}

const request = async <T>(input: string, init?: RequestInit): Promise<T> => {
    let response: Response;
    try {
        response = await fetch(input, init);
    } catch {
        throw new ApiError("Network error. Check your connection and try again.", 0);
    }
    const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!response.ok || !body) {
        throw new ApiError(body?.error ?? `Request failed (${response.status}).`, response.status);
    }
    return body;
};

export const createShare = (name: string, content: string, pin: string) =>
    request<CreatedShare>("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content, pin })
    });

/** The share PIN is remembered per browser so it's typed once (a convenience, not security). */
const PIN_KEY = "difff:share-pin";

export const savedPin = () => {
    try {
        return localStorage.getItem(PIN_KEY) ?? "";
    } catch {
        return "";
    }
};

export const savePin = (pin: string | null) => {
    try {
        if (pin) localStorage.setItem(PIN_KEY, pin);
        else localStorage.removeItem(PIN_KEY);
    } catch {
        // Storage blocked (private mode): the PIN is just asked again next time.
    }
};

export const fetchShare = (id: string) => request<Share>(`/api/share/${encodeURIComponent(id)}`);

/** "23h 59m", "12m", "less than a minute". */
export const timeLeft = (expiresAt: string, now = Date.now()) => {
    const minutes = Math.floor((Date.parse(expiresAt) - now) / 60_000);
    if (minutes < 1) return "less than a minute";
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};
