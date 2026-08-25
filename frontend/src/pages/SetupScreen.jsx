import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Plus, Loader2, ArrowLeft, FolderTree, Check, Upload } from "lucide-react";
import { API_URL } from "../lib/config";
import { PROFILE_COLUMNS } from "../lib/profile";
import FolderBuildCeremony from "../components/FolderBuildCeremony";

import SubjectTree from "../components/SubjectTree";

/* -------------------------------------------------------------------- page */

export default function Setup() {
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [subjects, setSubjects] = useState([]);
    const [newSubject, setNewSubject] = useState("");

    const [analyzing, setAnalyzing] = useState(false);
    const [building, setBuilding] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    // No gate: this screen is reachable at any time to add more subjects.
    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { navigate("/login"); return; }
            const { data } = await supabase
                .from("profiles")
                .select(PROFILE_COLUMNS)
                .eq("id", user.id)
                .single();
            setProfile(data);
            setLoading(false);
        };
        load();
    }, [navigate]);

    const addSubject = () => {
        const name = newSubject.trim();
        if (!name) return;
        if (subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
            setNewSubject("");
            return;
        }
        setSubjects((prev) => [...prev, { id: `${Date.now()}`, name, units: [] }]);
        setNewSubject("");
    };

    const removeSubject = (id) => setSubjects((s) => s.filter((x) => x.id !== id));
    const addUnit = (id, unit) =>
        setSubjects((s) => s.map((x) => (x.id === id && !x.units.includes(unit) ? { ...x, units: [...x.units, unit] } : x)));
    const removeUnit = (id, unit) =>
        setSubjects((s) => s.map((x) => (x.id === id ? { ...x, units: x.units.filter((u) => u !== unit) } : x)));

    /* ---- syllabus upload ------------------------------------------------- */
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setAnalyzing(true);
        setError(null);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await axios.post(`${API_URL}/api/upload-syllabus`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    Authorization: `Bearer ${session?.access_token}`,
                },
            });

            const data = res.data;
            let parsed = [];
            if (data.subjects && typeof data.subjects === "object" && !Array.isArray(data.subjects)) {
                parsed = Object.entries(data.subjects).map(([name, units], i) => ({
                    id: `ai-${Date.now()}-${i}`, name, units: Array.isArray(units) ? units : [],
                }));
            } else if (Array.isArray(data.subjects)) {
                parsed = data.subjects.map((item, i) =>
                    typeof item === "string"
                        ? { id: `ai-${i}`, name: item, units: [] }
                        : { id: `ai-${i}`, name: item.name || item.subject || "Untitled", units: item.units || [] }
                );
            } else if (data && typeof data === "object" && !Array.isArray(data)) {
                parsed = Object.entries(data).map(([name, units], i) => ({
                    id: `ai-${Date.now()}-${i}`, name, units: Array.isArray(units) ? units : [],
                }));
            }

            if (parsed.length === 0) {
                setError("No subjects found in that file. Try a clearer syllabus PDF.");
            } else {
                setSubjects((prev) => {
                    const merged = [...prev, ...parsed];
                    return merged.filter((v, i, a) => a.findIndex((t) => t.name === v.name) === i);
                });
            }
        } catch (err) {
            console.error("Upload failed", err);
            setError("Upload failed. Make sure the Python backend is running.");
        } finally {
            setAnalyzing(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    /* ---- commit ---------------------------------------------------------- */
    const commit = async () => {
        setError(null);
        const payload = subjects.map((s) => ({ name: s.name, units: s.units }));

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not signed in");

            // Staging the draft advances `status`, which the browser may no longer write
            // directly: an unrestricted update was a route to ACTIVE without ever
            // verifying WhatsApp. The function validates the transition instead.
            const { data: staged, error: stageError } = await supabase.rpc(
                "save_syllabus_draft",
                { subjects: payload },
            );
            if (stageError || !staged?.success) {
                throw new Error(staged?.error || stageError?.message || "Could not save your folder plan");
            }

            setBuilding(true);

            await axios.post(`${API_URL}/create-folders`, { subjects: payload }, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
            });
        } catch (err) {
            console.error("Setup error", err);
            setError("Could not start folder creation. Is the backend running?");
            setBuilding(false);
        }
    };

    const plan = subjects.reduce((acc, s) => { acc[s.name] = s.units; return acc; }, {});
    const totalFolders = subjects.length + subjects.reduce((n, s) => n + s.units.length, 0);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-paper">
                <span className="flex items-center gap-3 rounded-full border-2 border-ink bg-paper px-6 py-3 shadow-brut">
                    <Loader2 className="animate-spin text-ink" size={18} />
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-ink">Loading</span>
                </span>
            </div>
        );
    }

    return (
        // Height-bounded on laptops and up so the page itself never scrolls; the subject
        // list absorbs the leftover space instead.
        <div className="relative min-h-dvh bg-paper px-4 py-6 text-ink roomy:h-dvh roomy:overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-graph opacity-70" aria-hidden="true" />

            <div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col">
                <Link
                    to="/dashboard"
                    className="mb-4 inline-flex w-fit shrink-0 items-center gap-2 rounded-full border-2 border-ink bg-paper px-4 py-2 text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-lime hover:shadow-brut-xs"
                >
                    <ArrowLeft size={15} /> Back to dashboard
                </Link>

                <AnimatePresence mode="wait">
                    {building ? (
                        <motion.div key="ceremony" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="my-auto roomy:min-h-0 roomy:flex-1">
                            <FolderBuildCeremony
                                plan={plan}
                                userId={profile?.id}
                                phone={profile?.phone}
                                title="Adding your subjects"
                                subtitle="Creating these folders inside your Google Drive."
                                onComplete={() => navigate("/dashboard")}
                                onRetry={commit}
                            />
                        </motion.div>
                    ) : (
                        <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="my-auto flex flex-col roomy:min-h-0 roomy:flex-1">
                            <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-brut-lg roomy:min-h-0 roomy:flex-1">
                                {/* Header */}
                                <div className="flex shrink-0 items-center gap-4 border-b-2 border-ink bg-lime px-6 py-4">
                                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-ink bg-paper text-ink">
                                        <FolderTree size={22} />
                                    </span>
                                    <div className="min-w-0">
                                        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
                                            Add subjects
                                        </h1>
                                        <p className="text-[13px] text-ink/70">
                                            Upload a syllabus and let DocsFlow read it, or type them in.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col p-5 sm:p-6 roomy:min-h-0 roomy:flex-1">
                                    {/* Two ways in */}
                                    <div className="mb-5 grid shrink-0 gap-3 sm:grid-cols-2">
                                        <div className="relative">
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileUpload}
                                                accept=".pdf,.png,.jpg,.jpeg"
                                                disabled={analyzing}
                                                aria-label="Upload a syllabus"
                                                className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
                                            />
                                            <div className="flex h-full items-center gap-3.5 rounded-xl border-2 border-ink bg-cobalt px-5 py-4 text-paper shadow-brut-xs transition-transform hover:-translate-y-0.5">
                                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-ink bg-paper text-ink">
                                                    {analyzing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block font-display text-base font-extrabold tracking-tight text-paper">
                                                        {analyzing ? "Reading…" : "Upload syllabus"}
                                                    </span>
                                                    <span className="block text-[11px] text-paper/70">PDF or image</span>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 rounded-xl border-2 border-ink bg-paper-2 p-2">
                                            <input
                                                type="text"
                                                placeholder="Or type a subject…"
                                                aria-label="New subject name"
                                                value={newSubject}
                                                onChange={(e) => setNewSubject(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && addSubject()}
                                                className="h-12 min-w-0 flex-1 rounded-lg border-2 border-ink bg-paper px-3.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-ink-25 focus:bg-lime-soft focus:outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={addSubject}
                                                disabled={!newSubject.trim()}
                                                aria-label="Add subject"
                                                className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border-2 border-ink bg-ink text-paper transition-colors hover:bg-flame disabled:bg-paper-3 disabled:text-ink-45"
                                            >
                                                <Plus size={17} strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>

                                    {error && (
                                        <p className="mb-5 rounded-xl border-2 border-ink bg-flame-soft px-4 py-3 text-sm font-bold text-ink">
                                            {error}
                                        </p>
                                    )}

                                    {/* Review list */}
                                    <div className="mb-2 flex shrink-0 items-center gap-4">
                                        <h2 className="eyebrow text-ink-45">
                                            {subjects.length > 0 ? `Will create · ${totalFolders} folders` : "Nothing added yet"}
                                        </h2>
                                        <span className="h-0.5 flex-1 bg-ink/10" />
                                    </div>

                                    {/* Takes whatever height is left rather than a fixed
                                        38vh, which previously left the card short and
                                        pushed the commit button off-screen. */}
                                    <div className="custom-scrollbar max-h-[52vh] space-y-2.5 overflow-y-auto py-3 roomy:max-h-none roomy:min-h-0 roomy:flex-1">
                                        <SubjectTree
                                            subjects={subjects}
                                            onRemoveSubject={removeSubject}
                                            onAddUnit={addUnit}
                                            onRemoveUnit={removeUnit}
                                        />
                                    </div>
                                </div>

                                {/* Commit — pinned to the bottom of the card */}
                                <div className="shrink-0 border-t-2 border-ink bg-paper-2 p-4 sm:p-5">
                                    <button
                                        type="button"
                                        onClick={commit}
                                        disabled={subjects.length === 0}
                                        className="flex w-full items-center justify-center gap-2.5 rounded-full border-2 border-ink bg-ink py-4 font-bold text-paper shadow-brut-pop transition-all hover:bg-flame hover:shadow-brut disabled:cursor-not-allowed disabled:bg-paper-3 disabled:text-ink-45 disabled:shadow-none"
                                    >
                                        <Check size={17} strokeWidth={3} />
                                        {subjects.length === 0
                                            ? "Add at least one subject"
                                            : `Create ${totalFolders} folder${totalFolders === 1 ? "" : "s"}`}
                                    </button>
                                    <p className="mt-3 flex items-center justify-center gap-2 text-center text-[11px] text-ink-45">
                                        <Sparkles size={11} />
                                        These are created inside your existing DocsFlow folder in Drive.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
