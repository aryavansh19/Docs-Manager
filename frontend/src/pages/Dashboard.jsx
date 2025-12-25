import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
    Terminal, Folder, Clock, Trash2, Settings, Search, Plus,
    MoreVertical, FileText, Image as ImageIcon, FileCode, LogOut, ChevronRight,
    Loader2, UploadCloud, ArrowLeft, Home
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- BREADCRUMBS COMPONENT ---
function Breadcrumbs({ items, onNavigate }) {
    return (
        <div className="flex items-center gap-2 text-sm text-white/50 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            <button
                onClick={() => onNavigate(-1)}
                className="hover:text-white flex items-center gap-1 transition-colors whitespace-nowrap"
            >
                <Home size={14} />
                <span>Home</span>
            </button>

            {items.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2 whitespace-nowrap">
                    <ChevronRight size={14} className="text-white/20" />
                    <button
                        onClick={() => onNavigate(index)}
                        className={`transition-colors ${index === items.length - 1
                                ? "text-white font-medium pointer-events-none"
                                : "hover:text-white"
                            }`}
                    >
                        {item.name}
                    </button>
                </div>
            ))}
        </div>
    );
}

// --- FOLDER CARD COMPONENT ---
function FolderCard({ folder, onClick }) {
    return (
        <div
            onClick={() => onClick(folder)}
            className="group p-4 bg-[#0a0a0a] border border-white/5 hover:border-blue-500/30 rounded-xl cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/5 relative overflow-hidden"
        >
            <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/[0.02] transition-colors" />
            <div className="relative z-10 flex items-start justify-between mb-4">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                    <Folder size={20} />
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical size={16} />
                    </button>
                </div>
            </div>
            <div className="relative z-10">
                <h3 className="font-medium text-sm text-white/90 group-hover:text-white truncate mb-1">{folder.name}</h3>
                <p className="text-[10px] text-white/40">{folder.childCount || 0} items</p>
            </div>
        </div>
    )
}

// --- FILE CARD COMPONENT ---
function FileCard({ file }) {
    const getIcon = (mimeType) => {
        if (mimeType.includes('pdf')) return <FileText className="text-red-400" size={24} />;
        if (mimeType.includes('image')) return <ImageIcon className="text-purple-400" size={24} />;
        if (mimeType.includes('code') || mimeType.includes('javascript') || mimeType.includes('json')) return <FileCode className="text-blue-400" size={24} />;
        return <FileText className="text-gray-400" size={24} />;
    }

    return (
        <div className="bg-[#0a0a0a] border border-white/5 hover:border-white/20 p-4 rounded-xl transition-all hover:-translate-y-1 hover:shadow-lg group cursor-pointer relative overflow-hidden">
            <div className="absolute top-0 right-0 p-16 bg-blue-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex items-start justify-between mb-4">
                <div className="p-2 bg-white/5 rounded-lg">
                    {getIcon(file.mimeType || '')}
                </div>
                <a href={file.webViewLink} target="_blank" rel="noreferrer" className="text-white/20 hover:text-white transition-colors p-1">
                    <MoreVertical size={16} />
                </a>
            </div>
            <div className="relative z-10">
                <h3 className="font-medium text-sm truncate mb-1 text-white/90 group-hover:text-blue-400 transition-colors">{file.name}</h3>
                <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <span>Google Drive</span>
                </div>
            </div>
        </div>
    )
}

