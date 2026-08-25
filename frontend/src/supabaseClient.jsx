import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // These four are already the supabase-js v2 defaults, but "stay signed in" is a
        // product requirement here, not a nice-to-have, so it is stated rather than
        // inherited. The session lives in localStorage and the access token is refreshed
        // in the background, which is what keeps a user signed in across reloads, new
        // tabs, and browser restarts.
        persistSession: true,
        autoRefreshToken: true,
        // The OAuth redirect comes back carrying the credential in the URL; this is what
        // turns it into a session before AuthCallback reads it.
        detectSessionInUrl: true,
        // flowType and storageKey are both deliberately left at their defaults.
        // Setting flowType would change the OAuth handshake itself, which is working, and
        // changing storageKey would orphan every session already stored in a user's
        // browser and sign everyone out.
    },
})
