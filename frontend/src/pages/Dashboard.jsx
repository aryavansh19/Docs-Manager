import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
    Terminal, Clock, Trash2, Settings, Search, Plus,
    MoreVertical, FileText, Image as ImageIcon, FileCode,
    Loader2, Home, BookOpen, GraduationCap, Calculator, Beaker, Globe, Code,
    LayoutGrid, List, Command, LogOut
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "../supabaseClient";

// --- 🎨 THEMES ---
const SUBJECT_THEMES = [
    { name: "Blue", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Beaker },
    { name: "Emerald", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: Calculator },
    { name: "Orange", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: Globe },
    { name: "Purple", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: BookOpen },
    { name: "Indigo", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", icon: Code },
    { name: "Pink", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", icon: GraduationCap },
];

// --- 🍞 BREADCRUMBS ---
function Breadcrumbs({ items, onNavigate }) {
    return (
        <div className="flex items-center gap-2 text-sm text-white/50 mb-8 overflow-x-auto pb-2 scrollbar-hide px-1 font-mono">
            <button
                onClick={() => onNavigate(-1)}
                className="hover:text-white flex items-center gap-2 transition-colors whitespace-nowrap pl-1 pr-2 py-1"
            >
                <Home size={14} />
                <span>/</span>
            </button>
            {items.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2 whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
                    <button
                        onClick={() => onNavigate(index)}
                        className={`transition-colors text-sm hover:underline underline-offset-4 ${index === items.length - 1
                            ? "text-white font-bold pointer-events-none"
                            : "text-white/50 hover:text-white"
                            }`}
                    >
                        {item.name}
                    </button>
                    {index < items.length - 1 && <span className="text-white/20">/</span>}
                </div>
            ))}
        </div>
    );
}

