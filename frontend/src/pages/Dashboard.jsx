import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
    Terminal, Folder, Clock, Trash2, Settings, Search, Plus,
    MoreVertical, FileText, Image as ImageIcon, FileCode, LogOut, ChevronRight,
    Loader2, Home, BookOpen, GraduationCap, Calculator, Beaker, Globe, Code,
    LayoutGrid, List, Command
} from "lucide-react";
import { motion } from "framer-motion";

// --- THEMES & ASSETS ---
const SUBJECT_THEMES = [
    { name: "Blue", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Beaker },
    { name: "Emerald", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: Calculator },
    { name: "Orange", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: Globe },
    { name: "Purple", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: BookOpen },
    { name: "Indigo", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", icon: Code },
    { name: "Pink", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", icon: GraduationCap },
];

// --- BREADCRUMBS COMPONENT ---
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

// --- FOLDER CARD COMPONENT ---
function FolderCard({ folder, onClick, unitCount, index }) {
    const themeIndex = (index !== undefined ? index : folder.name.length) % SUBJECT_THEMES.length;
    const theme = SUBJECT_THEMES[themeIndex];
    const Icon = theme.icon;

    let badgeText = "";
    if (unitCount && unitCount > 0) {
        badgeText = `${unitCount} Units`;
    } else if (typeof folder.childCount === 'number' && folder.childCount > 0) {
        // Only show item count if > 0
        badgeText = `${folder.childCount} Items`;
    }

    return (
        <motion.div
            layoutId={`folder-${folder.id}`}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            onClick={() => onClick(folder)}
            className={`group p-5 bg-[#0A0A0A] hover:bg-[#111] border border-white/5 hover:border-white/10 rounded-2xl cursor-pointer transition-all relative overflow-hidden shadow-sm hover:shadow-xl`}
        >
            <div className={`absolute top-0 left-0 right-0 h-1 ${theme.bg.replace('/10', '/50')} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

            <div className="flex items-start justify-between mb-8">
                <div className={`p-3 rounded-xl ${theme.bg} ${theme.border} border group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={24} className={theme.color} strokeWidth={1.5} />
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
                        <MoreVertical size={16} />
                    </button>
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-lg text-white mb-2 tracking-tight group-hover:text-white/90 transition-colors">
                    {folder.name}
                </h3>
                {badgeText && (
                    <div className="flex items-center gap-3">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/5 text-white/40 group-hover:text-white/60 transition-colors border border-transparent group-hover:border-white/5`}>
                            {badgeText}
                        </span>
                    </div>
                )}
            </div>

            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.02] to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </motion.div>
    )
}

// --- FILE CARD COMPONENT ---
function FileCard({ file }) {
    const getIcon = (mimeType) => {
        if (mimeType?.includes('pdf')) return <FileText className="text-red-400" size={20} strokeWidth={1.5} />;
        if (mimeType?.includes('image')) return <ImageIcon className="text-purple-400" size={20} strokeWidth={1.5} />;
        if (mimeType?.includes('code')) return <FileCode className="text-blue-400" size={20} strokeWidth={1.5} />;
        return <FileText className="text-gray-400" size={20} strokeWidth={1.5} />;
    }

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="group p-4 bg-[#0A0A0A] hover:bg-[#111] border border-white/5 hover:border-white/10 rounded-xl cursor-pointer transition-all"
        >
            <div className="flex items-center gap-4">
                <div className="p-2.5 bg-white/5 rounded-lg border border-white/5 group-hover:border-white/10 transition-colors">
                    {getIcon(file.mimeType || '')}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-white/80 group-hover:text-white truncate mb-1">{file.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-white/30">
                        <span>PDF Document</span>
                    </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-opacity">
                    <MoreVertical size={14} />
                </button>
            </div>
        </motion.div>
    )
}

// --- MAIN DASHBOARD COMPONENT ---
export default function Dashboard() {
    const [currentView, setCurrentView] = useState('drive');
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [subjectCounts, setSubjectCounts] = useState({});
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([]);

    useEffect(() => { fetchDashboardData(); }, []);
    useEffect(() => { if (currentFolderId) fetchDriveContent(currentFolderId); }, [currentFolderId]);

    const fetchDashboardData = () => {
        setLoading(true);

        // Detect if we are on Vercel (Production) or Localhost (Development)
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

        // Update your axios call to use this variable
        axios.get(`${API_URL}/api/dashboard-data`, { withCredentials: true })
            .then(res => {
                const data = res.data;
                setUserData(data);

                if (data.subjects) {
                    const counts = {};
                    const addSubject = (name, units) => {
                        if (!name) return;
                        const cleanName = name.trim().toLowerCase();
                        const count = Array.isArray(units) ? units.length : 0;
                        counts[cleanName] = count;
                        counts[name] = count;
                    };
                    if (Array.isArray(data.subjects)) {
                        data.subjects.forEach(s => {
                            if (typeof s === 'string') addSubject(s, []);
                            else addSubject(s.name || s.subject, s.units);
                        });
                    } else if (typeof data.subjects === 'object') {
                        Object.entries(data.subjects).forEach(([name, units]) => { addSubject(name, units); });
                    }
                    setSubjectCounts(counts);
                }

                const needsSetup = data.status === "AWAITING_SYLLABUS" || !data.root_folder_id;
                if (needsSetup) {
                    window.location.href = "/setup";
                } else if (data.root_folder_id) {
                    if (!currentFolderId) {
                        setCurrentFolderId(data.root_folder_id);
                        setCurrentView('drive');
                    } else {
                        // Check if we are at root, if so, re-fetch to see new manual folders
                        // If we are deep in a folder, we might want to stay there.
                        // For now, let's just refresh the current folder content.
                        fetchDriveContent(currentFolderId);
                    }
                }
                setLoading(false);
            })
            .catch(() => window.location.href = '/login');
    };

    const fetchDriveContent = (folderId) => {
        // Detect if we are on Vercel (Production) or Localhost (Development)
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
        axios.get(`${API_URL}/api/drive/browse?folder_id=${folderId}`, { withCredentials: true })
            .then(res => {
                setFolders(res.data.folders || []);
                setFiles(res.data.files || []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Drive Fetch Error:", err);
                setLoading(false);
            });
    };

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    const handleLogout = () => { window.location.href = `${API_URL}/logout`; };

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

    const getUnitCount = (folderName) => {
        if (breadcrumbs.length === 0 && subjectCounts) {
            if (subjectCounts[folderName]) return subjectCounts[folderName];
            const clean = folderName.trim().toLowerCase();
            if (subjectCounts[clean]) return subjectCounts[clean];
        }
        return undefined;
    };

    if (loading && !userData) return <div className="h-screen bg-[#020202] flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden selection:bg-white/20">
            {/* Subtle Texture */}
            <div className="absolute inset-0 z-0 opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundSize: '20px 20px' }} />

            {/* Very Subtle Ambient Glow (Restrained) */}
            <div className="absolute top-[-20%] left-[-10%] w-[30%] h-[30%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[30%] h-[30%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />


            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-[#080808]/50 backdrop-blur-xl flex flex-col justify-between hidden md:flex relative z-10 transition-all">
                <div>
                    <div className="p-8 pb-8">
                        <Link to="/" className="flex items-center gap-3 opacity-90 hover:opacity-100 transition-opacity">
                            <div className="p-2 bg-white rounded-lg border border-white/10 shadow-lg shadow-white/5">
                                <Terminal size={18} className="text-black" strokeWidth={3} />
                            </div>
                            <span className="font-bold text-lg tracking-tight">SmartDoc</span>
                        </Link>
                    </div>

                    <nav className="px-4 space-y-1">
                        <NavItem
                            icon={LayoutGrid}
                            label="Dashboard"
                            active={currentView === 'drive'}
                            onClick={() => {
                                setCurrentView('drive');
                                setCurrentFolderId(userData?.root_folder_id);
                                setBreadcrumbs([]);
                            }}
                        />
                        <NavItem icon={List} label="Recent Files" active={false} />
                        <NavItem icon={Clock} label="Bot Activity" active={false} to={`https://wa.me/${import.meta.env.VITE_BOT_NUMBER}`} />
                    </nav>

                    <div className="my-8 px-8">
                        <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-4">Library</div>
                        <nav className="space-y-1">
                            <NavItem icon={Trash2} label="Trash" active={currentView === 'trash'} onClick={() => setCurrentView('trash')} />
                            <NavItem
                                icon={Settings}
                                label="Settings"
                                active={currentView === 'settings'}
                                onClick={() => setCurrentView('settings')}
                            />
                        </nav>
                    </div>
                </div>

                {/* User Profile - Minimal */}
                <div className="p-4 border-t border-white/5 bg-black/20">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group">
                        <img src={userData?.picture || `https://ui-avatars.com/api/?name=${userData?.name || "User"}&background=random`} alt="User" className="w-8 h-8 rounded-full bg-white/10 grayscale group-hover:grayscale-0 transition-all" />
                        <div className="flex-1 text-left min-w-0">
                            <div className="text-xs font-bold text-white/90">{userData?.name || "User"}</div>
                            <div className="text-[10px] text-white/40 truncate">Free Plan</div>
                        </div>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
                <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 z-20 bg-[#050505]/50 backdrop-blur-md">
                    <div className="flex items-center gap-4 text-white/30 text-sm">
                        <Command size={14} />
                        <span className="tracking-wide">Dashboard</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="p-2 text-white/40 hover:text-white transition-colors">
                            <Search size={18} />
                        </button>
                        <div className="h-4 w-px bg-white/10" />
                        <Link to="/create" className="bg-white hover:bg-gray-200 text-black text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                            <Plus size={14} strokeWidth={3} />
                            <span>New</span>
                        </Link>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
                    {currentView === 'drive' && (
                        <>
                            <div className="mb-2">
                                <h1 className="text-3xl font-light tracking-tight text-white mb-2">
                                    {breadcrumbs.length === 0 ? "Overview" : breadcrumbs[breadcrumbs.length - 1].name}
                                </h1>
                                <Breadcrumbs items={breadcrumbs} onNavigate={handleBreadcrumbClick} />
                            </div>

                            {/* Content Area */}
                            {loading ? (
                                <div className="flex justify-center py-24">
                                    <Loader2 className="animate-spin text-white/10" size={24} />
                                </div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {/* Folders Section */}
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
                                                        key={folder.id}
                                                        folder={folder}
                                                        index={idx}
                                                        onClick={handleFolderClick}
                                                        unitCount={getUnitCount(folder.name)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Files Section */}
                                    <div>
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest">
                                                Files
                                            </h2>
                                            <div className="h-px bg-white/5 flex-1 ml-6" />
                                        </div>

                                        {files.length > 0 ? (
                                            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                                {files.map(file => (
                                                    <FileCard key={file.id} file={file} />
                                                ))}
                                            </div>
                                        ) : folders.length === 0 && (
                                            <div className="py-20 text-center border border-dashed border-white/5 rounded-xl">
                                                <p className="text-white/20 text-sm">No files in this location</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </>
                    )}

                    {currentView === 'trash' && (
                        <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                            <Trash2 size={32} className="text-white mb-4" />
                            <h2 className="text-xl font-medium text-white">Trash</h2>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

function NavItem({ icon: Icon, label, active, onClick, to, badge }) {
    const className = `w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 group ${active ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`;

    return to ? (
        <a href={to} target="_blank" rel="noreferrer" className={className}>
            <Icon size={16} />
            <span className="font-medium">{label}</span>
        </a>
    ) : (
        <button onClick={onClick} className={className}>
            <Icon size={16} />
            <span className="font-medium">{label}</span>
        </button>
    );
}