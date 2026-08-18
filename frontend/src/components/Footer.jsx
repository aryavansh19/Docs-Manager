import { Github, Twitter, Linkedin, Mail, ArrowUpRight, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { VelocityMarquee, Reveal } from "../lib/motion";
import { botWhatsAppLink } from "../lib/config";

const COLUMNS = [
    {
        heading: "Product",
        links: [
            { label: "Features", to: "/#features" },
            { label: "Workflow", to: "/#how-it-works" },
            { label: "Log in", to: "/login" },
            { label: "Sign up", to: "/signup" },
        ],
    },
    {
        heading: "Resources",
        links: [
            { label: "FAQ", to: "/#faq" },
            { label: "Numbers", to: "/#numbers" },
            { label: "Privacy", to: "/privacy" },
            { label: "Terms", to: "/terms" },
        ],
    },
];

const SOCIALS = [
    { icon: Github, label: "GitHub", href: "https://github.com/aryavansh19" },
    { icon: Twitter, label: "Twitter", href: "#" },
    { icon: Linkedin, label: "LinkedIn", href: "#" },
    { icon: Mail, label: "Email", href: "mailto:support@docsflow.com" },
];

export default function Footer() {
    // Deepest paper tone: the section above is bg-paper-2, and the CTA block that
    // used to separate them is gone, so the footer carries its own tone to stay
    // distinct and ground the bottom of the page.
    return (
        <footer className="relative z-10 border-t-2 border-ink bg-paper-3">
            {/* Scroll-reactive ticker that doubles as a divider */}
            <div className="border-b-2 border-ink bg-lime py-3">
                <VelocityMarquee
                    baseVelocity={2}
                    itemClassName="font-display text-xl font-extrabold uppercase tracking-tight text-ink pr-6"
                >
                    Forward it · Sorted · Filed · Found in seconds · Forward it · Sorted ·
                    Filed · Found in seconds ·{" "}
                </VelocityMarquee>
            </div>

            <div className="mx-auto max-w-6xl px-6 py-16">
                {/* Spans must total 12 per row, or items wrap onto a new row.
                    md: 6 + 3 + 3 = 12, then the CTA takes a full second row.
                    lg: 4 + 2 + 2 + 4 = 12, so the CTA sits on the right. */}
                <div className="grid gap-8 md:grid-cols-12 lg:gap-10">
                    <Reveal className="md:col-span-6 lg:col-span-4" from="up">
                        <Link
                            to="/"
                            className="mb-5 inline-flex items-center gap-2.5"
                            aria-label="DocsFlow home"
                        >
                            <span className="grid h-9 w-9 place-items-center rounded-lg border-2 border-ink bg-flame font-display text-base font-extrabold text-paper">
                                D
                            </span>
                            <span className="font-display text-xl font-extrabold tracking-tight">
                                DocsFlow
                            </span>
                        </Link>
                        <p className="mb-6 max-w-sm text-[15px] leading-relaxed text-ink-70">
                            Forward a document to WhatsApp. It gets read, renamed and filed
                            into the right Google Drive folder. No apps, no dragging, no
                            folders to maintain.
                        </p>
                        <div className="flex gap-2.5">
                            {SOCIALS.map(({ icon: Icon, label, href }) => (
                                <a
                                    key={label}
                                    href={href}
                                    aria-label={label}
                                    target={href.startsWith("http") ? "_blank" : undefined}
                                    rel={href.startsWith("http") ? "noreferrer" : undefined}
                                    className="grid h-10 w-10 place-items-center rounded-lg border-2 border-ink bg-paper text-ink transition-all hover:-translate-y-0.5 hover:bg-lime hover:shadow-brut-xs"
                                >
                                    <Icon size={16} />
                                </a>
                            ))}
                        </div>
                    </Reveal>

                    {COLUMNS.map((column, i) => (
                        <Reveal
                            key={column.heading}
                            className="md:col-span-3 lg:col-span-2"
                            from="up"
                            delay={0.08 * (i + 1)}
                        >
                            <h2 className="eyebrow mb-4 text-ink-45">{column.heading}</h2>
                            <ul className="space-y-2.5">
                                {column.links.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            to={link.to}
                                            className="link-wipe text-[15px] font-medium text-ink-70 hover:text-ink"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </Reveal>
                    ))}

                    <Reveal className="md:col-span-12 lg:col-span-4" from="up" delay={0.24}>
                        <div className="card-brut flex h-full flex-col bg-cobalt p-6 text-paper">
                            <h2 className="mb-2 font-display text-2xl font-extrabold text-paper">
                                Ready to start?
                            </h2>
                            <p className="mb-5 text-sm leading-relaxed text-paper/80">
                                Connect Drive once. Everything after that happens in chat.
                            </p>
                            <a
                                href={botWhatsAppLink()}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-auto mb-2.5 inline-flex w-fit items-center gap-2 text-sm font-bold text-paper/80 transition-colors hover:text-paper"
                            >
                                <MessageSquare size={15} /> Try the bot
                            </a>
                            <Link
                                to="/auth"
                                className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-lime px-5 py-2.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5"
                            >
                                Get started <ArrowUpRight size={16} />
                            </Link>
                        </div>
                    </Reveal>
                </div>
            </div>

            <div className="border-t-2 border-ink">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs font-medium text-ink-45 sm:flex-row">
                    <p>© {new Date().getFullYear()} DocsFlow. Built in the open.</p>
                    <div className="flex gap-5">
                        <Link to="/privacy" className="link-wipe hover:text-ink">
                            Privacy
                        </Link>
                        <Link to="/terms" className="link-wipe hover:text-ink">
                            Terms
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
