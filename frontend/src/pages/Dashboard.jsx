import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
    Terminal, Folder, Clock, Trash2, Settings, Search, Plus, Grid, List,
    MoreVertical, FileText, Image as ImageIcon, FileCode, LogOut, ChevronRight,
    Loader2, CheckCircle, X, UploadCloud, Sparkles, ArrowRight, FileUp, AlertTriangle, ChevronLeft, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- INTRO MODAL (MINIMALIST) ---
function IntroModal({ onComplete }) {
    const [slide, setSlide] = useState(0);

    const slides = [
        {
            title: "SmartDoc",
            subtitle: "Intelligent Workspace",
            desc: "Organize assignments and syllabus with zero effort.",
            icon: <Sparkles size={48} className="text-white" />
        },
        {
            title: "Deep Structure",
            subtitle: "Auto-Sorting Folders",
            desc: "We sort files into Subjects and Units automatically.",
            icon: <Folder size={48} className="text-white" />
        },
        {
            title: "Syllabus AI",
            subtitle: "Upload & Analyze",
            desc: "Drop your syllabus PDF. We'll handle the rest.",
            icon: <FileUp size={48} className="text-white" />
        }
    ];

    const nextSlide = () => {
        if (slide < slides.length - 1) {
            setSlide(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black text-white flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-md text-center"
            >
                <div className="mb-12 h-20 flex items-center justify-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={slide}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="mb-8 inline-flex p-6 bg-white/5 rounded-full border border-white/10">{slides[slide].icon}</div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="min-h-[160px]">
                    <AnimatePresence mode="wait">
                        <motion.div key={slide} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <h2 className="text-4xl font-bold mb-2 tracking-tight">{slides[slide].title}</h2>
                            <p className="text-lg text-white/60 mb-4">{slides[slide].subtitle}</p>
                            <p className="text-white/40 text-sm max-w-xs mx-auto leading-relaxed">{slides[slide].desc}</p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="flex items-center justify-center gap-12 mt-8">
                    <div className="flex gap-2">
                        {slides.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === slide ? 'w-8 bg-white' : 'w-1.5 bg-white/20'}`} />
                        ))}
                    </div>
                    <button
                        onClick={nextSlide}
                        className="w-12 h-12 rounded-full border border-white/20 hover:bg-white hover:text-black flex items-center justify-center transition-all group"
                    >
                        <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

// --- SETUP WIZARD (MINIMALIST) ---
function SetupWizard({ onComplete, onClose }) {
    const [step, setStep] = useState(1); // 1: Subjects, 2: Upload, 3: Processing
    const [subjects, setSubjects] = useState(["Physics", "Chemistry", "Maths", "CS"]);
    const [customSubject, setCustomSubject] = useState("");
    const [uploading, setUploading] = useState(false);

    const handleAddSubject = () => {
        if (customSubject && !subjects.includes(customSubject)) {
            setSubjects([...subjects, customSubject]);
            setCustomSubject("");
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        setTimeout(() => {
            setUploading(false);
            setStep(3);
        }, 2000);
    };

    const handleFinalize = () => {
        setStep(3);
        setTimeout(() => {
            onComplete(subjects);
        }, 2000);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 text-white">
            <button onClick={onClose} className="absolute top-8 right-8 text-white/30 hover:text-white transition-colors"><X size={24} /></button>

            <div className="w-full max-w-xl">
                {step === 1 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <h2 className="text-3xl font-bold mb-2">Your Subjects</h2>
                        <p className="text-white/40 mb-8">Define your main folders.</p>

                        <div className="flex flex-wrap gap-2 mb-8">
                            {subjects.map((subj) => (
                                <button
                                    key={subj}
                                    onClick={() => setSubjects(subjects.filter(s => s !== subj))}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm flex items-center gap-2 group transition-all"
                                >
                                    {subj}
                                    <X size={12} className="text-white/30 group-hover:text-white" />
                                </button>
                            ))}
                            <div className="relative">
                                <Plus size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    type="text"
                                    placeholder="Add..."
                                    value={customSubject}
                                    onChange={(e) => setCustomSubject(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddSubject()}
                                    className="pl-9 pr-4 py-2 bg-transparent border border-dashed border-white/20 rounded-full text-sm focus:outline-none focus:border-white/50 w-24 focus:w-40 transition-all placeholder:text-white/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button onClick={handleFinalize} className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">
                                Create Workspace
                            </button>
                            <button onClick={() => setStep(2)} className="w-full py-4 bg-white/5 hover:bg-white/10 font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                                <UploadCloud size={18} />
                                Upload Syllabus
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                        <button onClick={() => setStep(1)} className="mb-6 flex items-center gap-2 text-white/40 hover:text-white mx-auto text-sm"><ChevronLeft size={16} /> Back</button>
                        <h2 className="text-3xl font-bold mb-8">Upload Syllabus</h2>

                        <div className="border border-dashed border-white/20 rounded-2xl p-12 hover:bg-white/5 transition-colors relative cursor-pointer group">
                            <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <div className="mb-6 w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-white/50 group-hover:text-white group-hover:scale-110 transition-all">
                                <FileUp size={32} />
                            </div>
                            <p className="font-medium mb-1">Drop your PDF here</p>
                            <p className="text-xs text-white/30">Max 10MB</p>

                            {uploading && (
                                <div className="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <Loader2 className="animate-spin" />
                                        <span>Analyzing...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {step === 3 && (
                    <div className="text-center">
                        <Loader2 className="animate-spin w-12 h-12 mx-auto mb-6 text-white/50" />
                        <h2 className="text-2xl font-bold">Setting up...</h2>
                    </div>
                )}
            </div>
        </div>
    )
}

// --- FOLDER ACCORDION COMPONENT ---
function FolderAccordion({ folder, subfolders, loading, onToggle, onNavigate, expanded }) {
    return (
        <div className="border-b border-white/5 last:border-0 bg-[#050505]">
            <div
                onClick={onToggle}
                className={`flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-colors group ${expanded ? 'bg-white/[0.02]' : ''}`}
            >
                <div className={`p-2 rounded-lg transition-colors ${expanded ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/40 group-hover:text-white'}`}>
                    {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
                <div className="flex-1" onClick={(e) => { e.stopPropagation(); onNavigate(folder); }}>
                    <h3 className="font-medium text-lg text-white/90 group-hover:text-white transition-colors hover:underline decoration-white/30 underline-offset-4">{folder.name}</h3>
                    <p className="text-xs text-white/40">{folder.childCount || subfolders?.length || 0} Units</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                    <button className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white" title="Upload to this subject">
                        <UploadCloud size={16} />
                    </button>
                </div>
            </div>

            {/* Content (Units as Subfolders) */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-white/[0.02]"
                    >
                        <div className="p-2 pl-16 grid gap-1">
                            {loading ? (
                                <div className="flex items-center gap-3 p-3 text-white/40 text-sm">
                                    <Loader2 size={14} className="animate-spin" />
                                    Loading units...
                                </div>
                            ) : subfolders && subfolders.length > 0 ? (
                                subfolders.map(sub => (
                                    <div
                                        key={sub.id}
                                        onClick={() => onNavigate(sub)}
                                        className="flex items-center justify-between text-sm p-3 rounded-lg hover:bg-white/5 text-white/60 hover:text-white cursor-pointer group"
                                    >
                                        <span className="flex items-center gap-3">
                                            <Folder size={14} className="text-white/20 group-hover:text-blue-400 transition-colors" />
                                            {sub.name}
                                        </span>
                                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 text-white/30" />
                                    </div>
                                ))
                            ) : (
                                <div className="p-3 text-white/20 text-sm text-center italic">
                                    No units found in this subject.
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}


// --- MAIN DASHBOARD COMPONENT ---
export default function Dashboard() {
    // UI State
    const [currentView, setCurrentView] = useState('drive');
    const [viewMode, setViewMode] = useState("accordion"); // Default to accordion
    const [loading, setLoading] = useState(true);

    // Onboarding State
    const [showIntro, setShowIntro] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [setupRequired, setSetupRequired] = useState(false);

    // Data State
    const [userData, setUserData] = useState(null);
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);

    // Navigation State
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [folderHistory, setFolderHistory] = useState([]);

    // Accordion State
    const [subfolderMap, setSubfolderMap] = useState({});
    const [loadingFolders, setLoadingFolders] = useState({});
    const [expandedFolderId, setExpandedFolderId] = useState(null);

    useEffect(() => { fetchDashboardData(); }, []);

    // Fetch subfolders for accordion
    const handleExpandFolder = async (folderId) => {
        if (expandedFolderId === folderId) {
            setExpandedFolderId(null);
            return;
        }
        setExpandedFolderId(folderId);

        if (!subfolderMap[folderId]) {
            setLoadingFolders(prev => ({ ...prev, [folderId]: true }));
            try {
                const res = await axios.get(`http://localhost:8001/api/drive/browse?folder_id=${folderId}`, { withCredentials: true });
                setSubfolderMap(prev => ({ ...prev, [folderId]: res.data.folders || [] }));
            } catch (err) {
                console.error("Failed to fetch subfolders", err);
            } finally {
                setLoadingFolders(prev => ({ ...prev, [folderId]: false }));
            }
        }
    };

    useEffect(() => {
        if (userData?.root_folder_id) {
            fetchDriveContent(currentFolderId || userData.root_folder_id);
        }
    }, [currentFolderId, userData]);

    const fetchDashboardData = () => {
        axios.get('http://localhost:8001/api/dashboard-data', { withCredentials: true })
            .then(res => {
                setUserData(res.data);
                const needsSetup = res.data.status === "AWAITING_SYLLABUS" || !res.data.root_folder_id;

                if (needsSetup) {
                    setSetupRequired(true);
                    if (res.data.status === "AWAITING_SYLLABUS") setShowIntro(true);
                } else if (res.data.root_folder_id && !currentFolderId) {
                    setCurrentFolderId(res.data.root_folder_id);
                    setCurrentView('drive');
                }
                setLoading(false);
            })
            .catch(() => window.location.href = '/login');
    };

    const fetchDriveContent = (folderId) => {
        axios.get(`http://localhost:8001/api/drive/browse?folder_id=${folderId}`, { withCredentials: true })
            .then(res => {
                setFolders(res.data.folders || []);
                setFiles(res.data.files || []);
            })
            .catch(err => console.error("Drive Fetch Error:", err));
    };

    const handleSetupComplete = (subjects) => {
        axios.post('http://localhost:8001/api/complete-setup', { phone: userData.phone, subjects: subjects })
            .then(res => {
                setShowSetup(false);
                setSetupRequired(false);
                fetchDashboardData();
            }).catch(err => {
                alert("Setup failed: " + err.message);
                setShowSetup(false);
            });
    };

    const handleLogout = () => { window.location.href = "http://localhost:8001/logout"; };

    if (loading) return <div className="h-screen bg-[#020202] flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex h-screen bg-[#020202] text-white font-mono overflow-hidden">
            <AnimatePresence>
                {showIntro && <IntroModal onComplete={() => setShowIntro(false)} />}
                {showSetup && <SetupWizard onComplete={handleSetupComplete} onClose={() => setShowSetup(false)} />}
            </AnimatePresence>

            {/* Sidebar (Unchanged) */}
            <aside className="w-64 border-r border-white/10 bg-[#050505] flex flex-col justify-between hidden md:flex">
                <div>
                    <div className="p-6">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20"><Terminal size={20} /></div>
                            <span className="font-bold tracking-tight">SmartDoc</span>
                        </Link>
                    </div>
                    <nav className="px-4 space-y-1">
                        <NavItem icon={Folder} label="My Drive" active={currentView === 'drive'} onClick={() => { setCurrentView('drive'); setCurrentFolderId(userData.root_folder_id); setFolderHistory([]); }} />
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
                        <img src={userData?.picture || `https://ui-avatars.com/api/?name=${userData?.name}&background=random`} alt="User" className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500" />
                        <div className="flex-1 min-w-0"><div className="text-xs font-bold truncate">{userData?.name || "User"}</div>
                            <div className="text-[10px] text-white/40 truncate">{userData?.phone}</div>
                        </div>
                        <button onClick={handleLogout} className="text-white/30 hover:text-red-400"><LogOut size={14} /></button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#020202] relative">
                <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                {setupRequired && (
                    <div className="bg-yellow-900/10 border-b border-yellow-500/10 px-8 py-3 flex items-center justify-between">
                        <span className="text-yellow-500/80 text-sm flex items-center gap-2"><AlertTriangle size={14} /> Setup Incomplete</span>
                        <button onClick={() => setShowSetup(true)} className="text-xs font-bold text-yellow-500 hover:underline">Finish Setup</button>
                    </div>
                )}

                <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#020202]/80 backdrop-blur-md sticky top-0 z-20">
                    <h1 className="font-bold text-lg">My Drive</h1>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center bg-white/5 rounded-lg px-3 py-1.5 border border-white/10">
                            <Search size={14} className="text-white/30 mr-2" />
                            <input type="text" placeholder="Search..." className="bg-transparent text-sm focus:outline-none w-48 placeholder:text-white/20" />
                        </div>
                        <button onClick={() => setShowSetup(true)} className="bg-white text-black text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 transition-colors">
                            <Plus size={16} /> New
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 relative z-10">
                    {currentView === 'drive' && (
                        <>
                            <div className="mb-6 flex items-center justify-between">
                                <h2 className="text-white/50 text-xs font-bold uppercase tracking-wider">
                                    Subjects ({folders.length})
                                </h2>
                                <button onClick={() => setShowSetup(true)} className="text-xs text-blue-400 hover:text-blue-300 font-bold hover:underline">
                                    Manage Subjects
                                </button>
                            </div>

                            <div className="border border-white/10 rounded-2xl overflow-hidden bg-[#050505] mb-8">
                                {folders.length > 0 ? (
                                    folders.map(folder => (
                                        <FolderAccordion
                                            key={folder.id}
                                            folder={folder}
                                            expanded={expandedFolderId === folder.id}
                                            subfolders={subfolderMap[folder.id] || []}
                                            loading={loadingFolders[folder.id]}
                                            onToggle={() => handleExpandFolder(folder.id)}
                                            //onNavigate={handleFolderClick}
                                        />
                                    ))
                                ) : (
                                    <div className="p-12 text-center text-white/30">
                                        <Folder size={48} className="mx-auto mb-4 opacity-20" />
                                        <p className="text-sm">No subjects found.</p>
                                        <button onClick={() => setShowSetup(true)} className="mt-4 text-blue-400 hover:underline text-sm font-bold">
                                            Run Setup Wizard
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Files Section */}
                            <h2 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-4">
                                {files.length > 0 ? 'Recent Files' : 'No Files'}
                            </h2>
                            {files.length > 0 ? (
                                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                                    {files.map(file => (
                                        <FileCard key={file.id} file={file} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-white/20 text-sm italic py-12 text-center border border-dashed border-white/10 rounded-xl">
                                    No files in this folder.
                                </div>
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

                    {/* Add Settings view here if needed */}
                </div>
            </main>
        </div>
    );
}



// --- SUB COMPONENTS (Kept mostly same, adjusted to accept to prop for links) ---

function NavItem({ icon: Icon, label, active, onClick, to }) {
    const className = `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group ${active ? 'bg-blue-600/10 text-blue-400' : 'text-white/60 hover:bg-white/5 hover:text-white'}`;

    if (to) {
        // If it's an external link (WhatsApp)
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

function FileCard({ file }) {
    const getIcon = (mimeType) => {
        if (mimeType.includes('pdf')) return <FileText className="text-red-400" size={24} />;
        if (mimeType.includes('image')) return <ImageIcon className="text-purple-400" size={24} />;
        if (mimeType.includes('code') || mimeType.includes('javascript') || mimeType.includes('json')) return <FileCode className="text-blue-400" size={24} />;
        return <FileText className="text-gray-400" size={24} />;
    }

    // Handle missing mock data fields gracefully
    const size = file.size || "--";
    const updated = "Recently";

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