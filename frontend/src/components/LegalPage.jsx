import { useEffect } from "react";
import Footer from "./Footer";
import { Reveal, SplitWords } from "../lib/motion";

/**
 * Shared layout for Privacy / Terms.
 * Sections are numbered and get a sticky mini-index on wide screens.
 */
export default function LegalPage({ title, updated, intro, sections, accent = "bg-lime" }) {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="bg-paper text-ink">
            <header className="relative overflow-hidden border-b-2 border-ink bg-paper pb-16 pt-32 sm:pt-36">
                <div className="pointer-events-none absolute inset-0 bg-graph opacity-70" aria-hidden="true" />

                <div className="relative mx-auto max-w-4xl px-6">
                    <Reveal from="up">
                        <span className={`eyebrow mb-5 inline-block rounded-full border-2 border-ink ${accent} px-3.5 py-1.5 text-ink`}>
                            Legal
                        </span>
                    </Reveal>

                    <SplitWords
                        as="h1"
                        text={title}
                        className="mb-5 block font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl"
                    />

                    <Reveal from="up" delay={0.12}>
                        <p className="max-w-2xl text-lg leading-relaxed text-ink-70">{intro}</p>
                    </Reveal>

                    <Reveal from="up" delay={0.2}>
                        <p className="mt-6 font-mono text-[11px] font-bold uppercase tracking-widest text-ink-45">
                            Last updated · {updated}
                        </p>
                    </Reveal>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-6 py-16">
                <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
                    {/* Sticky index */}
                    <nav aria-label="On this page" className="hidden lg:block">
                        <div className="sticky top-28">
                            <h2 className="eyebrow mb-4 text-ink-45">On this page</h2>
                            <ol className="space-y-2.5">
                                {sections.map((section, i) => (
                                    <li key={section.title}>
                                        <a
                                            href={`#section-${i + 1}`}
                                            className="link-wipe text-sm font-semibold text-ink-70 hover:text-ink"
                                        >
                                            {i + 1}. {section.title}
                                        </a>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </nav>

                    <div className="max-w-2xl space-y-10">
                        {sections.map((section, i) => (
                            <Reveal
                                key={section.title}
                                as="section"
                                from="up"
                                id={`section-${i + 1}`}
                                className="scroll-mt-28 rounded-2xl border-2 border-ink bg-paper-2 p-7 shadow-brut-xs"
                            >
                                <div className="mb-4 flex items-center gap-3">
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-paper font-mono text-xs font-bold text-ink">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <h2 className="font-display text-2xl font-extrabold tracking-tight">
                                        {section.title}
                                    </h2>
                                </div>

                                <div className="space-y-4 text-[15px] leading-relaxed text-ink-70">
                                    {section.body}
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
