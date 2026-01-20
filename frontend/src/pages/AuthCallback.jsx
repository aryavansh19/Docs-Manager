import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Loader2 } from "lucide-react"; // Added standard loader icon

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
            const urlPhone = searchParams.get("phone");
            const googleRefreshToken = session.provider_refresh_token;
            const userMeta = session.user.user_metadata;

            let dbResult;

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
                const { data, error: rpcError } = await supabase.rpc('get_user_status_by_email');

                if (rpcError || !data?.success) {
                    // Account not found -> Sign out & Redirect to Login
                    await supabase.auth.signOut();
                    navigate("/login?error=account_not_found");
                    return;
                }
                dbResult = data;
            }

            // === 🚦 UPDATED REDIRECT LOGIC ===
            const userStatus = dbResult.status || "NEW";

            // 🟢 GREEN LIGHT: Go to Dashboard
            // 'ACTIVE': Normal users
            // 'AWAITING_FOLDERS': Users currently building folders (shows spinner on dashboard)
            if (userStatus === "ACTIVE" || userStatus === "AWAITING_FOLDERS") {
                navigate("/dashboard");
            }
            // 🟡 YELLOW LIGHT: Go to Setup
            // Users who are verified but haven't finished selecting subjects
            else if (["CONNECTED", "AWAITING_SYLLABUS", "EDITING_LIST"].includes(userStatus)) {
                navigate("/setup");
            }
            // 🔴 RED LIGHT: Go to Verify
            // New users who need to verify phone number via WhatsApp
            else {
                navigate("/verify");
            }
        };

        handleAuthLogic();
    }, [navigate, searchParams]);

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-[#020202] text-white font-mono">
            <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
            <h2 className="text-xl font-bold">{status}</h2>
        </div>
    );
}