// --- MAIN DASHBOARD COMPONENT ---
export default function Dashboard() {
    // UI State
    const [currentView, setCurrentView] = useState('drive');
    const [loading, setLoading] = useState(true);

    // Data State
    const [userData, setUserData] = useState(null);
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);

    // Navigation State
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([]); // Array of {id, name}

    useEffect(() => { fetchDashboardData(); }, []);

    // Listen to currentFolderId changes to fetch content
    useEffect(() => {
        if (currentFolderId) {
            fetchDriveContent(currentFolderId);
        }
    }, [currentFolderId]);

    const fetchDashboardData = () => {
        axios.get('http://localhost:8001/api/dashboard-data', { withCredentials: true })
            .then(res => {
                setUserData(res.data);
                const needsSetup = res.data.status === "AWAITING_SYLLABUS" || !res.data.root_folder_id;

                if (needsSetup) {
                    window.location.href = "/setup";
                } else if (res.data.root_folder_id) {
                    // Only set initial state if not already navigating
                    if (!currentFolderId) {
                        setCurrentFolderId(res.data.root_folder_id);
                        setCurrentView('drive');
                    }
                }
                setLoading(false);
            })
            .catch(() => window.location.href = '/login');
    };

    const fetchDriveContent = (folderId) => {
        setLoading(true);
        axios.get(`http://localhost:8001/api/drive/browse?folder_id=${folderId}`, { withCredentials: true })
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

    const handleLogout = () => { window.location.href = "http://localhost:8001/logout"; };

    // Navigation Handlers
    const handleFolderClick = (folder) => {
        setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
        setCurrentFolderId(folder.id);
    };

    const handleBreadcrumbClick = (index) => {
        if (index === -1) {
            // Home
            setBreadcrumbs([]);
            setCurrentFolderId(userData.root_folder_id);
        } else {
            // Navigate to specific crumb
            const target = breadcrumbs[index];
            setBreadcrumbs(breadcrumbs.slice(0, index + 1));
            setCurrentFolderId(target.id);
        }
    };

    if (loading && !userData) return <div className="h-screen bg-[#020202] flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex h-screen bg-[#020202] text-white font-mono overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/10 bg-[#050505] flex flex-col justify-between hidden md:flex">
                <div>
                    <div className="p-6">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20"><Terminal size={20} /></div>
                            <span className="font-bold tracking-tight">SmartDoc</span>
                        </Link>
                    </div>
                    <nav className="px-4 space-y-1">
                        <NavItem
                            icon={Folder}
                            label="My Drive"
                            active={currentView === 'drive'}
                            onClick={() => {
                                setCurrentView('drive');
                                setCurrentFolderId(userData?.root_folder_id);
                                setBreadcrumbs([]);
                            }}
                        />
                        <NavItem icon={Clock} label="WhatsApp Bot" active={false} to={`https://wa.me/${import.meta.env.VITE_BOT_NUMBER}`} />
                        <NavItem icon={Trash2} label="Trash" active={currentView === 'trash'} onClick={() => setCurrentView('trash')} />
                    </nav>

                    <div className="my-6 px-6">
                        <div className="h-px bg-white/10" />
                    </div>

                    <nav className="px-4 space-y-1">
                        <NavItem
                            icon={Settings}
                            label="Settings"
                            active={currentView === 'settings'}
                            onClick={() => setCurrentView('settings')}
                        />
                    </nav>
                </div>
                <div className="p-4 bg-white/5 m-4 rounded-xl border border-white/5 space-y-4">
                    <div>
                        <div className="flex justify-between text-xs text-white/50 mb-2">
                            <span>Storage</span>
                            <span>--</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full w-[10%] bg-blue-500 rounded-full" />
                        </div>
                        <div className="mt-2 text-[10px] text-white/30">
                            Drive Sync Active
                        </div>
                    </div>
                    <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                        <img src={userData?.picture || `https://ui-avatars.com/api/?name=${userData?.name || "User"}&background=random`} alt="User" className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500" />
                        <div className="flex-1 min-w-0"><div className="text-xs font-bold truncate">{userData?.name || "User"}</div>
                            <div className="text-[10px] text-white/40 truncate">{userData?.phone || "No Phone"}</div>
                        </div>
                        <button onClick={handleLogout} className="text-white/30 hover:text-red-400"><LogOut size={14} /></button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#020202] relative">
                <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#020202]/80 backdrop-blur-md sticky top-0 z-20">
                    <h1 className="font-bold text-lg">My Drive</h1>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center bg-white/5 rounded-lg px-3 py-1.5 border border-white/10">
                            <Search size={14} className="text-white/30 mr-2" />
                            <input type="text" placeholder="Search..." className="bg-transparent text-sm focus:outline-none w-48 placeholder:text-white/20" />
                        </div>
                        <button onClick={() => window.location.href = '/setup'} className="bg-white text-black text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 transition-colors">
                            <Plus size={16} /> New
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 relative z-10">
                    {currentView === 'drive' && (
                        <>
                            <Breadcrumbs items={breadcrumbs} onNavigate={handleBreadcrumbClick} />

                            {/* Content Area */}
                            {loading ? (
                                <div className="flex justify-center py-20">
                                    <Loader2 className="animate-spin text-white/30" />
                                </div>
                            ) : (
                                <>
                                    {/* Folders Section */}
                                    {folders.length > 0 && (
                                        <div className="mb-8">
                                            <h2 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-4">Folders</h2>
                                            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                                {folders.map(folder => (
                                                    <FolderCard key={folder.id} folder={folder} onClick={handleFolderClick} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Files Section */}
                                    <div>
                                        <h2 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-4">
                                            {files.length > 0 ? 'Files' : folders.length === 0 ? 'Empty Folder' : ''}
                                        </h2>
                                        {files.length > 0 ? (
                                            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                                {files.map(file => (
                                                    <FileCard key={file.id} file={file} />
                                                ))}
                                            </div>
                                        ) : folders.length === 0 && (
                                            <div className="text-white/20 text-sm italic py-12 text-center border border-dashed border-white/10 rounded-xl">
                                                This folder is empty.
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {currentView === 'trash' && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                                <Trash2 size={40} className="text-white/20" />
                            </div>
                            <h2 className="text-xl font-bold mb-2">Trash</h2>
                            <p className="text-white/50 max-w-sm">Items moved to trash will appear here.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

function NavItem({ icon: Icon, label, active, onClick, to }) {
    const className = `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group ${active ? 'bg-blue-600/10 text-blue-400' : 'text-white/60 hover:bg-white/5 hover:text-white'}`;

    if (to) {
        if (to.startsWith('http')) {
            return (
                <a href={to} target="_blank" rel="noreferrer" className={className}>
                    <Icon size={18} className={active ? 'text-blue-400' : 'text-white/40 group-hover:text-white'} />
                    <span className="font-medium">{label}</span>
                </a>
            );
        }
        return (
            <Link to={to} className={className}>
                <Icon size={18} className={active ? 'text-blue-400' : 'text-white/40 group-hover:text-white'} />
                <span className="font-medium">{label}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
            </Link>
        )
    }

    return (
        <button onClick={onClick} className={className}>
            <Icon size={18} className={active ? 'text-blue-400' : 'text-white/40 group-hover:text-white'} />
            <span className="font-medium">{label}</span>
            {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
        </button>
    )
}