// --- 📂 FOLDER CARD ---
function FolderCard({ folder, onClick, unitCount, index }) {
    const themeIndex = (index !== undefined ? index : folder.name.length) % SUBJECT_THEMES.length;
    const theme = SUBJECT_THEMES[themeIndex];
    const Icon = theme.icon;

    let badgeText = "";
    if (unitCount && unitCount > 0) badgeText = `${unitCount} Units`;
    else if (folder.childCount > 0) badgeText = `${folder.childCount} Items`;

    return (
        <motion.div
            layoutId={`folder-${folder.id}`} // Helper for smooth animation
            whileHover={{ y: -4 }}
            onClick={() => onClick(folder)}
            className={`group p-5 bg-[#0A0A0A] hover:bg-[#111] border border-white/5 hover:border-white/10 rounded-2xl cursor-pointer transition-all relative overflow-hidden shadow-sm hover:shadow-xl`}
        >
            <div className={`absolute top-0 left-0 right-0 h-1 ${theme.bg.replace('/10', '/50')} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="flex items-start justify-between mb-8">
                <div className={`p-3 rounded-xl ${theme.bg} ${theme.border} border group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={24} className={theme.color} strokeWidth={1.5} />
                </div>
            </div>
            <div>
                <h3 className="font-semibold text-lg text-white mb-2 tracking-tight group-hover:text-white/90 transition-colors truncate">
                    {folder.name}
                </h3>
                {badgeText && (
                    <div className="flex items-center gap-3">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/5 text-white/40 group-hover:text-white/60 transition-colors`}>
                            {badgeText}
                        </span>
                    </div>
                )}
            </div>
        </motion.div>
    )
}

// --- 📄 FILE CARD ---
function FileCard({ file, onClick }) {
    const getIcon = (mimeType, name) => {
        const lowerName = name.toLowerCase();
        if (mimeType?.includes('pdf') || lowerName.endsWith('.pdf')) return <FileText className="text-red-400" size={20} strokeWidth={1.5} />;
        if (mimeType?.includes('image') || lowerName.match(/\.(jpg|jpeg|png|gif)$/)) return <ImageIcon className="text-purple-400" size={20} strokeWidth={1.5} />;
        if (mimeType?.includes('code') || lowerName.match(/\.(js|py|html|css|json)$/)) return <FileCode className="text-blue-400" size={20} strokeWidth={1.5} />;
        return <FileText className="text-gray-400" size={20} strokeWidth={1.5} />;
    }

    return (
        <motion.div
            whileHover={{ y: -2 }}
            onClick={() => onClick(file)}
            className="group p-4 bg-[#0A0A0A] hover:bg-[#111] border border-white/5 hover:border-white/10 rounded-xl cursor-pointer transition-all"
        >
            <div className="flex items-center gap-4">
                <div className="p-2.5 bg-white/5 rounded-lg border border-white/5 group-hover:border-white/10 transition-colors">
                    {getIcon(file.mimeType, file.name)}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-white/80 group-hover:text-white truncate mb-1">{file.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-wider">
                        <span>{file.mimeType?.split('/').pop() || 'File'}</span>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

// --- ⚡ INSTANT FOLDER LOOKUP ---
// This function avoids API calls by checking local data first
const getLocalFolders = (targetId, profile) => {
    if (!profile || !profile.folder_map) return null;

    // Case 1: Root Folder -> Return Subjects
    if (targetId === profile.root_folder_id) {
        return Object.entries(profile.folder_map).map(([name, data]) => ({
            id: data.id,
            name: name,
            type: 'folder'
        }));
    }

    // Case 2: Subject Folder -> Return Units
    // Find the subject that has this ID
    const subjectEntry = Object.entries(profile.folder_map).find(([_, data]) => data.id === targetId);

    if (subjectEntry) {
        const [_, data] = subjectEntry;
        if (data.units) {
            return Object.entries(data.units).map(([unitName, unitId]) => ({
                id: unitId,
                name: unitName,
                type: 'folder'
            }));
        }
    }

    // Case 3: Unit Folder (Deepest Level) -> Return empty (wait for API for files)
    return [];
};

// --- 🏠 MAIN COMPONENT ---
export default function Dashboard() {
    const [currentView, setCurrentView] = useState('drive');
    const [userData, setUserData] = useState(null);
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [loadingFiles, setLoadingFiles] = useState(false); // Separate loading state for files
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([]);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

    useEffect(() => { fetchProfile(); }, []);

    // ⚡ SUPER FAST NAVIGATION EFFECT
    useEffect(() => {
        if (!currentFolderId || !userData) return;

        // 1. Try to get folders INSTANTLY from local map
        const instantFolders = getLocalFolders(currentFolderId, userData);

        if (instantFolders !== null && instantFolders.length > 0) {
            setFolders(instantFolders); // Render immediately!
            setFiles([]); // Clear files while loading
            setLoadingFiles(true); // Show spinner only for files area

            // Still fetch in background to get Files + any extra folders
            fetchDriveContent(currentFolderId, true);
        } else {
            // If unknown folder (deep level), show full loading
            setFolders([]);
            setFiles([]);
            setLoadingFiles(true);
            fetchDriveContent(currentFolderId, false);
        }

    }, [currentFolderId, userData]); // Runs whenever folder ID changes

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/login'; return; }

            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            setUserData(profile);

            if (!profile.root_folder_id && profile.status !== 'AWAITING_FOLDERS') {
                window.location.href = "/setup";
            } else if (profile.root_folder_id && !currentFolderId) {
                setCurrentFolderId(profile.root_folder_id);
            }
        } catch (err) { console.error(err); }
    };

    const fetchDriveContent = async (folderId, mergeFolders = false) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await axios.get(`${API_URL}/api/drive/browse?folder_id=${folderId}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            // If we did instant load, we only care about files, or merging new folders
            if (mergeFolders) {
                setFiles(res.data.files || []);
                // Optional: You could merge res.data.folders if you think Drive has more than Supabase
            } else {
                setFolders(res.data.folders || []);
                setFiles(res.data.files || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingFiles(false);
        }
    };

    const handleFolderClick = (folder) => {
        setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
        setCurrentFolderId(folder.id);
    };

    const handleBreadcrumbClick = (index) => {
        if (index === -1) {
            setBreadcrumbs([]);
            setCurrentFolderId(userData.root_folder_id);
        } else {
            const target = breadcrumbs[index];
            setBreadcrumbs(breadcrumbs.slice(0, index + 1));
            setCurrentFolderId(target.id);
        }
    };

    // --- RENDER ---
    if (!userData) return <div className="h-screen bg-[#020202] flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
            {/* Sidebar (Simplified) */}
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-[#080808]/50 hidden md:flex flex-col justify-between p-4">

                {/* Top Section */}
                <div>
                    <div className="flex items-center gap-3 mb-8 px-4 py-4">
                        <Terminal size={18} />
                        <span className="font-bold">SmartDoc</span>
                    </div>

                    <nav className="space-y-1">
                        <button
                            onClick={() => { setCurrentFolderId(userData?.root_folder_id); setBreadcrumbs([]); }}
                            className={`w-full flex items-center gap-3 px-4 py-2 rounded-md text-sm transition-colors ${currentFolderId === userData?.root_folder_id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                        >
                            <LayoutGrid size={16} /> <span>Drive</span>
                        </button>

                        <a
                            href={`https://wa.me/${import.meta.env.VITE_BOT_NUMBER}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full flex items-center gap-3 px-4 py-2 text-white/40 hover:text-white hover:bg-white/5 rounded-md transition-colors text-sm"
                        >
                            <Clock size={16} /> <span>Bot Activity</span>
                        </a>
                    </nav>
                </div>

                {/* 👇 BOTTOM SECTION: USER PROFILE & LOGOUT */}
                <div className="pt-4 border-t border-white/5">
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            window.location.href = "/login";
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                        <img
                            src={`https://ui-avatars.com/api/?name=${userData?.name || "User"}&background=random`}
                            alt="User"
                            className="w-8 h-8 rounded-full bg-white/10 grayscale group-hover:grayscale-0 transition-all"
                        />
                        <div className="flex-1 text-left min-w-0">
                            <div className="text-xs font-bold text-white/90 truncate">{userData?.name || "User"}</div>
                            <div className="text-[10px] text-white/40 group-hover:text-red-400 transition-colors">Click to Log Out</div>
                        </div>
                        <LogOut size={14} className="opacity-0 group-hover:opacity-100 text-red-400 transition-opacity" />
                    </button>
                </div>

            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0">
                <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-[#050505]/50 backdrop-blur-md">
                    <span className="text-sm text-white/30">Files</span>
                    <Link to="/setup" className="bg-white text-black text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2">
                        <Plus size={14} /> <span>New Upload</span>
                    </Link>
                </header>

                <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
                    {/* Breadcrumbs */}
                    <div className="mb-2">
                        <h1 className="text-3xl font-light tracking-tight text-white mb-2">
                            {breadcrumbs.length === 0 ? "My Subjects" : breadcrumbs[breadcrumbs.length - 1].name}
                        </h1>
                        <Breadcrumbs items={breadcrumbs} onNavigate={handleBreadcrumbClick} />
                    </div>

                    <motion.div
                        key={currentFolderId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* FOLDERS GRID (Instant Render) */}
                        {folders.length > 0 && (
                            <div className="mb-12">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest">
                                        {breadcrumbs.length === 0 ? 'Subjects' : 'Folders'}
                                    </h2>
                                    <div className="h-px bg-white/5 flex-1 ml-6" />
                                </div>
                                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {folders.map((folder, idx) => (
                                        <FolderCard
                                            key={folder.id || folder.name}
                                            folder={folder}
                                            index={idx}
                                            onClick={handleFolderClick}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* FILES GRID (Async Loading) */}
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest">Files</h2>
                                <div className="h-px bg-white/5 flex-1 ml-6" />
                            </div>

                            {loadingFiles ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="animate-spin text-white/20" />
                                </div>
                            ) : files.length > 0 ? (
                                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                    {files.map(file => (
                                        <FileCard
                                            key={file.id}
                                            file={file}
                                            onClick={(f) => f.webViewLink && window.open(f.webViewLink, '_blank')}
                                        />
                                    ))}
                                </div>
                            ) : folders.length === 0 ? (
                                <div className="py-20 text-center border border-dashed border-white/5 rounded-xl">
                                    <p className="text-white/20 text-sm">No files in this folder.</p>
                                </div>
                            ) : null}
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}