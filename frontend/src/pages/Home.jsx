import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowRight,
    ArrowUpRight,
    FileText,
    MessageSquare,
    Search,
    Send,
    Sparkles,
    UploadCloud,
    ShieldCheck,
    FolderTree,
    Folder,
    Check,
    Plus,
} from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import {
    Reveal,
    SplitWords,
    Parallax,
    VelocityMarquee,
    StickyStack,
    HorizontalScroll,
    Magnetic,
    CountUp,
    ScrollScale,
} from "../lib/motion";

/* ---------------------------------------------------------------- DATA --- */

const CHAT_SLIDES = [
    {
        userMsg: "Find my OS notes from semester 3",
        botMsg: "Found it — /University/Sem3/",
        botFile: "OS_Unit1_Notes.pdf",
    },
    {
        userMsg: "Where is my Aadhaar card?",
        botMsg: "Filed under /Personal/Identity/",
        botFile: null,
    },
    {
        userMsg: "Send my internship offer letter",
        botMsg: "Here it is, from /Career/Internship/",
        botFile: "Offer_Letter.pdf",
    },
    {
        userMsg: "Get all my Uber receipts",
        botMsg: "7 receipts in /Finance/Uber/",
        botFile: null,
    },
    {
        userMsg: "Show my latest resume",
        botMsg: "Latest version coming up",
        botFile: "Resume_v3.pdf",
    },
];

const FEATURES = [
    {
        tag: "01 / Syllabus intelligence",
        title: "Upload a syllabus. Get a whole folder tree.",
        body: "Drop in your course PDF. DocsFlow reads the subjects and units, then builds the matching hierarchy in your Drive. You never create a folder by hand again.",
        icon: FolderTree,
        bg: "bg-lime",
        ink: "text-ink",
        bullets: ["Reads PDFs and images", "Understands units and modules", "Editable before it commits"],
    },
    {
        tag: "02 / WhatsApp native",
        title: "The interface is a chat you already use.",
        body: "No new app, no new login, no dashboard to learn. Forward a document to the bot the same way you forward it to a friend, and it lands in the right place.",
        icon: MessageSquare,
        bg: "bg-cobalt",
        ink: "text-paper",
        bullets: ["Works on any phone", "Nothing to install", "Replies in seconds"],
    },
    {
        tag: "03 / Ask, don't dig",
        title: "Search in plain language, not folder paths.",
        body: "Ask for “last month's rent receipt” or “vaccine certificate”. DocsFlow searches what's inside your files, not just their names, and hands back the link.",
        icon: Search,
        bg: "bg-magenta",
        ink: "text-paper",
        bullets: ["Content-aware search", "Direct Drive links", "No folder spelunking"],
    },
    {
        tag: "04 / Yours, not ours",
        title: "Files pass through. They never stay.",
        body: "Documents are processed in memory and written straight to your own Google Drive. We keep the index that makes search work — never the file itself.",
        icon: ShieldCheck,
        bg: "bg-sun",
        ink: "text-ink",
        bullets: ["Zero file retention", "Your Drive, your ownership", "Revoke access anytime"],
    },
];

const STEPS = [
    {
        num: "01",
        title: "Forward",
        desc: "Send any document to the DocsFlow bot on WhatsApp — a screenshot, a PDF, a phone scan. Anything at all.",
        icon: Send,
        bg: "bg-cobalt",
        tint: "bg-cobalt-soft",
        exampleLabel: "You send",
        example: "IMG_2481.jpg",
    },
    {
        num: "02",
        title: "Understand",
        desc: "It gets read and classified. DocsFlow works out what the document actually is, not just what it is called.",
        icon: Sparkles,
        bg: "bg-violet",
        tint: "bg-violet-soft",
        exampleLabel: "Detected",
        example: "Electricity bill · March",
    },
    {
        num: "03",
        title: "Rename",
        desc: "A meaningless camera filename gets rewritten into something you could actually search for months later.",
        icon: FileText,
        bg: "bg-flame",
        tint: "bg-flame-soft",
        exampleLabel: "Renamed to",
        example: "Electricity_Bill_March.jpg",
    },
    {
        num: "04",
        title: "File",
        desc: "It lands in the right folder in your own Drive, indexed so you can ask the bot for it by name.",
        icon: UploadCloud,
        bg: "bg-teal",
        tint: "bg-teal-soft",
        exampleLabel: "Saved to",
        example: "/Personal/Bills/2026/",
    },
];

