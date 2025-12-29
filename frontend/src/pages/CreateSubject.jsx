import React, { useState, useRef } from "react";
import axios from "axios";
import {
    UploadCloud, Type, Sparkles, X, Loader2, BookOpen, CheckCircle2, ArrowRight, ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

export default function CreateSubject() {
    const navigate = useNavigate();
    // Phases: 'select-mode', 'upload', 'manual', 'analyzing', 'preview', 'creating'
    const [phase, setPhase] = useState('select-mode');
    const [analyzedSubjects, setAnalyzedSubjects] = useState([]);
    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [manualName, setManualName] = useState("");
    const fileInputRef = useRef(null);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setPhase('analyzing');
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await axios.post(`${API_URL}/upload-syllabus`, formData, {
                withCredentials: true,
                headers: { "Content-Type": "multipart/form-data" }
            });
            const data = res.data;
            let backendSubjects = [];

            if (data.subjects && typeof data.subjects === 'object' && !Array.isArray(data.subjects)) {
                backendSubjects = Object.entries(data.subjects).map(([name, units]) => ({ name, units: Array.isArray(units) ? units : [] }));
            } else if (typeof data === 'object' && !Array.isArray(data) && data !== null && !data.subjects) {
                backendSubjects = Object.entries(data).map(([name, units]) => ({ name, units: Array.isArray(units) ? units : [] }));
            } else if (Array.isArray(data.subjects)) {
                backendSubjects = data.subjects.map(item => {
                    if (typeof item === 'string') return { name: item, units: [] };
                    return { name: item.name || item.subject || "Untitled", units: item.units || [] };
                });
            }

            setAnalyzedSubjects(backendSubjects);
            setSelectedSubjects(backendSubjects);
            setPhase('preview');
        } catch (err) {
            console.error(err);
            alert("Failed to analyze syllabus. Please try again.");
            setPhase('upload');
        }
    };

    const handleCreate = async () => {
        setPhase('creating');
        const formData = new FormData();
        selectedSubjects.forEach(s => formData.append("selected_subjects", s.name));

        try {
            await axios.post(`${API_URL}/create-folders`, formData, {
                withCredentials: true,
                headers: { "Content-Type": "multipart/form-data" }
            });
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            alert("Failed to create folders.");
            setPhase('preview');
        }
    };

    const handleManualCreate = async () => {
        if (!manualName.trim()) return;
        setPhase('creating');
        const formData = new FormData();
        formData.append("selected_subjects", manualName);

        try {
            await axios.post(`${API_URL}/create-folders`, formData, {
                withCredentials: true,
                headers: { "Content-Type": "multipart/form-data" }
            });
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            alert("Failed to create folder.");
            setPhase('manual');
        }
    }

    return (
        <div className="min-h-screen bg-[#050505] font-sans flex items-center justify-center relative overflow-hidden text-white selection:bg-white/20">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full mix-blend-screen opacity-50" />
                <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-purple-600/10 blur-[150px] rounded-full mix-blend-screen opacity-50" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 w-full max-w-2xl bg-[#0a0a0a]/80 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col mx-4"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-8 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 rounded-xl border border-white/5 text-blue-400">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">Add to Workspace</h2>
                            <p className="text-sm text-white/40">Expand your dashboard with new subjects</p>
                        </div>
                    </div>
                    <Link to="/dashboard" className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
                        <X size={20} />
                    </Link>
                </div>

                <div className="p-8 min-h-[400px] flex flex-col items-center justify-center">
                    <AnimatePresence mode="wait">

                        {/* MODE SELECTION */}
                        {phase === 'select-mode' && (
                            <motion.div
                                key="select"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full"
                            >
                                <button
                                    onClick={() => setPhase('upload')}
                                    className="group flex flex-col items-center gap-6 p-8 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-blue-500/30 transition-all text-center h-full"
                                >
                                    <div className="p-5 rounded-full bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/10">
                                        <UploadCloud size={40} strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-white mb-2">Upload Syllabus</h3>
                                        <p className="text-sm text-white/50 leading-relaxed">Auto-create folders & units by analyzing your syllabus PDF.</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setPhase('manual')}
                                    className="group flex flex-col items-center gap-6 p-8 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all text-center h-full"
                                >
                                    <div className="p-5 rounded-full bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/10">
                                        <Type size={40} strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-white mb-2">Manual Create</h3>
                                        <p className="text-sm text-white/50 leading-relaxed">Quickly add a single subject folder by naming it yourself.</p>
                                    </div>
                                </button>
                            </motion.div>
                        )}

                        {/* MANUAL MODE */}
                        {phase === 'manual' && (
                            <motion.div
                                key="manual"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="w-full max-w-md"
                            >
                                <label className="block text-sm font-bold text-white/60 mb-3 uppercase tracking-wider">Folder Name</label>
                                <input
                                    type="text"
                                    value={manualName}
                                    onChange={(e) => setManualName(e.target.value)}
                                    placeholder="e.g. Advanced Calculus"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-lg text-white focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all mb-8 placeholder:text-white/20"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleManualCreate()}
                                />
                                <div className="flex gap-4">
                                    <button onClick={() => setPhase('select-mode')} className="flex-1 px-6 py-4 text-sm font-bold text-white/60 hover:text-white hover:bg-white/5 rounded-2xl transition-colors">
                                        Back
                                    </button>
                                    <button onClick={handleManualCreate} disabled={!manualName.trim()} className="flex-1 px-6 py-4 bg-white text-black font-bold rounded-2xl hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex justify-center items-center gap-2 shadow-lg shadow-white/10">
                                        <span>Create Folder</span>
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </motion.div>
                        )}


                        {/* UPLOAD MODE */}
                        {phase === 'upload' && (
                            <motion.div
                                key="upload"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="w-full"
                            >
                                <div
                                    className="w-full h-72 border-2 border-dashed border-white/10 hover:border-blue-500/50 rounded-3xl flex flex-col items-center justify-center gap-6 transition-all cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] mb-8 group"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input ref={fileInputRef} type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                                    <div className="p-6 bg-blue-500/5 text-blue-400 rounded-full group-hover:scale-110 transition-transform duration-300 border border-blue-500/10">
                                        <UploadCloud size={48} strokeWidth={1.5} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xl font-medium text-white mb-2">Click to Upload Syllabus</p>
                                        <p className="text-sm text-white/40">Supports PDF files up to 10MB</p>
                                    </div>
                                </div>
                                <button onClick={() => setPhase('select-mode')} className="w-full px-4 py-3 text-sm font-bold text-white/40 hover:text-white transition-colors flex items-center justify-center gap-2">
                                    <ArrowLeft size={16} />
                                    Back to Selection
                                </button>
                            </motion.div>
                        )}

                        {(phase === 'analyzing' || phase === 'creating') && (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center gap-6"
                            >
                                <div className="relative">
                                    <div className={`absolute inset-0 blur-xl opacity-20 ${phase === 'analyzing' ? 'bg-blue-500' : 'bg-green-500'}`} />
                                    <Loader2 size={64} className={`animate-spin relative z-10 ${phase === 'analyzing' ? 'text-blue-500' : 'text-green-500'}`} />
                                </div>
                                <div className="text-center space-y-1">
                                    <h3 className="text-xl font-bold text-white">{phase === 'analyzing' ? 'Analyzing Syllabus...' : 'Creating Folders...'}</h3>
                                    <p className="text-white/40 text-sm">This might take a few seconds</p>
                                </div>
                            </motion.div>
                        )}

                        {phase === 'preview' && (
                            <motion.div
                                key="preview"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="w-full"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <p className="text-sm text-white/50 uppercase tracking-wider font-bold">Detected Subjects ({selectedSubjects.length})</p>
                                    <div className="h-px flex-1 bg-white/10 ml-6" />
                                </div>

                                <div className="grid gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar mb-8">
                                    {analyzedSubjects.map((sub, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-blue-400 rounded-xl border border-blue-500/10">
                                                    <BookOpen size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white text-sm mb-0.5">{sub.name}</h4>
                                                    <p className="text-xs text-white/40 font-mono">{sub.units.length} Units Found</p>
                                                </div>
                                            </div>
                                            <div className="bg-green-500/10 text-green-400 p-1.5 rounded-full">
                                                <CheckCircle2 size={18} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end gap-4">
                                    <button onClick={() => setPhase('upload')} className="px-6 py-3 text-sm font-bold text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                                        Cancel
                                    </button>
                                    <button onClick={handleCreate} className="px-8 py-3 bg-white text-black text-sm font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-lg shadow-white/10 flex items-center gap-2">
                                        <span>Add to Dashboard</span>
                                        <ArrowRight size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
