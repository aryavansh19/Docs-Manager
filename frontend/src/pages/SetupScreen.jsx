import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles, Folder, ArrowRight, X, Plus, ChevronDown, ChevronRight, CheckCircle2,
    LayoutDashboard, ArrowRightCircle, Wand2, Loader2
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

// --- ANIMATION VARIANTS ---
const slideVariants = {
    enter: (direction) => ({ x: direction > 0 ? 1000 : -1000, opacity: 0 }),
    center: { zIndex: 1, x: 0, opacity: 1 },
    exit: (direction) => ({ zIndex: 0, x: direction < 0 ? 1000 : -1000, opacity: 0 })
};

// --- SUBJECT ACCORDION (Unchanged UI) ---
function SubjectAccordion({ subject, units, onRemove, onAddUnit, onRemoveUnit, expanded, onToggle }) {
    const [newUnit, setNewUnit] = useState("");
    const handleAdd = () => {
        if (newUnit.trim()) { onAddUnit(subject.id, newUnit); setNewUnit(""); }
    };

    return (
        <div className="mb-3 bg-white/5 border border-white/5 rounded-xl overflow-hidden transition-all hover:border-white/10 group">
            <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02]" onClick={onToggle}>
                <div className={`p-2 rounded-lg transition-colors ${expanded ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/40'}`}>
                    {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
                <div className="flex-1 font-medium text-white/90 text-lg">{subject.name}</div>
                <div className="text-xs text-white/40 font-mono mr-2">{units.length} Units</div>
                <button onClick={(e) => { e.stopPropagation(); onRemove(subject.id); }} className="p-2 hover:bg-red-500/20 text-white/30 hover:text-red-400 rounded-lg transition-colors">
                    <X size={16} />
                </button>
            </div>
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-[#020202]/30">
                        <div className="p-4 pt-0 pl-16">
                            <div className="space-y-2 mb-4">
                                {units.map((unit, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 bg-white/5 rounded-lg border border-white/5 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                                            <span className="text-white/70">{unit}</span>
                                        </div>
                                        <button onClick={() => onRemoveUnit(subject.id, unit)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all"><X size={14} /></button>
                                    </div>
                                ))}
                                {units.length === 0 && <span className="text-xs text-white/20 italic">No units yet. Add one below.</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <Plus size={14} className="text-white/30" />
                                <input type="text" placeholder="Add custom unit..." className="bg-transparent border-none focus:outline-none text-sm text-white placeholder:text-white/20 flex-1 h-8" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
                                {newUnit && <button onClick={handleAdd} className="text-blue-400 text-xs font-bold px-2">ADD</button>}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// --- MAIN SETUP COMPONENT ---
export default function Setup() {
    const [phase, setPhase] = useState(0);
    const [direction, setDirection] = useState(0);
    const [loading, setLoading] = useState(true);
    const [subjects, setSubjects] = useState([]);
    const [newSubjectName, setNewSubjectName] = useState("");
    const [expandedId, setExpandedId] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    // 1. Authentication Check
    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { navigate("/login"); return; }

            const { data: profile } = await supabase.from('profiles').select('root_folder_id').eq('id', user.id).single();

            // If they already have a folder ID, send them to dashboard
            if (profile?.root_folder_id) {
                navigate("/dashboard");
            }
            setLoading(false);
        };
        checkUser();
    }, [navigate]);

    // Handlers
    const addSubject = () => {
        if (newSubjectName.trim()) {
            setSubjects([...subjects, { id: Date.now().toString(), name: newSubjectName, units: [] }]);
            setNewSubjectName("");
        }
    };

    const removeSubject = (id) => setSubjects(subjects.filter(s => s.id !== id));

    const addUnit = (subjectId, unitName) => {
        setSubjects(subjects.map(s => s.id === subjectId ? { ...s, units: [...s.units, unitName] } : s));
    };

    const removeUnit = (subjectId, unitName) => {
        setSubjects(subjects.map(s => s.id === subjectId ? { ...s, units: s.units.filter(u => u !== unitName) } : s));
    };

    // 2. Updated File Upload (Includes Auth Header)
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setAnalyzing(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            // Get Token to secure the upload
            const { data: { session } } = await supabase.auth.getSession();

            const res = await axios.post(`${API_URL}/api/upload-syllabus`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    "Authorization": `Bearer ${session?.access_token}` // Send Token!
                }
            });

            // ... (Parsing logic matches your original code exactly) ...
            const data = res.data;
            let backendSubjects = [];

            if (data.subjects && typeof data.subjects === 'object' && !Array.isArray(data.subjects)) {
                backendSubjects = Object.entries(data.subjects).map(([name, units], i) => ({
                    id: `ai-${Date.now()}-${i}`, name: name, units: Array.isArray(units) ? units : []
                }));
            } else if (typeof data === 'object' && !Array.isArray(data) && data !== null && !data.subjects) {
                backendSubjects = Object.entries(data).map(([name, units], i) => ({
                    id: `ai-${Date.now()}-${i}`, name: name, units: Array.isArray(units) ? units : []
                }));
            } else if (Array.isArray(data.subjects)) {
                backendSubjects = data.subjects.map((item, i) => {
                    if (typeof item === 'string') return { id: `ai-${i}`, name: item, units: [] };
                    return { id: `ai-${i}`, name: item.name || item.subject || "Untitled", units: item.units || [] };
                });
            }

            if (backendSubjects.length > 0) {
                const unique = [...subjects, ...backendSubjects].filter((v,i,a)=>a.findIndex(t=>(t.name===v.name))===i);
                setSubjects(unique);
            } else {
                alert("No subjects found in the response.");
            }
        } catch (err) {
            console.error("Upload failed", err);
            alert("Upload failed. Make sure your Python backend is running.");
        } finally {
            setAnalyzing(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleFinalize = async () => {
    setDirection(1);
    setPhase(3); // Show loading spinner

    try {
        // ---------------------------------------------------------
        // 1. GET SESSION (Fixed)
        // ---------------------------------------------------------
        // We use getSession() because it gives us the 'access_token' we need
        const { data: { session } } = await supabase.auth.getSession();

        if (!session || !session.user) {
            throw new Error("User not authenticated");
        }

        const user = session.user; // Get user from session

        // ---------------------------------------------------------
        // 2. CLEAN DATA
        // ---------------------------------------------------------
        const cleanSubjects = subjects.map(s => ({
            name: s.name,
            units: s.units
        }));

        // ---------------------------------------------------------
        // 3. SAVE TO SUPABASE (The "Brain")
        // ---------------------------------------------------------
        const { error: dbError } = await supabase
            .from('profiles')
            .update({
                temp_syllabus_list: cleanSubjects,
                status: 'AWAITING_FOLDERS'
            })
            .eq('id', user.id);

        if (dbError) throw dbError;

        // ---------------------------------------------------------
        // 4. CALL PYTHON BACKEND (The "Muscle")
        // ---------------------------------------------------------
        try {
            await axios.post(`${API_URL}/create-folders`,
                { subjects: cleanSubjects },
                {
                    headers: {
                        // ✅ Now session is defined, so this works!
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (apiError) {
            // Keep this non-blocking!
            // Even if Python fails momentarily, Supabase has the data.
            console.warn("Backend creation triggered but returned error (might be async):", apiError);
        }

        // 5. Go to Dashboard
        navigate("/dashboard");

    } catch (err) {
        console.error("Setup Error:", err);
        alert("Failed to save setup: " + err.message);
        setPhase(2); // Go back so they can try again
    }
    };

    const nextPhase = () => { setDirection(1); setPhase(prev => prev + 1); };

    if (loading) return <div className="h-screen bg-[#020202] flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="fixed inset-0 bg-[#050505] font-mono flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full mix-blend-screen animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-purple-600/10 blur-[150px] rounded-full mix-blend-screen animate-pulse-slow font-delay-2000" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150" />
            </div>

            <div className="relative z-10 w-full max-w-3xl h-[600px] bg-[#0a0a0a]/80 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                <AnimatePresence custom={direction} mode="wait">

                    {/* STEP 0: WELCOME */}
                    {phase === 0 && (
                        <motion.div key="welcome" variants={slideVariants} custom={direction} initial="enter" animate="center" exit="exit" transition={{ duration: 0.5 }} className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                            <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/10">
                                <Sparkles size={32} className="text-white/80" />
                            </div>
                            <h1 className="text-3xl font-bold text-white mb-4">Welcome to SmartDoc</h1>
                            <p className="text-lg text-white/50 max-w-md mx-auto mb-12">Your intelligent workspace for managing assignments and syllabus.</p>
                            <button onClick={nextPhase} className="group flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-xl hover:scale-105 transition-all">
                                <span>Get Started</span> <ArrowRightCircle size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </motion.div>
                    )}

                    {/* STEP 1: INTRO */}
                    {phase === 1 && (
                        <motion.div key="intro" variants={slideVariants} custom={direction} initial="enter" animate="center" exit="exit" transition={{ duration: 0.5 }} className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                            <h2 className="text-2xl font-bold text-white mb-4">Setup your Workspace</h2>
                            <p className="text-white/50 max-w-sm mx-auto mb-10">You haven't created any folders yet. Let's configure your subjects and units.</p>
                            <button onClick={nextPhase} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2">
                                <LayoutDashboard size={18} /> Start Setup
                            </button>
                        </motion.div>
                    )}

                    {/* STEP 2: SETUP SCREEN */}
                    {phase === 2 && (
                        <motion.div key="setup" variants={slideVariants} custom={direction} initial="enter" animate="center" exit="exit" transition={{ duration: 0.5 }} className="absolute inset-0 flex flex-col">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-black/20">
                                <div><h2 className="text-xl font-bold">Configure Folders</h2><p className="text-white/40 text-xs">Create manually or use AI.</p></div>
                                <div className="text-xs font-mono text-white/30 border border-white/10 px-2 py-1 rounded">{subjects.length} Subjects</div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
                                    <Sparkles className="text-blue-400 shrink-0 mt-0.5" size={18} />
                                    <div>
                                        <p className="text-sm text-blue-200 font-medium mb-1">You can skip this step!</p>
                                        <p className="text-xs text-blue-200/60 leading-relaxed">If you skip, we'll create a default folder structure automatically.</p>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row gap-4 mb-8">
                                    <div className="flex-1 flex gap-2">
                                        <div className="relative flex-1">
                                            <input type="text" placeholder="Subject name..." className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 pl-10 text-sm focus:outline-none focus:border-blue-500/50 text-white" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubject()} />
                                            <Plus className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                                        </div>
                                        <button onClick={addSubject} className="h-12 w-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white"><Plus size={20} /></button>
                                    </div>

                                    <div className="relative">
                                        <input type="file" onChange={handleFileUpload} ref={fileInputRef} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" accept=".pdf" disabled={analyzing} />
                                        <button className={`h-12 px-5 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-blue-500/20 whitespace-nowrap ${analyzing ? 'opacity-80' : ''}`}>
                                            {analyzing ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />} <span>{analyzing ? "Scanning..." : "Auto-Fill PDF"}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 pb-6">
                                    {subjects.length > 0 ? (
                                        subjects.map(subject => (
                                            <SubjectAccordion key={subject.id} subject={subject} units={subject.units} expanded={expandedId === subject.id} onToggle={() => setExpandedId(expandedId === subject.id ? null : subject.id)} onRemove={removeSubject} onAddUnit={addUnit} onRemoveUnit={removeUnit} />
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/5 rounded-2xl text-center">
                                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3 text-white/20"><Folder size={24} /></div>
                                            <p className="text-white/30 font-medium">No folders yet</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 border-t border-white/5 bg-black/20 backdrop-blur-md shrink-0">
                                <button onClick={handleFinalize} className={`w-full py-4 font-bold text-base rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg ${subjects.length > 0 ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                    {subjects.length > 0 ? <CheckCircle2 size={18} /> : <ArrowRightCircle size={18} />}
                                    {subjects.length > 0 ? "Create Dashboard" : "Skip & Create Default"}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: LOADING */}
                    {phase === 3 && (
                        <motion.div key="loading" variants={slideVariants} custom={direction} initial="enter" animate="center" exit="exit" className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <div className="relative w-20 h-20 mb-6">
                                <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
                                <div className="absolute inset-0 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Finalizing Setup</h3>
                            <p className="text-white/40 text-sm">Saving your preferences...</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}