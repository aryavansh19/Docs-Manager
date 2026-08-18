/**
 * Central runtime config.
 *
 * Previously the backend URL was re-declared in four components (and hardcoded
 * outright in one), and the bot number was read from an env var that is absent
 * from .env — which rendered "wa.me/undefined".
 */

/** Backend used when the app is served from a deployed origin. */
const HOSTED_API_URL = "https://api.docsflow.tech";
/** Backend used when developing locally. */
const LOCAL_API_URL = "http://localhost:8001";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function resolveApiUrl() {
    const configured = import.meta.env.VITE_API_URL?.trim();
    if (configured) {
        return configured.replace(/\/+$/, "");
    }

    // Vite inlines env vars at build time, so a variable missing from the deploy
    // configuration cannot be noticed at runtime. Defaulting to localhost meant the
    // hosted site called the visitor's own machine and every request failed with
    // "Could not reach the server". Only trust the localhost default when the page
    // itself is being served locally.
    if (typeof window !== "undefined" && !LOCAL_HOSTNAMES.has(window.location.hostname)) {
        return HOSTED_API_URL;
    }
    return LOCAL_API_URL;
}

export const API_URL = resolveApiUrl();

/**
 * Google OAuth scopes requested at sign-in.
 *
 * `drive.file` grants per-file access limited to files this app creates or the user
 * explicitly opens with it — which is everything DocsFlow touches, since it creates its
 * own workspace folder and uploads every file it manages.
 *
 * The full `auth/drive` scope was requested previously. Google classifies that as
 * restricted, which makes app verification and a periodic security assessment mandatory
 * before real users can connect. `drive.file` is non-sensitive and carries no such
 * requirement, so this is both narrower and the only version that can ship publicly.
 */
export const GOOGLE_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

/** WhatsApp bot number, digits only. Empty when it has not been configured. */
export const BOT_NUMBER = (import.meta.env.VITE_BOT_NUMBER ?? "").trim();

/** True when a bot number is configured, so callers can hide dead links. */
export const HAS_BOT_NUMBER = BOT_NUMBER.length > 0;

/**
 * Build a wa.me deep link, optionally pre-filling the message body.
 *
 * wa.me rejects "+" and spacing, so the number is reduced to digits here rather
 * than depending on however it was typed into the environment variable.
 */
export function botWhatsAppLink(message) {
    // Returning undefined makes React omit the href entirely. The previous fallback
    // was a placeholder US number, so users following it messaged a dead line and
    // verification could never complete — a silent failure worse than an inert link.
    if (!HAS_BOT_NUMBER) {
        return undefined;
    }
    const digits = BOT_NUMBER.replace(/\D/g, "");
    const base = `https://wa.me/${digits}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
