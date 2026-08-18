import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { motion } from "framer-motion";

export default function AuthCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState("Authenticating...");

    // 🔒 THE LOCK: Prevents the function from running twice
    const effectRan = useRef(false);

    useEffect(() => {
        if (effectRan.current === true) return; // If already ran, STOP.

        const handleAuthLogic = async () => {
            effectRan.current = true; // Mark as running

            // 1. Get Session
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error || !session) {
                console.error("Auth Error:", error);
                navigate("/login?error=auth_failed");
                return;
            }

            // 2. Extract Data
            let dbResult;
            const urlPhone = searchParams.get("phone");
            const googleRefreshToken = session.provider_refresh_token;
            const userMeta = session.user.user_metadata;

            // === LOGIC BRANCHING ===
            if (urlPhone) {
                setStatus("Linking your account...");

                // Call SQL Function
                const { data, error: rpcError } = await supabase.rpc('link_google_account', {
                    target_phone: urlPhone,
                    google_refresh_token: googleRefreshToken || null,
                    user_name: userMeta.full_name,
                    user_pic: userMeta.avatar_url
                });

                if (rpcError || !data?.success) {
                    console.error("Linking Failed:", rpcError);
                    navigate("/signup?error=linking_failed");
                    return;
                }
                dbResult = data;
            }
            else {
                setStatus("Finding your account...");
                // Pass the refresh token through on sign-in too. Google only returns one
                // when consent is granted again, so dropping it here meant an expired or
                // revoked token could never be replaced.
                const { data, error: rpcError } = await supabase.rpc('get_user_status_by_email', {
                    google_refresh_token: googleRefreshToken || null,
                });

                if (rpcError || !data?.success) {
                    // Account not found -> Sign out & Redirect to Login
                    await supabase.auth.signOut();
                    navigate("/login?error=account_not_found");
                    return;
                }
                dbResult = data;
            }

            // === REDIRECT ===
            // WhatsApp verification comes FIRST, before folder creation.
            // Meta only allows a business to message a user inside the 24h
            // customer-service window that a *user-initiated* message opens, and
            // the folder worker sends a "your folders are ready" message. So the
            // user has to say hello before anything else runs.
            if (!dbResult?.whatsapp_verified) {
                navigate("/verify");
                return;
            }

            navigate("/dashboard");
        };

        handleAuthLogic();
    }, [navigate, searchParams]);

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-ink">
            <div className="pointer-events-none absolute inset-0 bg-graph opacity-70" aria-hidden="true" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-sm rounded-2xl border-2 border-ink bg-paper p-10 text-center shadow-brut-lg"
            >
                {/* Three-dot loader built from the accent palette */}
                <div className="mb-7 flex items-center justify-center gap-2.5" aria-hidden="true">
                    {["bg-flame", "bg-lime", "bg-cobalt"].map((color, i) => (
                        <motion.span
                            key={color}
                            className={`h-4 w-4 rounded-full border-2 border-ink ${color}`}
                            animate={{ y: [0, -12, 0] }}
                            transition={{
                                duration: 0.7,
                                repeat: Infinity,
                                delay: i * 0.13,
                                ease: "easeInOut",
                            }}
                        />
                    ))}
                </div>

                <h1 className="mb-2 font-display text-2xl font-extrabold tracking-tight">
                    {status}
                </h1>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-45">
                    Hold tight
                </p>

                <span role="status" aria-live="polite" className="sr-only">
                    {status}
                </span>
            </motion.div>
        </div>
    );
}
