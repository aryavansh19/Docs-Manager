import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Phone, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { supabase } from "../supabaseClient";
import { GOOGLE_OAUTH_SCOPES } from "../lib/config";
import AuthShell from "../components/AuthShell";

// WhatsApp identifies a sender by their full international number, so the country code
// is not optional. It used to share one free-text field with the number, and anyone who
// typed just their national number got a profile row that no incoming WhatsApp message
// could ever match — leaving them stuck on the verification screen forever.
const COUNTRY_CODES = [
    { code: "91", label: "🇮🇳 +91" },
    { code: "1", label: "🇺🇸 +1" },
    { code: "44", label: "🇬🇧 +44" },
    { code: "61", label: "🇦🇺 +61" },
    { code: "971", label: "🇦🇪 +971" },
    { code: "65", label: "🇸🇬 +65" },
    { code: "880", label: "🇧🇩 +880" },
    { code: "977", label: "🇳🇵 +977" },
    { code: "94", label: "🇱🇰 +94" },
    { code: "49", label: "🇩🇪 +49" },
];

const NOTICES = {
    no_account: "We could not find a DocsFlow account for that Google account. Create one below — it takes a minute.",
    linking_failed: "Something went wrong linking your account. Please check your number and try again.",
    phone_in_use: "That WhatsApp number is already linked to another DocsFlow account.",
    invalid_phone: "That number did not look right. Pick your country code and enter the number without it.",
    change_number: "Enter the correct WhatsApp number below. This replaces the one on your account.",
};

export default function Signup() {
    const [searchParams] = useSearchParams();
    const [countryCode, setCountryCode] = useState("91");
    const [phone, setPhone] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const notice = NOTICES[searchParams.get("notice") || searchParams.get("error")];
    // Long enough to be a real subscriber number, short enough to reject a pasted number
    // that already includes the country code.
    const phoneIsValid = phone.length >= 6 && phone.length <= 14;

    const handleSignup = async () => {
        if (!phoneIsValid) {
            alert("Enter your WhatsApp number without the country code.");
            return;
        }

        setIsLoading(true);

        try {
            // 1. Construct the Callback URL with the Phone Number
            // This ensures we know who this user is when they return from Google
            const baseUrl = window.location.origin;
            const fullNumber = `${countryCode}${phone}`;
            const redirectUrl = `${baseUrl}/auth/callback?phone=${encodeURIComponent(fullNumber)}`;

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

                {notice && (
                    <div
                        role="status"
                        className="mb-7 flex items-start gap-3 rounded-xl border-2 border-ink bg-flame-soft px-4 py-3.5"
                    >
                        <AlertCircle size={17} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" />
                        <p className="text-[13.5px] font-medium leading-relaxed text-ink">{notice}</p>
                    </div>
                )}

                <div className="mb-7">
                    <label
                        htmlFor="phone"
                        className="eyebrow mb-2.5 block text-ink-45"
                    >
                        WhatsApp number
                    </label>

                    <div className="flex gap-2.5">
                        <select
                            aria-label="Country code"
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="shrink-0 rounded-xl border-2 border-ink bg-paper-2 py-4 pl-3 pr-2 font-mono text-base font-bold text-ink transition-colors focus:bg-lime-soft focus:outline-none"
                        >
                            {COUNTRY_CODES.map((entry) => (
                                <option key={entry.code} value={entry.code}>
                                    {entry.label}
                                </option>
                            ))}
                        </select>

                        <div className="relative min-w-0 flex-1">
                            <span
                                className="pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-ink-45"
                                aria-hidden="true"
                            >
                                <Phone size={18} />
                            </span>
                            <input
                                id="phone"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel-national"
                                placeholder="9876543210"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 14))}
                                aria-describedby="phone-hint"
                                className="w-full rounded-xl border-2 border-ink bg-paper-2 py-4 pl-11 pr-3 font-mono text-lg font-bold text-ink transition-colors placeholder:font-normal placeholder:text-ink-25 focus:bg-lime-soft focus:outline-none"
                                autoFocus
                            />
                        </div>
                    </div>

                    <p id="phone-hint" className="mt-2.5 text-xs text-ink-45">
                        Your number <strong className="font-bold text-ink-70">without</strong> the country
                        code. We will link{" "}
                        <span className="font-mono font-bold text-ink">
                            +{countryCode} {phone || "…"}
                        </span>
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleSignup}
                    disabled={!phoneIsValid || isLoading}
                    className={`group flex w-full items-center justify-center gap-3 rounded-full border-2 border-ink px-6 py-4 font-bold transition-all ${
                        phoneIsValid && !isLoading
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
                            {phoneIsValid && (
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