// Sample output of the syllabus parser, shown in the "Setup, once" section.
const SYLLABUS_TREE = [
    {
        name: "DBMS",
        color: "bg-cobalt-soft",
        expanded: true,
        units: ["Normalisation", "Transactions", "Indexing"],
    },
    { name: "Operating Systems", color: "bg-lime-soft", units: [1, 2, 3, 4] },
    { name: "Computer Networks", color: "bg-magenta-soft", units: [1, 2, 3, 4, 5] },
    { name: "Data Structures Lab", color: "bg-sun-soft", units: [1, 2, 3] },
];

const STATS = [
    { to: 100, suffix: "%", label: "of files land in your own Drive" },
    { to: 0, suffix: "", label: "documents kept on our servers" },
    { to: 3, suffix: "", label: "steps from chat to filed" },
    { to: 24, suffix: "/7", label: "the bot is awake and listening" },
];

const FAQS = [
    {
        q: "How do I get started?",
        a: "Sign up with your WhatsApp number, connect Google Drive once, then message the bot. That is the whole setup — usually under two minutes.",
    },
    {
        q: "Do you store my documents?",
        a: "No. Files are held in memory only long enough to classify and upload them to your Drive. We store the searchable index and the Drive file ID, never the document.",
    },
    {
        q: "Can I control how folders are organised?",
        a: "Yes. Upload a syllabus to generate a structure automatically, or add subjects and units by hand during setup. You can review and edit everything before it is created.",
    },
    {
        q: "What file types work?",
        a: "PDFs, images and screenshots are the sweet spot, since those are what people actually forward on WhatsApp. Documents are read for content, not just filename.",
    },
    {
        q: "What if I revoke Drive access?",
        a: "Filing stops immediately and nothing new is written. Your existing files stay exactly where they are in your Drive, because they were always yours.",
    },
];

/* ------------------------------------------------------------ PIECES ----- */

function Sticker({ children, className = "", rotate = -3 }) {
    return (
        <span
            style={{ rotate: `${rotate}deg` }}
            className={`inline-block rounded-full border-2 border-ink px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest shadow-brut-xs ${className}`}
        >
            {children}
        </span>
    );
}

function SectionHeading({ eyebrow, title, lead, align = "left" }) {
    const alignment = align === "center" ? "text-center mx-auto items-center" : "text-left";
    return (
        <div className={`flex max-w-3xl flex-col gap-5 ${alignment}`}>
            <Reveal from="up">
                <span className="eyebrow inline-flex items-center gap-2 text-flame">
                    <span className="h-2 w-2 rounded-full bg-flame" />
                    {eyebrow}
                </span>
            </Reveal>
            <SplitWords
                as="h2"
                text={title}
                className="font-display text-4xl font-extrabold leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl"
            />
            {lead && (
                <Reveal from="up" delay={0.1}>
                    <p className="max-w-xl text-lg leading-relaxed text-ink-70">{lead}</p>
                </Reveal>
            )}
        </div>
    );
}

