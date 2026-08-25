import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
    Folder, FolderTree, Check, Loader2, AlertTriangle,
    HardDrive, RotateCcw, ArrowRight, Sparkles
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { PROFILE_COLUMNS } from "../lib/profile";

/**
 * Live progress for Drive folder creation.
 *
 * The backend does the work in a FastAPI BackgroundTask and only signals
 * completion by setting profiles.status = 'ACTIVE' (realtime is enabled on that
 * table). There is no per-folder progress event and no failure event at all —
 * the worker swallows exceptions — so:
 *
 *   - the step pacing is cosmetic, but it deliberately HOLDS on the final step
 *     until the database confirms, so it can never claim success early;
 *   - a timeout is the only way to detect failure, hence the error state.
 */

const TICK_MS = 320;          // pacing between visual steps
const HOLD_AT = 0.92;         // never advance past this until confirmed
const TIMEOUT_MS = 60000;     // no confirmation by now => assume the worker died

const TINTS = [
    "bg-lime-soft", "bg-cobalt-soft", "bg-magenta-soft",
    "bg-sun-soft", "bg-teal-soft", "bg-violet-soft",
];

/** Flatten the plan into the same order the backend creates folders in. */
function buildSteps(plan, rootLabel) {
    const steps = [{ kind: "root", label: rootLabel, depth: 0, tint: "bg-ink" }];
    Object.entries(plan || {}).forEach(([subject, units], i) => {
        steps.push({ kind: "subject", label: subject, depth: 1, tint: TINTS[i % TINTS.length] });
        (units || []).forEach((unit) =>
            steps.push({ kind: "unit", label: String(unit), depth: 2, tint: TINTS[i % TINTS.length] })
        );
    });
    return steps;
}

