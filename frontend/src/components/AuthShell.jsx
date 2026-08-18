import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

const ACCENTS = {
    flame: "bg-flame",
    cobalt: "bg-cobalt",
    lime: "bg-lime",
    violet: "bg-violet",
    sun: "bg-sun",
    teal: "bg-teal",
    magenta: "bg-magenta",
};

/**
 * Shared frame for every auth / onboarding screen so they share one identity:
 * warm paper, graph paper grid, flat colour blocks, hard ink borders.
 */
export default function AuthShell({
    children,
    backTo = "/",
    backLabel = "Back",
    accent = "flame",
    maxWidth = "max-w-md",
    footer,
}) {
    return (
        <div className="relative flex min-h-screen flex-col bg-paper text-ink">
            {/* Static geometry — no blurred orbs */}
            <div className="pointer-events-none absolute inset-0 bg-graph opacity-70" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute -left-28 top-1/4 h-64 w-64 rounded-full border-2 border-ink bg-lime-soft" />
                <div className="absolute -right-20 bottom-1/4 h-52 w-52 rotate-12 rounded-3xl border-2 border-ink bg-cobalt-soft" />
            </div>

            <header className="relative z-10 flex items-center justify-between px-6 py-6">
                <Link
                    to={backTo}
                    className="group flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-4 py-2 text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-lime hover:shadow-brut-xs"
                >
                    <ArrowLeft
                        size={16}
                        className="transition-transform group-hover:-translate-x-0.5"
                    />
                    {backLabel}
                </Link>

                <Link to="/" className="flex items-center gap-2.5" aria-label="DocsFlow home">
                    <span className="grid h-9 w-9 place-items-center rounded-lg border-2 border-ink bg-flame font-display text-base font-extrabold text-paper">
                        D
                    </span>
                    <span className="hidden font-display text-lg font-extrabold tracking-tight sm:block">
                        DocsFlow
                    </span>
                </Link>
            </header>

            <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    className={`w-full ${maxWidth}`}
                >
                    <div className="overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-brut-lg">
                        <div
                            className={`h-2.5 border-b-2 border-ink ${ACCENTS[accent] ?? ACCENTS.flame}`}
                            aria-hidden="true"
                        />
                        {children}
                    </div>

                    {footer && (
                        <div className="mt-5 text-center text-sm text-ink-45">{footer}</div>
                    )}
                </motion.div>
            </main>

            <footer className="relative z-10 px-6 py-6 text-center">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-25">
                    DocsFlow · secure connection
                </span>
            </footer>
        </div>
    );
}
