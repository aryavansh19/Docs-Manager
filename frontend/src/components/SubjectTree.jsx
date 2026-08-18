import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Folder, Plus, X } from "lucide-react";

/**
 * Editable subject/unit tree.
 *
 * Shared by the workspace setup screen and the first-run folder screen so both offer the
 * same behaviour: expand a subject to see the folders nested inside it, add or remove
 * units, and remove a subject entirely. Previously the first-run screen showed a flat,
 * read-only preview where nested folders were only hinted at with a "+2 inside" label.
 */

const UNIT_TINTS = ["bg-lime-soft", "bg-cobalt-soft", "bg-magenta-soft", "bg-sun-soft", "bg-teal-soft"];

export function SubjectRow({
    subject,
    units,
    index,
    expanded,
    onToggle,
    onRemove,
    onAddUnit,
    onRemoveUnit,
}) {
    const [newUnit, setNewUnit] = useState("");
    const tint = UNIT_TINTS[index % UNIT_TINTS.length];
    const panelId = `subject-${subject.id}`;

    const add = () => {
        if (newUnit.trim()) {
            onAddUnit(subject.id, newUnit.trim());
            setNewUnit("");
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`overflow-hidden rounded-xl border-2 border-ink ${expanded ? "shadow-brut" : "shadow-brut-xs"}`}
        >
            <div className={`flex items-center gap-3 ${tint} px-4 py-3`}>
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    className="flex flex-1 items-center gap-3 text-left"
                >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-ink bg-paper text-ink">
                        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </span>
                    <span className="flex-1 truncate font-display text-lg font-extrabold tracking-tight text-ink">
                        {subject.name}
                    </span>
                    <span className="shrink-0 rounded-full border-2 border-ink bg-paper px-2.5 py-0.5 font-mono text-[10px] font-bold text-ink">
                        {units.length} {units.length === 1 ? "unit" : "units"}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => onRemove(subject.id)}
                    aria-label={`Remove ${subject.name}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-ink bg-paper text-ink transition-colors hover:bg-flame hover:text-paper"
                >
                    <X size={14} strokeWidth={3} />
                </button>
            </div>

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        id={panelId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden border-t-2 border-ink bg-paper"
                    >
                        <div className="p-4">
                            <ul className="mb-3 space-y-2">
                                {units.map((unit) => (
                                    <li
                                        key={unit}
                                        className="flex items-center justify-between rounded-lg border-2 border-ink bg-paper-2 px-3 py-2"
                                    >
                                        <span className="flex min-w-0 items-center gap-2.5 font-mono text-xs font-bold text-ink">
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-flame" />
                                            <span className="truncate">{unit}</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => onRemoveUnit(subject.id, unit)}
                                            aria-label={`Remove unit ${unit}`}
                                            className="shrink-0 text-ink-25 transition-colors hover:text-flame"
                                        >
                                            <X size={13} strokeWidth={3} />
                                        </button>
                                    </li>
                                ))}
                                {units.length === 0 && (
                                    <li className="rounded-lg border-2 border-dashed border-ink/25 px-3 py-3 text-center font-mono text-[11px] text-ink-45">
                                        No units — the subject folder is created on its own
                                    </li>
                                )}
                            </ul>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Add a folder inside…"
                                    aria-label={`New unit for ${subject.name}`}
                                    className="h-10 min-w-0 flex-1 rounded-lg border-2 border-ink bg-paper px-3 text-sm font-medium text-ink placeholder:text-ink-25 focus:bg-lime-soft focus:outline-none"
                                    value={newUnit}
                                    onChange={(e) => setNewUnit(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && add()}
                                />
                                <button
                                    type="button"
                                    onClick={add}
                                    disabled={!newUnit.trim()}
                                    aria-label="Add unit"
                                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-ink bg-ink text-paper transition-colors hover:bg-flame disabled:bg-paper-3 disabled:text-ink-45"
                                >
                                    <Plus size={15} strokeWidth={3} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

/** The list plus its empty state. Expansion is tracked here so only one opens at a time. */
export default function SubjectTree({
    subjects,
    onRemoveSubject,
    onAddUnit,
    onRemoveUnit,
    emptyHint = "Add a subject to get started",
}) {
    const [expandedId, setExpandedId] = useState(null);

    return (
        <>
            <AnimatePresence initial={false}>
                {subjects.map((subject, index) => (
                    <SubjectRow
                        key={subject.id}
                        subject={subject}
                        units={subject.units}
                        index={index}
                        expanded={expandedId === subject.id}
                        onToggle={() => setExpandedId(expandedId === subject.id ? null : subject.id)}
                        onRemove={onRemoveSubject}
                        onAddUnit={onAddUnit}
                        onRemoveUnit={onRemoveUnit}
                    />
                ))}
            </AnimatePresence>

            {subjects.length === 0 && (
                <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-ink/25 py-10 text-center">
                    <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-paper-2 text-ink-45">
                        <Folder size={20} />
                    </span>
                    <p className="text-sm font-bold text-ink">{emptyHint}</p>
                    <p className="mt-1 max-w-xs text-xs text-ink-45">
                        Uploading a syllabus fills this in automatically.
                    </p>
                </div>
            )}
        </>
    );
}
