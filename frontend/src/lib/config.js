/**
 * Central runtime config.
 *
 * Previously the backend URL was re-declared in four components (and hardcoded
 * outright in one), and the bot number was read from an env var that is absent
 * from .env — which rendered "wa.me/undefined". Both now have safe fallbacks.
 */

export const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:8001";

export const BOT_NUMBER =
    import.meta.env.VITE_BOT_NUMBER || "+15551685392";

/** Build a wa.me deep link, optionally pre-filling the message body. */
export function botWhatsAppLink(message) {
    const base = `https://wa.me/${BOT_NUMBER}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
