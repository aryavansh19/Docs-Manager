import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { LogIn, UserPlus, ArrowRight } from "lucide-react";
import AuthShell from "../components/AuthShell";

const OPTIONS = [
    {
        to: "/login",
        icon: LogIn,
        title: "Log in",
        body: "You already have an account. Pick up where you left off.",
        accent: "bg-lime",
        badge: "Returning",
    },
    {
        to: "/signup",
        icon: UserPlus,
        title: "Create account",
        body: "New here. Link WhatsApp and Drive, then start forwarding.",
        accent: "bg-cobalt",
        badge: "New",
        invert: true,
    },
];

export default function AuthOptions() {
    return (
        <AuthShell backTo="/" backLabel="Back to home" accent="cobalt" maxWidth="max-w-3xl">
            <div className="p-8 sm:p-10">
                <div className="mb-9 text-center">
                    <span className="eyebrow mb-4 inline-block rounded-full border-2 border-ink bg-lime px-3.5 py-1.5 text-ink">
                        Welcome
                    </span>
                    <h1 className="mb-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                        How do you want in?
                    </h1>
                    <p className="mx-auto max-w-sm text-[15px] leading-relaxed text-ink-70">
                        Two doors, same workspace. Pick whichever fits.
                    </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                    {OPTIONS.map((option, i) => {
                        const Icon = option.icon;
                        return (
                            <motion.div
                                key={option.to}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.12 + i * 0.1, duration: 0.5 }}
                            >
                                <Link
                                    to={option.to}
                                    className={`card-press group flex h-full flex-col gap-5 p-7 ${option.accent} ${
                                        option.invert ? "text-paper" : "text-ink"
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <span className="grid h-14 w-14 place-items-center rounded-2xl border-2 border-ink bg-paper text-ink">
                                            <Icon size={26} />
                                        </span>
                                        <span className="rounded-full border-2 border-ink bg-paper px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
                                            {option.badge}
                                        </span>
                                    </div>

                                    <div className="flex-1">
                                        <h2
                                            className={`mb-2 font-display text-2xl font-extrabold tracking-tight ${
                                                option.invert ? "text-paper" : "text-ink"
                                            }`}
                                        >
                                            {option.title}
                                        </h2>
                                        <p className="text-sm leading-relaxed opacity-80">
                                            {option.body}
                                        </p>
                                    </div>

                                    <span className="inline-flex items-center gap-2 text-sm font-bold">
                                        Continue
                                        <ArrowRight
                                            size={16}
                                            className="transition-transform group-hover:translate-x-1"
                                        />
                                    </span>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </AuthShell>
    );
}
