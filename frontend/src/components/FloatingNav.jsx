import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
    motion,
    AnimatePresence,
    useScroll,
    useMotionValueEvent,
} from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { ScrollProgress } from "../lib/motion";

const NAV_LINKS = [
    { label: "Features", id: "features" },
    { label: "Workflow", id: "how-it-works" },
    { label: "Numbers", id: "numbers" },
    { label: "FAQ", id: "faq" },
];

// Routes that render their own full-screen chrome.
const HIDDEN_ON = [
    "/dashboard",
    "/auth",
    "/login",
    "/signup",
    "/setup",
    "/verify",
];

export default function FloatingNav() {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const lastY = useRef(0);
    const { scrollY } = useScroll();

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = lastY.current;
        // Reveal on scroll up, conceal on scroll down — never permanently gone.
        if (latest > previous && latest > 320) setHidden(true);
        else if (latest < previous) setHidden(false);

        setScrolled(latest > 40);
        lastY.current = latest;
    });

    // Lock page scroll and wire Escape while the mobile sheet is open.
    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event) => {
            if (event.key === "Escape") setIsOpen(false);
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [isOpen]);

    const isHiddenRoute = HIDDEN_ON.some((path) =>
        location.pathname.startsWith(path)
    );
    if (isHiddenRoute) return null;

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <>
            <ScrollProgress />

            <motion.header
                initial={{ y: -120 }}
                animate={{ y: hidden ? -120 : 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6"
            >
                <nav
                    aria-label="Main"
                    className={`mx-auto flex items-center justify-between gap-4 rounded-full border-2 px-4 py-3 transition-all duration-300 sm:px-6 ${
                        scrolled
                            ? "max-w-4xl border-ink bg-paper shadow-brut"
                            : "max-w-6xl border-transparent bg-transparent"
                    }`}
                >
                    <Link
                        to="/"
                        className="group flex shrink-0 items-center gap-2.5"
                        aria-label="DocsFlow home"
                    >
                        <span className="grid h-9 w-9 place-items-center rounded-lg border-2 border-ink bg-flame font-display text-base font-extrabold text-paper transition-transform duration-300 group-hover:-rotate-12">
                            D
                        </span>
                        <span className="font-display text-xl font-extrabold tracking-tight text-ink">
                            DocsFlow
                        </span>
                    </Link>

                    <div className="hidden items-center gap-1 md:flex">
                        {NAV_LINKS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => scrollToSection(item.id)}
                                className="rounded-full px-4 py-2 text-sm font-semibold text-ink-70 transition-colors hover:bg-lime hover:text-ink"
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <Link
                            to="/auth"
                            className="group hidden items-center gap-2 rounded-full border-2 border-ink bg-ink px-5 py-2.5 text-sm font-bold text-paper shadow-brut-xs transition-all hover:bg-flame hover:text-ink sm:flex"
                        >
                            Start Organizing
                            <ArrowUpRight
                                size={16}
                                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                            />
                        </Link>

                        <button
                            type="button"
                            className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-paper text-ink transition-colors hover:bg-lime md:hidden"
                            onClick={() => setIsOpen(true)}
                            aria-label="Open navigation menu"
                            aria-expanded={isOpen}
                        >
                            <Menu size={18} />
                        </button>
                    </div>
                </nav>
            </motion.header>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Navigation menu"
                        initial={{ clipPath: "inset(0 0 100% 0)" }}
                        animate={{ clipPath: "inset(0 0 0% 0)" }}
                        exit={{ clipPath: "inset(0 0 100% 0)" }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed inset-0 z-[70] flex flex-col bg-paper bg-dots md:hidden"
                    >
                        <div className="flex items-center justify-between border-b-2 border-ink px-6 py-5">
                            <span className="font-display text-xl font-extrabold">Menu</span>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-flame text-paper"
                                aria-label="Close navigation menu"
                                autoFocus
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <nav
                            aria-label="Mobile"
                            className="flex flex-1 flex-col justify-center gap-2 px-6"
                        >
                            {NAV_LINKS.map((item, i) => (
                                <motion.button
                                    key={item.id}
                                    type="button"
                                    initial={{ opacity: 0, x: -30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.15 + i * 0.07, duration: 0.5 }}
                                    onClick={() => {
                                        scrollToSection(item.id);
                                        setIsOpen(false);
                                    }}
                                    className="border-b-2 border-ink/10 py-4 text-left font-display text-4xl font-extrabold tracking-tight text-ink transition-colors hover:text-flame"
                                >
                                    {item.label}
                                </motion.button>
                            ))}
                        </nav>

                        <div className="p-6">
                            <Link
                                to="/auth"
                                onClick={() => setIsOpen(false)}
                                className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink py-4 font-bold text-paper shadow-brut"
                            >
                                Start Organizing <ArrowUpRight size={18} />
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
