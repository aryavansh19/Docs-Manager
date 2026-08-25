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
        // The OAuth redirect comes back with the code in the URL; this is what exchanges
        // it for a session before AuthCallback reads it.
        detectSessionInUrl: true,
        flowType: 'pkce',
        // storageKey is deliberately left at its default. Changing it would orphan every
        // session already stored in a user's browser and sign everyone out.
    },
})