function StepRow({ step, state, index }) {
    const reduce = useReducedMotion();
    const isRoot = step.kind === "root";

    return (
        <motion.li
            initial={reduce ? false : { opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: reduce ? 0 : Math.min(index * 0.04, 0.5) }}
            style={{ marginLeft: step.depth * 22 }}
            className="relative"
        >
            {step.depth > 0 && (
                <span
                    aria-hidden="true"
                    className="absolute -left-[13px] top-0 h-full border-l-2 border-dashed border-ink/20"
                />
            )}

            <div
                className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 transition-all duration-300 ${
                    state === "pending"
                        ? "border-dashed border-ink/25 bg-transparent"
                        : `border-ink ${isRoot ? "bg-ink" : step.tint} ${state === "done" ? "shadow-brut-xs" : ""}`
                }`}
            >
                <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 transition-colors ${
                        state === "pending"
                            ? "border-ink/25 text-ink-25"
                            : state === "active"
                                ? "border-ink bg-paper text-ink"
                                : "border-ink bg-paper text-ink"
                    }`}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {state === "done" ? (
                            <motion.span
                                key="done"
                                initial={reduce ? false : { scale: 0, rotate: -90 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                            >
                                <Check size={13} strokeWidth={3.5} />
                            </motion.span>
                        ) : state === "active" ? (
                            <motion.span key="active">
                                <Loader2 size={13} className="animate-spin" />
                            </motion.span>
                        ) : (
                            <motion.span key="idle">
                                {isRoot ? <HardDrive size={13} /> : <Folder size={13} />}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </span>

                <span
                    className={`min-w-0 flex-1 truncate font-mono text-[12.5px] font-bold ${
                        state === "pending"
                            ? "text-ink-25"
                            : isRoot ? "text-paper" : "text-ink"
                    }`}
                >
                    {step.label}
                </span>

                {state === "active" && (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="shrink-0 rounded-full border-2 border-ink bg-paper px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-ink"
                    >
                        creating
                    </motion.span>
                )}
            </div>
        </motion.li>
    );
}

export default function FolderBuildCeremony({
    plan,
    userId,
    phone,
    onComplete,
    onRetry,
    title = "Building your workspace",
    subtitle = "Creating the folder tree inside your Google Drive.",
}) {
    const reduce = useReducedMotion();
    const rootLabel = `SmartDoc AI - ${phone || "you"}`;
    const steps = useMemo(() => buildSteps(plan, rootLabel), [plan, rootLabel]);

    const [cursor, setCursor] = useState(0);      // how many steps are visually done
    const [confirmed, setConfirmed] = useState(false);
    const [failed, setFailed] = useState(false);
    const settled = useRef(false);

    // --- 1. Wait for the database to confirm the worker finished -------------
    useEffect(() => {
        if (!userId) return;
        let channel;
        let timeoutId;
        let pollId;

        const settle = (profile) => {
            if (settled.current) return;
            settled.current = true;
            setConfirmed(true);
            window.clearTimeout(timeoutId);
            window.clearInterval(pollId);
            // Let the completion animation land before handing back.
            window.setTimeout(() => onComplete?.(profile), reduce ? 0 : 900);
        };

        const isDone = (p) => p && p.status === "ACTIVE" && p.root_folder_id;

        channel = supabase
            .channel(`folder-build-${userId}`)
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
                (payload) => { if (isDone(payload.new)) settle(payload.new); }
            )
            .subscribe();

        // Realtime can drop a message; poll as a safety net.
        pollId = window.setInterval(async () => {
            const { data } = await supabase
                .from("profiles").select(PROFILE_COLUMNS).eq("id", userId).single();
            if (isDone(data)) settle(data);
        }, 4000);

        // The worker reports nothing on failure, so a timeout is the only signal.
        timeoutId = window.setTimeout(() => {
            if (!settled.current) {
                settled.current = true;
                window.clearInterval(pollId);
                setFailed(true);
            }
        }, TIMEOUT_MS);

        return () => {
            window.clearTimeout(timeoutId);
            window.clearInterval(pollId);
            if (channel) supabase.removeChannel(channel);
        };
    }, [userId, onComplete, reduce]);

    // --- 2. Pace the visual steps, holding short of the end until confirmed --
    useEffect(() => {
        if (failed) return;
        const ceiling = confirmed ? steps.length : Math.floor(steps.length * HOLD_AT);
        if (cursor >= ceiling) return;

        const id = window.setTimeout(
            () => setCursor((c) => c + 1),
            confirmed ? 90 : TICK_MS
        );
        return () => window.clearTimeout(id);
    }, [cursor, confirmed, failed, steps.length]);

    const total = steps.length;
    const pct = Math.round((cursor / total) * 100);

    if (failed) {
        return (
            <div className="rounded-2xl border-2 border-ink bg-paper p-8 shadow-brut-lg">
                <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border-2 border-ink bg-flame text-paper">
                    <AlertTriangle size={24} />
                </span>
                <h2 className="mb-2 font-display text-2xl font-extrabold tracking-tight">
                    That took longer than expected
                </h2>
                <p className="mb-6 max-w-md text-[15px] leading-relaxed text-ink-70">
                    Your folders may still be on the way. If nothing shows up, the Drive
                    connection likely needs re-authorising.
                </p>
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-5 py-3 text-sm font-bold text-paper shadow-brut-xs transition-colors hover:bg-flame"
                    >
                        <RotateCcw size={15} /> Try again
                    </button>
                    <button
                        type="button"
                        onClick={() => onComplete?.(null)}
                        className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-5 py-3 text-sm font-bold text-ink transition-colors hover:bg-paper-2"
                    >
                        Continue anyway <ArrowRight size={15} />
                    </button>
                </div>
            </div>
        );
    }

    const allDone = confirmed && cursor >= total;

    return (
        <div className="overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-brut-lg">
            {/* Header */}
            <div className="flex items-center gap-4 border-b-2 border-ink bg-lime px-6 py-5">
                <motion.span
                    animate={allDone || reduce ? {} : { rotate: [0, -8, 8, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-ink bg-paper text-ink"
                >
                    {allDone ? <Check size={22} strokeWidth={3} /> : <FolderTree size={22} />}
                </motion.span>
                <div className="min-w-0">
                    <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
                        {allDone ? "Workspace ready" : title}
                    </h2>
                    <p className="truncate text-[13px] text-ink/70">
                        {allDone ? "Taking you to your dashboard…" : subtitle}
                    </p>
                </div>
            </div>

            {/* Progress */}
            <div className="border-b-2 border-ink bg-paper-2 px-6 py-4">
                <div className="mb-2 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-ink-45">
                    <span>{allDone ? "complete" : "creating folders"}</span>
                    <span>{cursor} / {total}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full border-2 border-ink bg-paper">
                    <motion.div
                        className="h-full rounded-full bg-flame"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
                    />
                </div>
            </div>

            {/* Tree */}
            <ul className="custom-scrollbar max-h-[46vh] space-y-2 overflow-y-auto p-6">
                {steps.map((step, i) => (
                    <StepRow
                        key={`${step.kind}-${step.label}-${i}`}
                        step={step}
                        index={i}
                        state={i < cursor ? "done" : i === cursor ? "active" : "pending"}
                    />
                ))}
            </ul>

            {/* Footer note */}
            <div className="flex items-center gap-2.5 border-t-2 border-ink bg-paper-2 px-6 py-3.5">
                <Sparkles size={13} className="shrink-0 text-ink-45" />
                <p className="text-[12px] leading-snug text-ink-45">
                    These live in <span className="font-bold text-ink-70">your</span> Google
                    Drive. You can rename or move them freely afterwards.
                </p>
            </div>
        </div>
    );
}
