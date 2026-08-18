import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
    Plus, FileText, Image as ImageIcon, FileCode, Loader2, Home,
    BookOpen, GraduationCap, Calculator, Beaker, Globe, Code,
    LogOut, ChevronRight, Folder, FolderTree, ExternalLink,
    MessageSquare, Sparkles, Inbox, ArrowRight, Clock, Tag
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { supabase } from "../supabaseClient";
import { API_URL, botWhatsAppLink } from "../lib/config";
import { isWhatsAppVerified, hasWorkspace as profileHasWorkspace } from "../lib/profile";
import FolderBuildCeremony from "../components/FolderBuildCeremony";
import SubjectTree from "../components/SubjectTree";

/** Folder the ingestion pipeline files anything it cannot confidently place. */
const FALLBACK_FOLDER = "Imported Documents";

/** Folders the backend creates when no syllabus is supplied (main.py defaults). */
const DEFAULT_PLAN = {
    "Important Documents": ["Aadhar Card", "PAN Card"],
    "Screenshots": [],
    "Identity Cards": [],
    "Personal": [],
    "Imported Documents": [],
};

const FOLDER_ICONS = [Beaker, Calculator, Globe, BookOpen, Code, GraduationCap];
const FOLDER_CHIPS = ["bg-lime", "bg-cobalt", "bg-flame", "bg-violet", "bg-teal", "bg-magenta"];

const TABS = [
    { id: "folders", label: "Folders", Icon: FolderTree },
    { id: "activity", label: "Activity", Icon: Clock },
];

/* ----------------------------------------------------------------- utils -- */

function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
}

function relativeTime(iso) {
    if (!iso) return "";
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fileVisual(mimeType, name = "") {
    const n = (name || "").toLowerCase();
    if (mimeType?.includes("pdf") || n.endsWith(".pdf")) return { Icon: FileText, chip: "bg-flame" };
    if (mimeType?.includes("image") || n.match(/\.(jpg|jpeg|png|gif|webp)$/)) return { Icon: ImageIcon, chip: "bg-violet" };
    if (mimeType?.includes("code") || n.match(/\.(js|py|html|css|json)$/)) return { Icon: FileCode, chip: "bg-cobalt" };
    return { Icon: FileText, chip: "bg-ink" };
}

const getLocalFolders = (targetId, profile) => {
    if (!profile || !profile.folder_map) return null;
    if (targetId === profile.root_folder_id) {
        return Object.entries(profile.folder_map).map(([name, data]) => ({ id: data.id, name, type: "folder" }));
    }
    const entry = Object.entries(profile.folder_map).find(([, d]) => d.id === targetId);
    if (entry) {
        const [, data] = entry;
        if (data.units) {
            return Object.entries(data.units).map(([unitName, unitId]) => ({ id: unitId, name: unitName, type: "folder" }));
        }
    }
    return [];
};

/* -------------------------------------------------------------- sidebar -- */

function Sidebar({ profile, tab, setTab, activityCount }) {
    return (
        <aside className="hidden w-56 shrink-0 flex-col border-r-2 border-ink bg-paper p-4 lg:flex">
            <Link to="/" className="mb-8 flex items-center gap-2.5 px-1 py-1">
                <span className="grid h-9 w-9 place-items-center rounded-lg border-2 border-ink bg-flame font-display text-base font-extrabold text-paper">
                    D
                </span>
                <span className="font-display text-lg font-extrabold tracking-tight">DocsFlow</span>
            </Link>

            <nav className="space-y-1.5" aria-label="Sections">
                {TABS.map(({ id, label, Icon }) => {
                    const active = tab === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setTab(id)}
                            aria-current={active ? "page" : undefined}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-all ${
                                active
                                    ? "border-2 border-ink bg-lime text-ink shadow-brut-xs"
                                    : "border-2 border-transparent text-ink-45 hover:bg-paper-2 hover:text-ink"
                            }`}
                        >
                            <Icon size={16} />
                            <span className="flex-1 text-left">{label}</span>
                            {id === "activity" && activityCount > 0 && (
                                <span className={`rounded-full border-2 border-ink px-1.5 font-mono text-[10px] font-bold ${
                                    active ? "bg-paper text-ink" : "bg-ink text-paper"
                                }`}>
                                    {activityCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Actions live in the top-right toolbar, not here. */}

            <div className="mt-auto border-t-2 border-ink pt-4">
                <button
                    type="button"
                    onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
                    className="group flex w-full items-center gap-3 rounded-lg border-2 border-transparent px-2 py-2 transition-colors hover:border-ink hover:bg-flame-soft"
                >
                    <img
                        src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || "User")}&background=random`}
                        alt=""
                        aria-hidden="true"
                        className="h-8 w-8 shrink-0 rounded-lg border-2 border-ink object-cover"
                    />
                    <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-xs font-bold text-ink">{profile?.name || "User"}</span>
                        <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-ink-25 group-hover:text-flame">
                            Sign out
                        </span>
                    </span>
                    <LogOut size={13} className="shrink-0 text-ink-25 group-hover:text-flame" />
                </button>
            </div>
        </aside>
    );
}

/** Tabs + account for narrow screens, since the sidebar is hidden there. */
function MobileBar({ tab, setTab }) {
    return (
        <div className="flex h-14 shrink-0 items-center justify-between border-b-2 border-ink bg-paper px-4 lg:hidden">
            <div className="flex items-center gap-2">
                {TABS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        aria-label={label}
                        aria-current={tab === id ? "page" : undefined}
                        className={`grid h-9 w-9 place-items-center rounded-lg border-2 border-ink ${tab === id ? "bg-lime" : "bg-paper"}`}
                    >
                        <Icon size={15} />
                    </button>
                ))}
            </div>
            {/* No send button here: the toolbar below carries it at every width. */}
            <button
                type="button"
                onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
                aria-label="Sign out"
                className="grid h-9 w-9 place-items-center rounded-lg border-2 border-ink bg-paper text-ink"
            >
                <LogOut size={14} />
            </button>
        </div>
    );
}

