import { useState } from "react";
import { Link } from "react-router-dom";
import { Phone, ArrowRight, ShieldCheck } from "lucide-react";
import { supabase } from "../supabaseClient";
import { GOOGLE_OAUTH_SCOPES } from "../lib/config";
import AuthShell from "../components/AuthShell";

export default function Signup() {
    const [phone, setPhone] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSignup = async () => {
        if (!phone || phone.length < 10) {
            alert("Please enter a valid WhatsApp number.");
            return;
        }

        setIsLoading(true);

        try {
            // 1. Construct the Callback URL with the Phone Number
            // This ensures we know who this user is when they return from Google
            const baseUrl = window.location.origin;
            const redirectUrl = `${baseUrl}/auth/callback?phone=${encodeURIComponent(phone)}`;

            // 2. Trigger Supabase OAuth
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    queryParams: {
                        access_type: 'offline', // Forces Google to give us a Refresh Token
                        prompt: 'consent',
                    },
                    scopes: GOOGLE_OAUTH_SCOPES,
                },
            });

            if (error) throw error;

        } catch (error) {
            console.error("Signup Error:", error);
            alert("Error connecting to Google: " + error.message);
            setIsLoading(false);
        }
    };

    return (
        <AuthShell
            backTo="/auth"
            backLabel="Back"
            accent="cobalt"
            footer={
                <>
                    Already have an account?{" "}
                    <Link to="/login" className="link-wipe font-bold text-ink">
                        Log in
                    </Link>
                </>
            }
        >
            <div className="p-8 sm:p-10">
                <span className="eyebrow mb-5 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-cobalt px-3.5 py-1.5 text-paper">
                    <ShieldCheck size={12} />
                    Registration
                </span>

                <h1 className="mb-3 font-display text-4xl font-extrabold tracking-tight">
                    Link your WhatsApp.
                </h1>
                <p className="mb-8 text-[15px] leading-relaxed text-ink-70">
                    This number becomes your file gateway. Anything you forward from it
                    gets sorted into your Drive.
                </p>

                <div className="mb-7">
                    <label
                        htmlFor="phone"
                        className="eyebrow mb-2.5 block text-ink-45"
                    >
                        WhatsApp number
                    </label>

                    <div className="relative">
                        <span
                            className="pointer-events-none absolute inset-y-0 left-0 grid w-12 place-items-center text-ink-45"
                            aria-hidden="true"
                        >
                            <Phone size={18} />
                        </span>
                        <input
                            id="phone"
                            type="tel"
                            inputMode="numeric"
                            placeholder="919876543210"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                            aria-describedby="phone-hint"
                            className="w-full rounded-xl border-2 border-ink bg-paper-2 py-4 pl-12 pr-16 font-mono text-lg font-bold text-ink transition-colors placeholder:font-normal placeholder:text-ink-25 focus:bg-lime-soft focus:outline-none"
                            autoFocus
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-md border-2 border-ink bg-paper px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-ink-45">
                            no +
                        </span>
                    </div>

                    <p id="phone-hint" className="mt-2.5 text-xs text-ink-45">
                        Country code first, then the number. No plus sign, no spaces.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleSignup}
                    disabled={!phone || isLoading}
                    className={`group flex w-full items-center justify-center gap-3 rounded-full border-2 border-ink px-6 py-4 font-bold transition-all ${
                        phone && !isLoading
                            ? "bg-ink text-paper shadow-brut hover:bg-flame"
                            : "cursor-not-allowed bg-paper-3 text-ink-45"
                    }`}
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
                            Verify &amp; continue
                            {phone && (
                                <ArrowRight
                                    size={16}
                                    className="transition-transform group-hover:translate-x-1"
                                />
                            )}
                        </>
                    )}
                </button>
            </div>
        </AuthShell>
    );
}
