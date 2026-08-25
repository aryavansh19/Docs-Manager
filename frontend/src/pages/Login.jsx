import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldCheck, ArrowRight, Check, AlertCircle } from "lucide-react";
import { supabase } from "../supabaseClient";
import { GOOGLE_OAUTH_SCOPES } from "../lib/config";
import AuthShell from "../components/AuthShell";

// Reasons AuthCallback can bounce someone back here. Without these the redirect carried
// an ?error= param that nothing rendered, so the user saw no explanation at all.
const NOTICES = {
    auth_failed: "Google sign-in did not complete. Please try again.",
    account_not_found: "No DocsFlow account exists for that Google account yet.",
    reconnect: "DocsFlow lost access to your Google Drive. Approve access once more to reconnect it.",
};

export default function Login() {
    const [searchParams] = useSearchParams();
    // ?reconnect=1 is the deliberate re-consent path; it should explain itself even though
    // it arrives as a different param than the error notices above.
    const reconnect = searchParams.get("reconnect") === "1";
    const notice = reconnect ? NOTICES.reconnect : NOTICES[searchParams.get("error")];
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        try {
            // 1. Construct Standard Callback URL
            const baseUrl = window.location.origin;
            const redirectUrl = `${baseUrl}/auth/callback`; // No phone param = Door B

            // 2. Trigger Supabase OAuth
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    queryParams: {
                        // Still ask for offline access, so a first-time grant returns a
                        // refresh token without us having to force the consent screen.
                        access_type: 'offline',
                        // Google re-shows its consent screen every single time we send
                        // prompt=consent, which is why returning users were re-approving
                        // access on every login. Signup already asks for consent once, and
                        // that grant is what produced the refresh token we store, so a
                        // normal login has nothing left to ask for.
                        //
                        // The concern behind the old behaviour is real though: Google only
                        // issues a refresh token when consent is granted, so a plain login
                        // cannot replace one that expired or was revoked. That recovery is
                        // now explicit rather than charged to every login -- send the user
                        // to /login?reconnect=1 and consent is requested again.
                        prompt: reconnect ? 'consent select_account' : 'select_account',
                    },
                    scopes: GOOGLE_OAUTH_SCOPES,
                },
            });

            if (error) throw error;
        } catch (error) {
            console.error("Login Error:", error);
            alert("Error: " + error.message);
            setIsLoading(false);
        }
    };

    return (
        <AuthShell
            backTo="/auth"
            backLabel="Back"
            accent="lime"
            footer={
                <>
                    No account yet?{" "}
                    <Link to="/signup" className="link-wipe font-bold text-ink">
                        Create one
                    </Link>
                </>
            }
        >
            <div className="p-8 sm:p-10">
                <span className="eyebrow mb-5 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-lime px-3.5 py-1.5 text-ink">
                    <ShieldCheck size={12} />
                    Access
                </span>

                <h1 className="mb-3 font-display text-4xl font-extrabold tracking-tight">
                    Welcome back.
                </h1>
                <p className="mb-8 text-[15px] leading-relaxed text-ink-70">
                    Sign in with the Google account you connected. We match your workspace
                    by email — nothing else to remember.
                </p>

                {notice && (
                    <div
                        role="status"
                        className="mb-8 flex items-start gap-3 rounded-xl border-2 border-ink bg-flame-soft px-4 py-3.5"
                    >
                        <AlertCircle size={17} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" />
                        <p className="text-[13.5px] font-medium leading-relaxed text-ink">
                            {notice}{" "}
                            <Link to="/signup" className="font-bold underline">
                                Create an account
                            </Link>
                        </p>
                    </div>
                )}

                <ul className="mb-8 space-y-2.5 rounded-xl border-2 border-ink bg-paper-2 p-5">
                    {[
                        "Identified automatically by Google email",
                        "Drive stays connected from last time",
                        "No password to type or reset",
                    ].map((item) => (
                        <li key={item} className="flex items-start gap-2.5">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-ink bg-teal text-ink">
                                <Check size={11} strokeWidth={3.5} />
                            </span>
                            <span className="text-sm font-medium text-ink-70">{item}</span>
                        </li>
                    ))}
                </ul>

                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="group flex w-full items-center justify-center gap-3 rounded-full border-2 border-ink bg-ink px-6 py-4 font-bold text-paper shadow-brut transition-all hover:bg-flame disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {isLoading ? (
                        <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
                            Connecting…
                        </>
                    ) : (
                        <>
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-paper">
                                <img
                                    src="https://www.svgrepo.com/show/475656/google-color.svg"
                                    alt=""
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5"
                                />
                            </span>
                            Continue with Google
                            <ArrowRight
                                size={16}
                                className="transition-transform group-hover:translate-x-1"
                            />
                        </>
                    )}
                </button>
            </div>
        </AuthShell>
    );
}