/**
 * Top-right toolbar. Breadcrumbs sit on the left so the content area doesn't
 * need its own breadcrumb row, keeping the total chrome to one bar.
 */
function Toolbar({ tab, trail, onNavigate }) {
    const showTrail = tab === "folders" && trail.length > 0;

    return (
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b-2 border-ink bg-paper px-5 sm:px-8">
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
                {showTrail ? (
                    <ol className="scrollbar-hide flex items-center gap-1 overflow-x-auto">
                        <li className="shrink-0">
                            <button
                                type="button"
                                onClick={() => onNavigate(-1)}
                                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono text-[11px] font-bold text-ink-45 transition-colors hover:bg-paper-2 hover:text-ink"
                            >
                                <Home size={12} /> Home
                            </button>
                        </li>
                        {trail.map((item, i) => {
                            const isLast = i === trail.length - 1;
                            return (
                                <li key={item.id} className="flex shrink-0 items-center gap-1">
                                    <ChevronRight size={12} className="text-ink-25" aria-hidden="true" />
                                    <button
                                        type="button"
                                        onClick={() => onNavigate(i)}
                                        disabled={isLast}
                                        aria-current={isLast ? "page" : undefined}
                                        className={`max-w-[10rem] truncate rounded-full px-2.5 py-1.5 font-mono text-[11px] font-bold transition-colors ${
                                            isLast ? "cursor-default bg-ink text-paper" : "text-ink-45 hover:bg-paper-2 hover:text-ink"
                                        }`}
                                    >
                                        {item.name}
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                ) : (
                    <span aria-hidden="true" />
                )}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
                <a
                    href={botWhatsAppLink("Hi")}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-full border-2 border-ink bg-teal px-3.5 py-2 text-[11px] font-bold text-ink shadow-brut-xs transition-transform hover:-translate-y-0.5"
                >
                    <MessageSquare size={13} />
                    <span className="hidden sm:inline">Send a document</span>
                </a>
                <Link
                    to="/setup"
                    className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-3.5 py-2 text-[11px] font-bold text-ink transition-colors hover:bg-lime"
                >
                    <Plus size={13} strokeWidth={3} />
                    <span className="hidden sm:inline">Add subjects</span>
                </Link>
            </div>
        </header>
    );
}

/* ------------------------------------------------------------ fragments -- */

function FolderTile({ folder, index, onClick }) {
    const Icon = FOLDER_ICONS[index % FOLDER_ICONS.length];
    return (
        <motion.button
            type="button"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3) }}
            whileHover={{ y: -4 }}
            onClick={() => onClick(folder)}
            className="group flex flex-col items-start rounded-2xl border-2 border-ink bg-paper p-5 text-left shadow-brut-sm transition-shadow hover:shadow-brut-lg"
        >
            <span className={`mb-7 grid h-11 w-11 place-items-center rounded-xl border-2 border-ink ${FOLDER_CHIPS[index % FOLDER_CHIPS.length]} text-paper transition-transform duration-300 group-hover:-rotate-12`}>
                <Icon size={19} />
            </span>
            <span className="mb-1 w-full truncate font-display text-[17px] font-extrabold tracking-tight text-ink">
                {folder.name}
            </span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-ink-25">open</span>
        </motion.button>
    );
}

function ActivityRow({ file, index }) {
    const { Icon, chip } = fileVisual(file.mime_type, file.file_name);
    const tags = Array.isArray(file.tags) ? file.tags : [];
    return (
        <motion.li
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
            className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-paper-2"
        >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-ink ${chip} text-paper`}>
                <Icon size={15} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-ink">{file.file_name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {file.subject && (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-70">
                            {file.subject}
                        </span>
                    )}
                    {tags.slice(0, 2).map((t) => (
                        <span key={String(t)} className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-45">
                            <Tag size={8} /> {String(t)}
                        </span>
                    ))}
                </span>
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-25">
                {relativeTime(file.created_at)}
            </span>
            {file.drive_file_id && (
                <a
                    href={`https://drive.google.com/file/d/${file.drive_file_id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${file.file_name} in Drive`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-transparent text-ink-25 transition-all group-hover:border-ink group-hover:bg-paper group-hover:text-ink"
                >
                    <ExternalLink size={13} />
                </a>
            )}
        </motion.li>
    );
}