/** WhatsApp-style conversation, restyled to the paper/ink system. */
function ChatBubbles({ userMsg, botMsg, botFile }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="flex h-full flex-col gap-4 p-5 sm:p-6"
        >
            <motion.div
                initial={{ opacity: 0, x: 24, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="flex justify-end"
            >
                <div className="max-w-[78%] rounded-2xl rounded-tr-md border-2 border-ink bg-lime px-4 py-3 shadow-brut-xs">
                    <p className="text-[15px] font-semibold leading-snug text-ink">
                        {userMsg}
                    </p>
                    <span className="mt-1 flex items-center justify-end gap-1 font-mono text-[10px] text-ink/50">
                        10:42 <Check size={11} strokeWidth={3} />
                    </span>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, x: -24, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: 0.34, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="flex justify-start"
            >
                <div className="max-w-[85%] rounded-2xl rounded-tl-md border-2 border-ink bg-paper px-4 py-3 shadow-brut-xs">
                    {botFile && (
                        <div className="mb-2.5 flex items-center gap-3 rounded-xl border-2 border-ink bg-flame-soft p-2.5">
                            <span className="grid h-10 w-9 shrink-0 place-items-center rounded-md border-2 border-ink bg-flame text-paper">
                                <FileText size={16} />
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate font-mono text-xs font-bold text-ink">
                                    {botFile}
                                </span>
                                <span className="block font-mono text-[10px] text-ink-45">
                                    PDF · 2.4 MB
                                </span>
                            </span>
                        </div>
                    )}
                    <p className="text-[15px] leading-snug text-ink">{botMsg}</p>
                    <span className="mt-1 block font-mono text-[10px] text-ink-45">10:42</span>
                </div>
            </motion.div>
        </motion.div>
    );
}

function ChatWindow() {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(
            () => setIndex((prev) => (prev + 1) % CHAT_SLIDES.length),
            4200
        );
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="overflow-hidden rounded-3xl border-2 border-ink bg-paper shadow-brut-xl">
            {/* Window chrome */}
            <div className="flex items-center gap-3 border-b-2 border-ink bg-paper-2 px-4 py-3">
                <span className="flex gap-1.5" aria-hidden="true">
                    <span className="h-3 w-3 rounded-full border-2 border-ink bg-flame" />
                    <span className="h-3 w-3 rounded-full border-2 border-ink bg-sun" />
                    <span className="h-3 w-3 rounded-full border-2 border-ink bg-teal" />
                </span>
                <span className="ml-2 flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-3 py-1 font-mono text-[10px] font-bold text-ink-70">
                    <ShieldCheck size={11} className="text-teal" />
                    docsflow bot
                </span>
                <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-45">
                    <span className="h-2 w-2 animate-blink rounded-full bg-teal" />
                    online
                </span>
            </div>

            <div className="relative h-[330px] bg-paper-2 bg-dots sm:h-[380px]">
                <AnimatePresence mode="wait">
                    <ChatBubbles key={index} {...CHAT_SLIDES[index]} />
                </AnimatePresence>
            </div>

            {/* Slide selector */}
            <div className="flex items-center gap-2 border-t-2 border-ink bg-paper px-5 py-3.5">
                {CHAT_SLIDES.map((slide, i) => (
                    <button
                        key={slide.userMsg}
                        type="button"
                        onClick={() => setIndex(i)}
                        aria-label={`Show example: ${slide.userMsg}`}
                        aria-current={i === index}
                        className={`h-2.5 rounded-full border-2 border-ink transition-all ${
                            i === index ? "w-8 bg-flame" : "w-2.5 bg-paper hover:bg-lime"
                        }`}
                    />
                ))}
                <span className="ml-auto font-mono text-[10px] font-bold uppercase tracking-widest text-ink-45">
                    live demo
                </span>
            </div>
        </div>
    );
}

