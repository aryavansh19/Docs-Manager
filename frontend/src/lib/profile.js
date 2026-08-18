/**
 * Single source of truth for onboarding state.
 *
 * These predicates live in one place on purpose. Verification and Dashboard
 * previously each had their own idea of "verified" — Verification also accepted
 * status === 'ACTIVE', while Dashboard required the boolean — which produced an
 * infinite /verify <-> /dashboard redirect loop for any user whose folders were
 * created before they messaged the bot.
 */

/**
 * Has the user opened a WhatsApp conversation with the bot?
 *
 * Only `whatsapp_verified` can answer this. `status` cannot: the folder-creation
 * worker sets status='ACTIVE' regardless of verification, so an ACTIVE user may
 * never have messaged the bot at all.
 */
export function isWhatsAppVerified(profile) {
    return profile?.whatsapp_verified === true;
}

/** Has the Drive folder tree been created? */
export function hasWorkspace(profile) {
    return Boolean(profile?.root_folder_id);
}

/**
 * Where this profile belongs right now.
 * WhatsApp comes first because the folder worker sends a business-initiated
 * message, which Meta only allows inside the 24h window that a user-initiated
 * message opens.
 */
export function nextOnboardingRoute(profile) {
    if (!profile) return "/login";
    if (!isWhatsAppVerified(profile)) return "/verify";
    return "/dashboard";
}