function EmptyBlock({ title, body }) {
    return (
        <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-ink/25 bg-paper px-6 py-16 text-center">
            <span className="mb-5 grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-paper-2 text-ink-45">
                <Inbox size={20} />
            </span>
            <p className="mb-1.5 font-display text-xl font-extrabold tracking-tight text-ink">{title}</p>
            <p className="max-w-xs text-[13.5px] leading-relaxed text-ink-45">{body}</p>
        </div>
    );
}

/* ------------------------------------------------------------------ page -- */

export default function Dashboard() {
    const reduce = useReducedMotion();
    const navigate = useNavigate();

    const [userData, setUserData] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [tab, setTab] = useState("folders");   // folders is home

    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [loadingContent, setLoadingContent] = useState(false);
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [trail, setTrail] = useState([]);

    const [activity, setActivity] = useState([]);
    const [loadingActivity, setLoadingActivity] = useState(true);

    const [building, setBuilding] = useState(false);
    const [buildError, setBuildError] = useState(null);

    // The first-run folder plan is editable: seeded from the defaults, then the user can
    // add or remove subjects and the folders nested inside them before committing.
    const [planDraft, setPlanDraft] = useState(() =>
        Object.entries(DEFAULT_PLAN).map(([name, units], i) => ({
            id: `seed-${i}-${name}`,
            name,
            units: [...units],
        }))
    );
    const [newPlanSubject, setNewPlanSubject] = useState("");

    const planObject = planDraft.reduce((acc, s) => {
        acc[s.name] = s.units;
        return acc;
    }, {});
    const planFolderCount = planDraft.length + planDraft.reduce((n, s) => n + s.units.length, 0);

    const addPlanSubject = () => {
        const name = newPlanSubject.trim();
        if (!name) return;
        if (planDraft.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
            setNewPlanSubject("");
            return;
        }
        setPlanDraft((prev) => [...prev, { id: `new-${Date.now()}`, name, units: [] }]);
        setNewPlanSubject("");
    };

    const removePlanSubject = (id) =>
        setPlanDraft((prev) => prev.filter((s) => s.id !== id));

    const addPlanUnit = (id, unit) =>
        setPlanDraft((prev) =>
            prev.map((s) => (s.id === id && !s.units.includes(unit) ? { ...s, units: [...s.units, unit] } : s))
        );

    const removePlanUnit = (id, unit) =>
        setPlanDraft((prev) =>
            prev.map((s) => (s.id === id ? { ...s, units: s.units.filter((u) => u !== unit) } : s))
        );

    const fetchProfile = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = "/login"; return null; }

        const { data: profile } = await supabase
            .from("profiles").select("*").eq("id", user.id).single();

        // Hard gate: the folder worker sends a business-initiated WhatsApp
        // message, which Meta only allows inside the 24h window a user-initiated
        // message opens. Shared predicate so this can't disagree with /verify.
        if (profile && !isWhatsAppVerified(profile)) {
            navigate("/verify", { replace: true });
            return null;
        }

        setUserData(profile);
        setLoadingProfile(false);
        if (profile?.root_folder_id) setCurrentFolderId(profile.root_folder_id);
        return profile;
    }, [navigate]);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    useEffect(() => {
        if (userData && !userData.root_folder_id && userData.status === "AWAITING_FOLDERS") {
            setBuilding(true);
        }
    }, [userData]);

    const loadActivity = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setLoadingActivity(true);
        const { data, error } = await supabase
            .from("files")
            .select("id, file_name, subject, tags, drive_file_id, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);
        if (error) console.error("activity load failed", error);
        setActivity(data || []);
        setLoadingActivity(false);
    }, []);

    useEffect(() => { loadActivity(); }, [loadActivity]);

    useEffect(() => {
        if (!userData?.id) return;
        const channel = supabase
            .channel(`activity-${userData.id}`)
            .on("postgres_changes",
                { event: "INSERT", schema: "public", table: "files", filter: `user_id=eq.${userData.id}` },
                (payload) => setActivity((prev) => [payload.new, ...prev].slice(0, 50))
            )
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [userData?.id]);

    const fetchDriveContent = useCallback(async (folderId, foldersAlreadyShown = false) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await axios.get(`${API_URL}/api/drive/browse?folder_id=${folderId}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (foldersAlreadyShown) setFiles(res.data.files || []);
            else { setFolders(res.data.folders || []); setFiles(res.data.files || []); }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingContent(false);
        }
    }, []);

    useEffect(() => {
        if (!currentFolderId || !userData) return;
        const instant = getLocalFolders(currentFolderId, userData);
        if (instant !== null && instant.length > 0) {
            setFolders(instant); setFiles([]); setLoadingContent(true);
            fetchDriveContent(currentFolderId, true);
        } else {
            setFolders([]); setFiles([]); setLoadingContent(true);
            fetchDriveContent(currentFolderId, false);
        }
    }, [currentFolderId, userData, fetchDriveContent]);

    const startBuild = async () => {
        setBuildError(null);
        setBuilding(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not signed in");
            // Send the tree the user actually customised rather than an empty list.
            const payload = planDraft.map((s) => ({ name: s.name, units: s.units }));
            await axios.post(`${API_URL}/create-folders`, { subjects: payload }, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
            });
        } catch (err) {
            console.error("build request failed", err);
            setBuildError("Could not reach the server. Is the backend running?");
            setBuilding(false);
        }
    };

    const onBuildComplete = async () => {
        await fetchProfile();
        setBuilding(false);
    };

    const enterFolder = (folder) => {
        setTrail([...trail, { id: folder.id, name: folder.name }]);
        setCurrentFolderId(folder.id);
    };

    const goTo = (index) => {
        if (index === -1) {
            setTrail([]);
            setCurrentFolderId(userData.root_folder_id);
        } else {
            const target = trail[index];
            setTrail(trail.slice(0, index + 1));
            setCurrentFolderId(target.id);
        }
    };

    const atRoot = trail.length === 0;

    const heading = useMemo(() => {
        if (tab === "activity") return "Activity";
        if (!atRoot) return trail[trail.length - 1].name;
        return `${greeting()}${userData?.name ? `, ${userData.name.split(" ")[0]}` : ""}.`;
    }, [tab, atRoot, trail, userData]);

    const subheading = useMemo(() => {
        if (tab === "activity") {
            return activity.length === 0
                ? "Nothing filed yet"
                : `${activity.length} document${activity.length === 1 ? "" : "s"} filed`;
        }
        return `${folders.length} folder${folders.length === 1 ? "" : "s"} Â· ${files.length} file${files.length === 1 ? "" : "s"}`;
    }, [tab, activity.length, folders.length, files.length]);

    const hasWorkspace = profileHasWorkspace(userData);

    /* ---------------------------------------------------------- loading -- */
    if (loadingProfile) {
        return (
            <div className="flex h-screen items-center justify-center bg-paper">
                <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-2.5" aria-hidden="true">
                        {["bg-flame", "bg-lime", "bg-cobalt"].map((c, i) => (
                            <motion.span
                                key={c}
                                className={`h-3.5 w-3.5 rounded-full border-2 border-ink ${c}`}
                                animate={reduce ? {} : { y: [0, -10, 0] }}
                                transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.13 }}
                            />
                        ))}
                    </div>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink-45">
                        Loading workspace
                    </p>
                </div>
            </div>
        );
    }

    /* ------------------------------------------- first run / building --- */
    if (!hasWorkspace) {
        return (
            <div className="relative min-h-dvh bg-paper px-5 py-6 sm:px-8 roomy:h-dvh roomy:overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-graph opacity-70" aria-hidden="true" />
                <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col">
                    <Link to="/" className="mb-5 inline-flex w-fit shrink-0 items-center gap-2.5">
                        <span className="grid h-9 w-9 place-items-center rounded-lg border-2 border-ink bg-flame font-display text-base font-extrabold text-paper">D</span>
                        <span className="font-display text-lg font-extrabold tracking-tight">DocsFlow</span>
                    </Link>

                    <AnimatePresence mode="wait">
                        {building ? (
                            <motion.div key="ceremony" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="my-auto roomy:min-h-0 roomy:flex-1">
                                <FolderBuildCeremony
                                    plan={planObject}
                                    userId={userData?.id}
                                    phone={userData?.phone}
                                    onComplete={onBuildComplete}
                                    onRetry={startBuild}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="invite"
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="my-auto grid gap-7 lg:grid-cols-2 lg:items-center lg:gap-12 roomy:min-h-0 roomy:flex-1"
                            >
                              <div className="min-h-0">
                                <div className="mb-4 flex items-center gap-2.5">
                                    <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-ink text-paper">
                                        <Sparkles size={12} />
                                    </span>
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink-45">
                                        Last step
                                    </span>
                                </div>

                                <h1 className="mb-3 font-display text-[2.4rem] font-extrabold leading-[0.95] tracking-tight sm:text-5xl">
                                    Give your documents
                                    <br />a home.
                                </h1>
                                <p className="mb-6 max-w-lg text-[15px] leading-relaxed text-ink-70 xl:text-base">
                                    DocsFlow will create this folder set inside your Google Drive.
                                    Rename, move or delete any of it afterwards â€” it&apos;s your Drive.
                                </p>

                                {buildError && (
                                    <p className="mb-5 rounded-xl border-2 border-ink bg-flame-soft px-4 py-3 text-sm font-bold text-ink">
                                        {buildError}
                                    </p>
                                )}

                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={startBuild}
                                        disabled={planDraft.length === 0}
                                        className="group inline-flex items-center justify-center gap-2.5 rounded-full border-2 border-ink bg-ink px-7 py-4 font-bold text-paper shadow-brut-pop transition-all hover:bg-flame hover:shadow-brut disabled:cursor-not-allowed disabled:bg-paper-3 disabled:text-ink-45 disabled:shadow-none"
                                    >
                                        {planDraft.length === 0
                                            ? "Add a folder first"
                                            : `Create ${planFolderCount} folder${planFolderCount === 1 ? "" : "s"}`}
                                        <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                                    </button>
                                    <Link
                                        to="/setup"
                                        className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-paper px-7 py-4 font-bold text-ink transition-colors hover:bg-lime"
                                    >
                                        Upload a syllabus instead
                                    </Link>
                                </div>
                              </div>

                              {/* right column: the plan, editable before it is committed */}
                              <div className="flex flex-col roomy:min-h-0 roomy:max-h-full">
                                <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-brut-lg roomy:min-h-0">
                                    <div className="flex shrink-0 items-center gap-2.5 border-b-2 border-ink bg-paper-2 px-5 py-3">
                                        <FolderTree size={14} className="text-ink-45" />
                                        <span className="flex-1 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-45">
                                            Your folder plan
                                        </span>
                                        <span className="rounded-full border-2 border-ink bg-paper px-2.5 py-0.5 font-mono text-[10px] font-bold text-ink">
                                            {planFolderCount} folders
                                        </span>
                                    </div>

                                    {/* manual add â€” the only way in previously was a syllabus upload */}
                                    <div className="flex shrink-0 gap-2 border-b-2 border-ink bg-paper-2 px-4 py-3">
                                        <input
                                            type="text"
                                            placeholder="Add a folderâ€¦"
                                            aria-label="New folder name"
                                            value={newPlanSubject}
                                            onChange={(e) => setNewPlanSubject(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && addPlanSubject()}
                                            className="h-10 min-w-0 flex-1 rounded-lg border-2 border-ink bg-paper px-3 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-ink-25 focus:bg-lime-soft focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={addPlanSubject}
                                            disabled={!newPlanSubject.trim()}
                                            aria-label="Add folder"
                                            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-ink bg-ink text-paper transition-colors hover:bg-flame disabled:bg-paper-3 disabled:text-ink-45"
                                        >
                                            <Plus size={16} strokeWidth={3} />
                                        </button>
                                    </div>

                                    <div className="custom-scrollbar max-h-[44vh] space-y-2.5 overflow-y-auto p-4 roomy:max-h-none roomy:min-h-0 roomy:flex-1">
                                        <SubjectTree
                                            subjects={planDraft}
                                            onRemoveSubject={removePlanSubject}
                                            onAddUnit={addPlanUnit}
                                            onRemoveUnit={removePlanUnit}
                                            emptyHint="Add at least one folder"
                                        />
                                    </div>

                                    <p className="shrink-0 border-t-2 border-ink bg-paper-2 px-4 py-2.5 text-[11px] text-ink-45">
                                        Expand a folder to see or change what goes inside it.
                                        {" "}
                                        <span className="font-bold text-ink">{FALLBACK_FOLDER}</span> is always
                                        created, since unrecognised files are filed there.
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

    /* ----------------------------------------------------------- shell -- */
    return (
        <div className="flex h-screen overflow-hidden bg-paper-2 text-ink">
            <Sidebar
                profile={userData}
                tab={tab}
                setTab={setTab}
                activityCount={activity.length}
            />

            <main className="flex min-w-0 flex-1 flex-col">
                <MobileBar tab={tab} setTab={setTab} />
                <Toolbar tab={tab} trail={trail} onNavigate={goTo} />

                <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-8 sm:px-8">
                    <div className="mx-auto max-w-5xl">
                        <div className="mb-8">
                            <motion.h1
                                key={heading}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                                className="font-display text-[2.2rem] font-extrabold leading-[0.95] tracking-tight sm:text-[2.6rem]"
                            >
                                {heading}
                            </motion.h1>
                            <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink-45">
                                {subheading}
                            </p>
                        </div>

                        <AnimatePresence mode="wait">
                            {tab === "folders" ? (
                                <motion.div
                                    key="folders"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.26 }}
                                >
                                    {folders.length > 0 && (
                                        <section className="mb-8">
                                            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                                                {folders.map((folder, idx) => (
                                                    <FolderTile
                                                        key={folder.id || folder.name}
                                                        folder={folder}
                                                        index={idx}
                                                        onClick={enterFolder}
                                                    />
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {loadingContent ? (
                                        <div className="flex justify-center py-12">
                                            <Loader2 className="animate-spin text-ink-25" size={18} />
                                        </div>
                                    ) : files.length > 0 ? (
                                        <section className="overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-brut-sm">
                                            <div className="border-b-2 border-ink bg-paper-2 px-5 py-3">
                                                <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-70">
                                                    Files
                                                </h2>
                                            </div>
                                            <ul className="divide-y-2 divide-ink/10">
                                                {files.map((file) => {
                                                    const { Icon, chip } = fileVisual(file.mimeType, file.name);
                                                    return (
                                                        <li key={file.id}>
                                                            <button
                                                                type="button"
                                                                onClick={() => file.webViewLink && window.open(file.webViewLink, "_blank")}
                                                                className="group flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-paper-2"
                                                            >
                                                                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-ink ${chip} text-paper`}>
                                                                    <Icon size={15} />
                                                                </span>
                                                                <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">
                                                                    {file.name}
                                                                </span>
                                                                <ExternalLink size={13} className="shrink-0 text-ink-25 group-hover:text-ink" />
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </section>
                                    ) : folders.length === 0 ? (
                                        <EmptyBlock
                                            title={atRoot ? "No folders yet" : "This folder is empty"}
                                            body="Forward a document to the bot and it will be filed here automatically."
                                        />
                                    ) : null}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="activity"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.26 }}
                                >
                                    {loadingActivity ? (
                                        <div className="flex justify-center py-16">
                                            <Loader2 className="animate-spin text-ink-25" size={18} />
                                        </div>
                                    ) : activity.length > 0 ? (
                                        <section className="overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-brut-sm">
                                            <div className="flex items-center justify-between border-b-2 border-ink bg-paper-2 px-5 py-3">
                                                <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-70">
                                                    Recently filed
                                                </h2>
                                                <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-ink-45">
                                                    <span className="h-1.5 w-1.5 animate-blink rounded-full bg-teal" /> live
                                                </span>
                                            </div>
                                            <ul className="divide-y-2 divide-ink/10">
                                                {activity.map((f, i) => <ActivityRow key={f.id} file={f} index={i} />)}
                                            </ul>
                                        </section>
                                    ) : (
                                        <EmptyBlock
                                            title="Nothing filed yet"
                                            body="Once you forward a document, what the bot renamed it to and where it filed it shows up here."
                                        />
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </main>
        </div>
    );
}