function FeatureCard({ feature }) {
    const Icon = feature.icon;
    return (
        <article
            className={`card-brut ${feature.bg} ${feature.ink} overflow-hidden p-8 shadow-brut-lg sm:p-10`}
        >
            <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
                <div>
                    <span className="mb-5 inline-block rounded-full border-2 border-ink bg-paper px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
                        {feature.tag}
                    </span>
                    <h3
                        className={`mb-4 font-display text-3xl font-extrabold leading-[1.02] tracking-tight sm:text-4xl ${feature.ink}`}
                    >
                        {feature.title}
                    </h3>
                    <p className="max-w-lg text-[17px] leading-relaxed opacity-80">
                        {feature.body}
                    </p>
                </div>

                <div className="flex flex-col gap-4">
                    <span className="grid h-16 w-16 place-items-center rounded-2xl border-2 border-ink bg-paper text-ink shadow-brut-xs">
                        <Icon size={28} strokeWidth={2} />
                    </span>
                    <ul className="space-y-2.5">
                        {feature.bullets.map((bullet) => (
                            <li key={bullet} className="flex items-start gap-2.5">
                                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-ink bg-paper text-ink">
                                    <Check size={11} strokeWidth={3.5} />
                                </span>
                                <span className="text-sm font-semibold">{bullet}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </article>
    );
}

function FaqRow({ faq, isOpen, onToggle, index }) {
    const panelId = `faq-panel-${index}`;
    const buttonId = `faq-button-${index}`;

    return (
        <div
            className={`overflow-hidden rounded-2xl border-2 border-ink transition-colors ${
                isOpen ? "bg-lime shadow-brut" : "bg-paper shadow-brut-xs"
            }`}
        >
            <h3>
                <button
                    id={buttonId}
                    type="button"
                    onClick={onToggle}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
                >
                    <span className="font-display text-lg font-extrabold tracking-tight sm:text-xl">
                        {faq.q}
                    </span>
                    <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-ink transition-transform duration-300 ${
                            isOpen ? "rotate-45 bg-ink text-paper" : "bg-paper text-ink"
                        }`}
                        aria-hidden="true"
                    >
                        <Plus size={16} strokeWidth={3} />
                    </span>
                </button>
            </h3>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        id={panelId}
                        role="region"
                        aria-labelledby={buttonId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                    >
                        <p className="border-t-2 border-ink/15 px-5 py-5 text-[15px] leading-relaxed text-ink/80 sm:px-6">
                            {faq.a}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* -------------------------------------------------------------- PAGE ----- */

export default function Home() {
    const [openFaq, setOpenFaq] = useState(0);

    return (
        <div className="relative overflow-x-clip bg-paper text-ink">
            {/* ======================= HERO ======================= */}
            <section className="relative overflow-hidden border-b-2 border-ink bg-paper pb-20 pt-32 sm:pt-36">
                <div className="pointer-events-none absolute inset-0 bg-graph opacity-70" aria-hidden="true" />

                {/* Flat colour shapes instead of blurred orbs */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                    <Parallax distance={60} className="absolute -left-24 top-24">
                        <div className="h-56 w-56 rounded-full border-2 border-ink bg-lime opacity-70" />
                    </Parallax>
                    <Parallax distance={-80} className="absolute -right-16 top-8">
                        <div className="h-40 w-40 rotate-12 rounded-3xl border-2 border-ink bg-magenta-soft" />
                    </Parallax>
                    <Parallax distance={50} className="absolute bottom-10 right-1/4">
                        <div className="h-24 w-24 rounded-full border-2 border-ink bg-cobalt-soft" />
                    </Parallax>
                </div>

                <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[1.05fr_0.95fr]">
                    <div>
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="mb-7 flex flex-wrap items-center gap-3"
                        >
                            <Sticker className="bg-lime" rotate={-2}>
                                WhatsApp → AI → Drive
                            </Sticker>
                            <Sticker className="bg-paper" rotate={2}>
                                No app to install
                            </Sticker>
                        </motion.div>

                        <h1 className="mb-6 font-display text-[3.25rem] font-extrabold leading-[0.9] tracking-tight sm:text-7xl lg:text-[5.5rem]">
                            <SplitWords text="Forward it." className="block" delay={0.05} />
                            <SplitWords text="Forget it." className="block text-flame" delay={0.16} />
                            <span className="block">
                                <SplitWords text="It's" className="inline" delay={0.28} />{" "}
                                <span className="relative inline-block">
                                    <SplitWords text="filed." className="relative z-10 inline" delay={0.34} />
                                    <motion.span
                                        aria-hidden="true"
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ delay: 0.85, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                                        className="absolute inset-x-[-0.1em] bottom-[0.12em] z-0 h-[0.28em] origin-left bg-lime"
                                    />
                                </span>
                            </span>
                        </h1>

                        <Reveal from="up" delay={0.5}>
                            <p className="mb-9 max-w-lg text-lg leading-relaxed text-ink-70 sm:text-xl">
                                Send any document to WhatsApp. DocsFlow reads it, gives it a
                                real name, and drops it in exactly the right Google Drive
                                folder.
                            </p>
                        </Reveal>

                        <Reveal from="up" delay={0.6}>
                            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center">
                                <Magnetic strength={0.22}>
                                    <Link
                                        to="/auth"
                                        className="group flex items-center justify-center gap-2.5 rounded-full border-2 border-ink bg-ink px-8 py-4 text-base font-bold text-paper shadow-brut transition-colors hover:bg-flame"
                                    >
                                        Start organizing
                                        <ArrowRight
                                            size={18}
                                            className="transition-transform group-hover:translate-x-1"
                                        />
                                    </Link>
                                </Magnetic>
                                <Link
                                    to="/login"
                                    className="flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-paper px-8 py-4 text-base font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-lime hover:shadow-brut-xs"
                                >
                                    Log in
                                </Link>
                            </div>
                        </Reveal>

                        <Reveal from="up" delay={0.72}>
                            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5">
                                {["Zero file retention", "Your own Drive", "Free to start"].map(
                                    (item) => (
                                        <li
                                            key={item}
                                            className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink-45"
                                        >
                                            <Check size={13} strokeWidth={3} className="text-teal" />
                                            {item}
                                        </li>
                                    )
                                )}
                            </ul>
                        </Reveal>
                    </div>

                    <Reveal from="right" delay={0.3} amount={0.1}>
                        <Parallax distance={28}>
                            <ChatWindow />
                        </Parallax>
                    </Reveal>
                </div>
            </section>

            {/* ==================== TICKER ==================== */}
            <div className="border-b-2 border-ink bg-flame py-4">
                <VelocityMarquee
                    baseVelocity={3.5}
                    itemClassName="font-display text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-paper pr-8"
                >
                    Receipts · Notes · Certificates · Bills · ID cards · Assignments ·
                    Screenshots · Offer letters ·{" "}
                </VelocityMarquee>
            </div>

            {/* ==================== FEATURES (sticky stack) ==================== */}
            <section id="features" className="border-b-2 border-ink bg-paper-2 py-24">
                <div className="mx-auto max-w-6xl px-6">
                    <SectionHeading
                        eyebrow="What it does"
                        title="Four things, done properly."
                        lead="No feature grid of vague promises. Here is exactly what happens when you hand DocsFlow a document."
                    />

                    <StickyStack className="mt-16" topOffset={110} step={14}>
                        {FEATURES.map((feature) => (
                            <FeatureCard key={feature.tag} feature={feature} />
                        ))}
                    </StickyStack>
                </div>
            </section>

            {/* ============ WORKFLOW (pinned horizontal scroll) ============ */}
            {/* Do NOT add overflow-hidden here. It would become the scrollport for
                the pinned track inside HorizontalScroll, which kills position:sticky
                and leaves the section's scroll budget as dead empty space. The
                backdrop clips itself, and the sticky viewport clips its own overflow. */}
            <section
                id="how-it-works"
                className="relative border-b-2 border-ink bg-ink bg-graph-invert"
            >
                <div className="mx-auto max-w-6xl px-6 pt-16">
                    <div className="flex max-w-3xl flex-col gap-4">
                        <Reveal from="up">
                            <span className="eyebrow inline-flex items-center gap-2 text-lime">
                                <span className="h-2 w-2 rounded-full bg-lime" />
                                The workflow
                            </span>
                        </Reveal>
                        <SplitWords
                            as="h2"
                            text="From chat to filed, in four moves."
                            className="font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-paper sm:text-5xl"
                        />
                        <Reveal from="up" delay={0.1}>
                            <p className="flex items-center gap-2.5 text-[17px] leading-relaxed text-paper/60">
                                Keep scrolling — the track moves sideways.
                                <ArrowRight size={17} className="text-lime" />
                            </p>
                        </Reveal>
                    </div>
                </div>

                {/* Left padding aligns the first card with the container; the right
                    side stays narrow so the pan does not end on empty space. The
                    negative top margin lifts the track above dead centre so it sits
                    closer to the heading while the section is scrolling in. */}
                <HorizontalScroll
                    className="relative"
                    speed={1.8}
                    trackClassName="-mt-[6vh] lg:pl-[max(1.5rem,calc((100vw-72rem)/2))]"
                    backdrop={
                        <div className="absolute inset-0 overflow-hidden">
                            {/* The dashed rail the cards ride along, aligned to the
                                same -6vh offset as the track */}
                            <div className="absolute inset-x-0 top-[calc(50%-6vh)] border-t-2 border-dashed border-paper/15" />

                            {/* Rail tick marks */}
                            <div className="absolute inset-x-0 top-[calc(50%-6vh)] flex -translate-y-1/2 justify-between px-[8vw]">
                                {Array.from({ length: 7 }).map((_, i) => (
                                    <span
                                        key={i}
                                        className={`h-2 w-2 rotate-45 border border-paper/25 ${
                                            i % 3 === 1 ? "bg-lime/70" : "bg-transparent"
                                        }`}
                                    />
                                ))}
                            </div>

                            {/* Oversized outlined geometry — flat, no glow */}
                            <div className="absolute -left-24 top-[8%] h-72 w-72 rounded-full border-2 border-paper/[0.07]" />
                            <div className="absolute -left-10 top-[18%] h-40 w-40 rounded-full border-2 border-paper/[0.05]" />
                            <div className="absolute -right-20 bottom-[6%] h-64 w-64 rotate-12 rounded-[2rem] border-2 border-paper/[0.07]" />
                            <div className="absolute right-[18%] top-[10%] h-16 w-16 -rotate-12 rounded-xl border-2 border-lime/25" />
                            <div className="absolute left-[38%] bottom-[10%] h-3 w-3 rounded-full bg-flame/50" />
                            <div className="absolute left-[62%] top-[14%] h-3 w-3 rounded-full bg-lime/40" />

                            {/* Corner index, like a printed page marker */}
                            <span className="absolute bottom-8 right-8 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-paper/20">
                                01 — 04
                            </span>
                        </div>
                    }
                >
                    {STEPS.map((step) => {
                        const Icon = step.icon;
                        return (
                            <article
                                key={step.num}
                                className="group relative flex h-[380px] w-[84vw] shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-brut-lg transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-2 hover:-rotate-1 hover:shadow-brut-xl sm:w-[380px]"
                            >
                                {/* Colour lives in the band, so the card body stays
                                    paper-and-ink like the rest of the site */}
                                <div
                                    className={`flex shrink-0 items-center justify-between border-b-2 border-ink ${step.bg} px-4 py-4`}
                                >
                                    {/* Step number as a full badge — the old 10px chip
                                        was unreadable, and the faint watermark it paired
                                        with sat behind the example panel */}
                                    <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-paper font-display text-2xl font-extrabold leading-none tracking-tight text-ink">
                                        {step.num}
                                    </span>
                                    <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-paper text-ink transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">
                                        <Icon size={20} />
                                    </span>
                                </div>

                                <div className="relative flex flex-1 flex-col p-6">
                                    <h3 className="mb-2.5 font-display text-4xl font-extrabold tracking-tight text-ink">
                                        {step.title}
                                    </h3>
                                    <p className="mb-5 text-[15px] leading-relaxed text-ink-70">
                                        {step.desc}
                                    </p>

                                    <div
                                        className={`mt-auto rounded-xl border-2 border-ink ${step.tint} px-4 py-3`}
                                    >
                                        <span className="mb-0.5 block font-mono text-[9px] font-bold uppercase tracking-widest text-ink-45">
                                            {step.exampleLabel}
                                        </span>
                                        <span className="block break-all font-mono text-[12.5px] font-bold text-ink">
                                            {step.example}
                                        </span>
                                    </div>
                                </div>
                            </article>
                        );
                    })}

                    {/* Closing card doubles as a CTA */}
                    <article className="group relative flex h-[380px] w-[84vw] shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-brut-lg transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-2 hover:-rotate-1 hover:shadow-brut-xl sm:w-[380px]">
                        <div className="flex shrink-0 items-center justify-between border-b-2 border-ink bg-lime px-4 py-4">
                            <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-paper text-ink">
                                <Check size={22} strokeWidth={3} />
                            </span>
                            <span className="pr-1 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-ink">
                                Done
                            </span>
                        </div>

                        <div className="relative flex flex-1 flex-col p-6">
                            <h3 className="mb-2.5 font-display text-4xl font-extrabold tracking-tight text-ink">
                                That's it.
                            </h3>
                            <p className="mb-5 text-[15px] leading-relaxed text-ink-70">
                                Four steps, and you did exactly one of them. Set it up once
                                and the rest runs without you touching a folder again.
                            </p>

                            <Link
                                to="/auth"
                                className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-flame px-5 py-3.5 text-sm font-bold text-paper transition-transform duration-300 hover:-translate-y-0.5"
                            >
                                Try it now <ArrowUpRight size={16} />
                            </Link>
                        </div>
                    </article>
                </HorizontalScroll>
            </section>

            {/* ==================== NUMBERS ==================== */}
            <section id="numbers" className="border-b-2 border-ink bg-paper py-24">
                <div className="mx-auto max-w-6xl px-6">
                    <SectionHeading
                        eyebrow="The shape of it"
                        title="Boring numbers. That's the point."
                    />

                    <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {STATS.map((stat, i) => (
                            <Reveal key={stat.label} from="up" delay={i * 0.08}>
                                <div className="card-lift h-full bg-paper-2 p-7">
                                    <div className="mb-3 font-display text-6xl font-extrabold tracking-tighter text-ink">
                                        <CountUp to={stat.to} suffix={stat.suffix} />
                                    </div>
                                    <p className="text-[15px] font-semibold leading-snug text-ink-70">
                                        {stat.label}
                                    </p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ==================== SYLLABUS SHOWCASE ==================== */}
            <section className="overflow-hidden border-b-2 border-ink bg-violet py-24">
                <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2">
                    <div>
                        <Reveal from="up">
                            <span className="eyebrow mb-5 inline-flex items-center gap-2 text-lime">
                                <span className="h-2 w-2 rounded-full bg-lime" />
                                Setup, once
                            </span>
                        </Reveal>
                        <SplitWords
                            as="h2"
                            text="One syllabus in. A term's worth of folders out."
                            className="mb-6 font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-paper sm:text-5xl"
                        />
                        <Reveal from="up" delay={0.1}>
                            <p className="mb-8 max-w-lg text-lg leading-relaxed text-paper/70">
                                DocsFlow reads your course document, pulls out every subject
                                and unit, and shows you the tree before it creates anything.
                                Edit it, then commit.
                            </p>
                        </Reveal>
                        <Reveal from="up" delay={0.18}>
                            <Link
                                to="/auth"
                                className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-lime px-7 py-3.5 font-bold text-ink shadow-brut transition-transform hover:-translate-y-0.5"
                            >
                                Build my folders <ArrowRight size={18} />
                            </Link>
                        </Reveal>
                    </div>

                    {/* Content stays visible regardless of scroll state — only the
                        scale is animated, so nothing can get stranded hidden. */}
                    <Reveal from="right" amount={0.1}>
                        <ScrollScale fromScale={0.92} fromRotate={1.5}>
                            <div className="card-brut overflow-hidden bg-paper shadow-brut-xl">
                                {/* Card chrome */}
                                <div className="flex items-center justify-between border-b-2 border-ink bg-paper-2 px-5 py-3.5">
                                    <span className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink-45">
                                        <FolderTree size={13} className="text-ink" />
                                        generated tree
                                    </span>
                                    <span className="rounded-full border-2 border-ink bg-teal-soft px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">
                                        editable
                                    </span>
                                </div>

                                <div className="p-5">
                                    {/* Drive root */}
                                    <div className="mb-3 flex items-center gap-2.5 rounded-xl border-2 border-ink bg-ink px-4 py-2.5">
                                        <Folder size={14} className="text-lime" />
                                        <span className="font-mono text-xs font-bold text-paper">
                                            My Drive / DocsFlow
                                        </span>
                                    </div>

                                    <ul className="space-y-2">
                                        {SYLLABUS_TREE.map((subject) => (
                                            <li key={subject.name}>
                                                <div
                                                    className={`flex items-center justify-between rounded-xl border-2 border-ink ${subject.color} px-4 py-2.5`}
                                                >
                                                    <span className="flex items-center gap-2.5 font-mono text-[13px] font-bold text-ink">
                                                        <Folder size={14} />
                                                        {subject.name}
                                                    </span>
                                                    <span className="font-mono text-[10px] font-bold text-ink-70">
                                                        {subject.units.length} units
                                                    </span>
                                                </div>

                                                {/* One subject shown expanded, to imply depth */}
                                                {subject.expanded && (
                                                    <ul className="mt-2 space-y-1.5 border-l-2 border-dashed border-ink/30 pl-4">
                                                        {subject.units.map((unit) => (
                                                            <li
                                                                key={unit}
                                                                className="flex items-center gap-2 rounded-lg border-2 border-ink bg-paper-2 px-3 py-1.5"
                                                            >
                                                                <FileText size={12} className="text-ink-45" />
                                                                <span className="font-mono text-[11px] font-semibold text-ink-70">
                                                                    {unit}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Card footer summary */}
                                <div className="flex items-center justify-between border-t-2 border-ink bg-paper-2 px-5 py-3.5">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink-45">
                                        4 subjects · 17 folders
                                    </span>
                                    <span className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-lime px-3 py-1 font-mono text-[10px] font-bold uppercase text-ink">
                                        <Check size={11} strokeWidth={3.5} />
                                        ready
                                    </span>
                                </div>
                            </div>
                        </ScrollScale>
                    </Reveal>
                </div>
            </section>

            {/* ==================== FAQ ==================== */}
            {/* No bottom border here: the footer already draws its own top border,
                and two adjacent 2px borders rendered as one 4px line. */}
            <section id="faq" className="bg-paper-2 py-24">
                <div className="mx-auto max-w-6xl px-6">
                    <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
                        <div className="lg:sticky lg:top-28 lg:self-start">
                            <SectionHeading
                                eyebrow="Questions"
                                title="The honest answers."
                                lead="Short, specific, no marketing hedging."
                            />
                        </div>

                        <div className="space-y-3.5">
                            {FAQS.map((faq, i) => (
                                <Reveal key={faq.q} from="up" delay={i * 0.05}>
                                    <FaqRow
                                        faq={faq}
                                        index={i}
                                        isOpen={openFaq === i}
                                        onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                                    />
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
