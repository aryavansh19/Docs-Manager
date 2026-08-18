import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Check, Loader2, ArrowRight, ShieldCheck, MessageSquare,
    RotateCcw, Copy, LogOut
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { botWhatsAppLink, BOT_NUMBER } from '../lib/config';
import { isWhatsAppVerified } from '../lib/profile';

/**
 * Step one of onboarding, and deliberately a gate.
 *
 * WhatsApp only lets a business message a user inside the 24-hour
 * customer-service window that a *user-initiated* message opens. The folder
 * worker messages the user ("your folders are ready"), so the user must send
 * the first message before anything else happens — otherwise that send is
 * business-initiated, which is billable and rejected as plain text.
 *
 * Hence the whole screen is built around one tap that opens WhatsApp with the
 * message already typed.
 */
const Verify = () => {
    const navigate = useNavigate();
    const reduce = useReducedMotion();

    const [phone, setPhone] = useState(null);
    const [verified, setVerified] = useState(false);
    const [checking, setChecking] = useState(false);
    const [notYet, setNotYet] = useState(false);
    const [opened, setOpened] = useState(false);
    const [copied, setCopied] = useState(false);

    const succeed = useCallback(() => {
        setVerified(true);
        setTimeout(() => navigate('/dashboard'), 1400);
    }, [navigate]);

    // Manual re-check, for when realtime is blocked by a network.
    const checkNow = async () => {
        setChecking(true);
        setNotYet(false);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate('/login'); return; }

        const { data: profile } = await supabase
            .from('profiles')
            .select('status, whatsapp_verified')
            .eq('id', user.id)
            .single();

        if (isWhatsAppVerified(profile)) succeed();
        else {
            setNotYet(true);
            setTimeout(() => setChecking(false), 700);
        }
    };

    useEffect(() => {
        let channel;

        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { navigate('/login'); return; }

            const { data: profile } = await supabase
                .from('profiles')
                .select('phone, status, whatsapp_verified')
                .eq('id', user.id)
                .single();

            if (profile) {
                setPhone(profile.phone);
                if (isWhatsAppVerified(profile)) { succeed(); return; }
            }

            channel = supabase
                .channel(`verify-${user.id}`)
                .on('postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
                    (payload) => { if (isWhatsAppVerified(payload.new)) succeed(); }
                )
                .subscribe();
        };

        setup();
        return () => { if (channel) supabase.removeChannel(channel); };
    }, [navigate, succeed]);

    const copyWord = async () => {
        try {
            await navigator.clipboard.writeText("VERIFY");
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch { /* clipboard unavailable; the deep link already prefills it */ }
    };

    /* ------------------------------------------------------------ success -- */
    if (verified) {
        return (
            <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-5">
                <div className="pointer-events-none absolute inset-0 bg-graph opacity-70" aria-hidden="true" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full max-w-md rounded-2xl border-2 border-ink bg-lime p-10 text-center shadow-brut-lg"
                >
                    <motion.span
                        initial={reduce ? false : { scale: 0, rotate: -120 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 380, damping: 16 }}
                        className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-2xl border-2 border-ink bg-paper text-ink"
                    >
                        <Check size={38} strokeWidth={3.5} />
                    </motion.span>
                    <h1 className="mb-2 font-display text-4xl font-extrabold tracking-tight text-ink">
                        You&apos;re linked.
                    </h1>
                    <p className="text-[15px] text-ink/70">Taking you to your workspace…</p>
                </motion.div>
            </div>
        );
    }

    /* ------------------------------------------------------------ waiting -- */
    return (
        // Fits the viewport on anything laptop-sized and up, so this short page never
        // scrolls. Small screens keep normal document flow, where the content genuinely
        // cannot fit and scrolling is the correct behaviour.
        <div className="relative min-h-dvh bg-paper text-ink roomy:h-dvh roomy:overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-graph opacity-70" aria-hidden="true" />
            {/* flat geometry, no glows */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute -left-32 top-16 h-72 w-72 rounded-full border-2 border-ink/[0.06]" />
                <div className="absolute -right-24 bottom-10 h-64 w-64 rotate-12 rounded-[2.5rem] border-2 border-ink/[0.06]" />
            </div>

            <div className="relative mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
                {/* top bar */}
                <div className="mb-5 flex shrink-0 items-center justify-between lg:mb-6">
                    <Link to="/" className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 place-items-center rounded-lg border-2 border-ink bg-flame font-display text-base font-extrabold text-paper">D</span>
                        <span className="font-display text-lg font-extrabold tracking-tight">DocsFlow</span>
                    </Link>
                    <button
                        type="button"
                        onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
                        className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-3.5 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-45 transition-colors hover:bg-paper-2 hover:text-ink"
                    >
                        <LogOut size={12} /> Sign out
                    </button>
                </div>

                {/* stepper */}
                <div className="mb-6 flex shrink-0 items-center gap-2.5">
                    {[
                        { n: 1, label: "Google", done: true },
                        { n: 2, label: "WhatsApp", done: false, current: true },
                        { n: 3, label: "Folders", done: false },
                    ].map((s, i) => (
                        <React.Fragment key={s.n}>
                            {i > 0 && <span className="h-0.5 w-6 bg-ink/15 sm:w-10" />}
                            <span className="flex items-center gap-2">
                                <span className={`grid h-7 w-7 place-items-center rounded-full border-2 border-ink font-mono text-[11px] font-bold ${
                                    s.done ? "bg-ink text-paper" : s.current ? "bg-lime text-ink" : "bg-paper text-ink-25"
                                }`}>
                                    {s.done ? <Check size={12} strokeWidth={3.5} /> : s.n}
                                </span>
                                <span className={`hidden font-mono text-[10px] font-bold uppercase tracking-widest sm:block ${
                                    s.current ? "text-ink" : "text-ink-45"
                                }`}>
                                    {s.label}
                                </span>
                            </span>
                        </React.Fragment>
                    ))}
                </div>

                {/* min-h-0 lets the columns shrink inside the fixed-height shell rather
                    than pushing the page taller. */}
                {/* my-auto centres the block when there is spare height, and collapses to
                    zero when there is not, so nothing is ever pushed out of view. */}
                <div className="my-auto grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 roomy:min-h-0 roomy:flex-1">
                    {/* ---------------- left: the one action ---------------- */}
                    <div className="min-h-0">
                        <motion.h1
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                            className="mb-3 font-display text-[2.4rem] font-extrabold leading-[0.95] tracking-tight sm:text-5xl xl:text-6xl"
                        >
                            Say hello to
                            <br />
                            <span className="relative inline-block">
                                <span className="relative z-10">your bot.</span>
                                <motion.span
                                    aria-hidden="true"
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    transition={{ delay: 0.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                    className="absolute inset-x-[-0.08em] bottom-[0.12em] z-0 h-[0.3em] origin-left bg-lime"
                                />
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15, duration: 0.5 }}
                            className="mb-6 max-w-lg text-[15px] leading-relaxed text-ink-70 xl:text-[17px]"
                        >
                            One message from you opens the conversation — that&apos;s how
                            WhatsApp works, and it&apos;s why the bot can&apos;t reach out
                            first. Tap below and send the word; everything after that is
                            automatic.
                        </motion.p>

                        {/* primary action */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25, duration: 0.5 }}
                            className="mb-4 flex flex-col gap-3 sm:flex-row"
                        >
                            <a
                                href={botWhatsAppLink("VERIFY")}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setOpened(true)}
                                className="group inline-flex items-center justify-center gap-3 rounded-full border-2 border-ink bg-ink px-7 py-4 text-base font-bold text-paper shadow-brut-pop transition-all hover:bg-teal hover:text-ink hover:shadow-brut"
                            >
                                <MessageSquare size={19} />
                                Open WhatsApp &amp; send
                                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                            </a>

                            <button
                                type="button"
                                onClick={checkNow}
                                disabled={checking}
                                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-paper px-6 py-4 text-sm font-bold text-ink transition-colors hover:bg-lime disabled:opacity-60"
                            >
                                {checking ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                {checking ? "Checking…" : "I've sent it"}
                            </button>
                        </motion.div>

                        <AnimatePresence>
                            {notYet && (
                                <motion.p
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="mb-4 rounded-xl border-2 border-ink bg-sun-soft px-4 py-2.5 text-sm font-bold text-ink"
                                >
                                    Not linked yet — make sure the message actually sent, then try again.
                                </motion.p>
                            )}
                        </AnimatePresence>

                        {/* fallback: manual instructions */}
                        <div className="rounded-2xl border-2 border-ink bg-paper-2 p-4">
                            <p className="eyebrow mb-2.5 text-ink-45">Or do it manually</p>
                            <ol className="space-y-2 text-[13.5px] text-ink-70">
                                <li className="flex gap-2.5">
                                    <span className="font-mono font-bold text-ink">1.</span>
                                    <span>
                                        Message{" "}
                                        <span className="rounded border-2 border-ink bg-paper px-1.5 py-0.5 font-mono text-[12px] font-bold text-ink">
                                            {BOT_NUMBER}
                                        </span>{" "}
                                        on WhatsApp
                                    </span>
                                </li>
                                <li className="flex gap-2.5">
                                    <span className="font-mono font-bold text-ink">2.</span>
                                    <span className="flex flex-wrap items-center gap-2">
                                        Send the single word
                                        <button
                                            type="button"
                                            onClick={copyWord}
                                            className="inline-flex items-center gap-1.5 rounded border-2 border-ink bg-lime px-2 py-0.5 font-mono text-[12px] font-bold text-ink transition-transform hover:-translate-y-0.5"
                                        >
                                            {copied ? <Check size={11} strokeWidth={3.5} /> : <Copy size={11} />}
                                            {copied ? "copied" : "VERIFY"}
                                        </button>
                                    </span>
                                </li>
                            </ol>
                        </div>
                    </div>

                    {/* ---------------- right: live phone preview ---------------- */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col roomy:min-h-0 roomy:max-h-full"
                    >
                        <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-brut-lg roomy:min-h-0">
                            {/* chat header */}
                            <div className="flex shrink-0 items-center gap-3 border-b-2 border-ink bg-paper-2 px-4 py-3">
                                <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-ink bg-teal font-display text-xs font-extrabold text-ink">
                                    DF
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-bold text-ink">DocsFlow Bot</span>
                                    <span className="block font-mono text-[10px] text-ink-45">{BOT_NUMBER}</span>
                                </span>
                                <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-ink-45">
                                    <span className="h-1.5 w-1.5 animate-blink rounded-full bg-teal" />
                                    waiting
                                </span>
                            </div>

                            {/* conversation — grows to fill the card so the panel matches
                                the height of the column instead of leaving dead space */}
                            <div className="min-h-[200px] space-y-3 overflow-y-auto bg-paper-2 bg-dots p-4 roomy:flex-1">
                                {/* the message THEY send */}
                                <motion.div
                                    animate={reduce ? {} : { scale: [1, 1.03, 1] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    className="flex justify-end"
                                >
                                    <span className="rounded-2xl rounded-tr-md border-2 border-ink bg-lime px-4 py-2.5 shadow-brut-xs">
                                        <span className="block font-mono text-[15px] font-bold text-ink">VERIFY</span>
                                        <span className="mt-0.5 block text-right font-mono text-[9px] text-ink/50">you send this</span>
                                    </span>
                                </motion.div>

                                {/* the reply, pending */}
                                <div className="flex justify-start">
                                    <span className="max-w-[85%] rounded-2xl rounded-tl-md border-2 border-dashed border-ink/30 bg-paper/60 px-4 py-3">
                                        <span className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink-25">
                                            <Loader2 size={11} className="animate-spin" />
                                            bot replies here
                                        </span>
                                    </span>
                                </div>
                            </div>

                            {/* status strip */}
                            <div className="flex shrink-0 items-center gap-2.5 border-t-2 border-ink bg-paper px-4 py-3">
                                {opened ? (
                                    <>
                                        <span className="h-2 w-2 animate-blink rounded-full bg-teal" />
                                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
                                            listening for your message
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck size={13} className="text-ink-45" />
                                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink-45">
                                            {phone ? `linking ${phone}` : "loading…"}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        <p className="mt-3 shrink-0 px-1 text-[12px] leading-relaxed text-ink-45">
                            This page updates itself the moment the bot hears from you — no
                            need to refresh.
                        </p>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default Verify;
