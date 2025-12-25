import React, { useState } from "react";
import axios from "axios";
import {
    Folder, Sparkles, ArrowRight, FileUp, X, UploadCloud, Loader2, ChevronLeft, Plus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SetupScreen({ userData, onComplete }) {
    const [showWizard, setShowWizard] = useState(false);
    const [slide, setSlide] = useState(0);

    const slides = [
        { title: "SmartDoc", subtitle: "Intelligent Workspace", desc: "Organize assignments and syllabus with zero effort.", icon: <Sparkles size={48} /> },
        { title: "Deep Structure", subtitle: "Auto-Sorting", desc: "We sort files into Subjects and Units automatically.", icon: <Folder size={48} /> },
        { title: "Syllabus AI", subtitle: "Analyze & Build", desc: "Upload your syllabus. AI creates your folders and units.", icon: <FileUp size={48} /> }
    ];

    if (showWizard) return <SetupWizard userData={userData} onComplete={onComplete} />;

    return (
        <div className="fixed inset-0 z-50 bg-black text-white flex items-center justify-center p-6 font-mono">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md text-center">
                <div className="mb-12 h-20 flex items-center justify-center">
                    <AnimatePresence mode="wait">
                        <motion.div key={slide} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <div className="mb-8 inline-flex p-6 bg-white/5 rounded-full border border-white/10">{slides[slide].icon}</div>
                        </motion.div>
                    </AnimatePresence>
                </div>
                <div className="min-h-[160px]">
                    <h2 className="text-4xl font-bold mb-2 tracking-tight">{slides[slide].title}</h2>
                    <p className="text-lg text-white/60 mb-4">{slides[slide].subtitle}</p>
                    <p className="text-white/40 text-sm max-w-xs mx-auto leading-relaxed">{slides[slide].desc}</p>
                </div>
                <div className="flex items-center justify-center gap-12 mt-8">
                    <div className="flex gap-2">
                        {slides.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === slide ? 'w-8 bg-white' : 'w-1.5 bg-white/20'}`} />
                        ))}
                    </div>
                    <button onClick={() => slide < slides.length - 1 ? setSlide(s => s + 1) : setShowWizard(true)} className="w-12 h-12 rounded-full border border-white/20 hover:bg-white hover:text-black flex items-center justify-center transition-all">
                        <ArrowRight size={20} />
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function SetupWizard({ userData, onComplete }) {
    const [step, setStep] = useState(1);
    const [subjects, setSubjects] = useState(["Physics", "Chemistry", "Maths", "CS"]);
    const [customSubject, setCustomSubject] = useState("");
    const [uploading, setUploading] = useState(false);

    const handleSyllabusUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);

        const formData = new FormData();
        formData.append("syllabus", file);
        formData.append("phone", userData.phone);

        try {
            // AI Analysis Endpoint - This creates folders and subfolders (chapters)
            const res = await axios.post("http://localhost:8001/api/analyze-syllabus", formData, {
                withCredentials: true,
                headers: { "Content-Type": "multipart/form-data" }
            });
            onComplete(res.data.subjects); // Returns to dashboard
        } catch (err) {
            alert("AI Analysis failed. Please try manual setup.");
            setStep(1);
        } finally {
            setUploading(false);
        }
    };

    const handleManualFinalize = async () => {
        setUploading(true);
        try {
            await axios.post('http://localhost:8001/api/complete-setup', { phone: userData.phone, subjects }, { withCredentials: true });
            onComplete();
        } catch (err) { alert("Setup failed"); }
        finally { setUploading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 text-white font-mono">
            <div className="w-full max-w-xl">
                {step === 1 ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <h2 className="text-3xl font-bold mb-2">Subject Selection</h2>
                        <p className="text-white/40 mb-8">Choose subjects or upload syllabus for AI unit detection.</p>
                        <div className="flex flex-wrap gap-2 mb-8">
                            {subjects.map(s => (
                                <button key={s} onClick={() => setSubjects(subjects.filter(x => x !== s))} className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm flex items-center gap-2">
                                    {s} <X size={12} />
                                </button>
                            ))}
                            <input type="text" placeholder="Add..." value={customSubject} onChange={e => setCustomSubject(e.target.value)} onKeyPress={e => e.key === 'Enter' && setSubjects([...subjects, customSubject])} className="pl-4 pr-4 py-2 bg-transparent border border-dashed border-white/20 rounded-full text-sm w-24 focus:w-40 transition-all" />
                        </div>
                        <div className="space-y-3">
                            <button onClick={handleManualFinalize} className="w-full py-4 bg-white text-black font-bold rounded-xl">Create Workspace</button>
                            <button onClick={() => setStep(2)} className="w-full py-4 bg-white/5 font-bold rounded-xl flex items-center justify-center gap-2"><UploadCloud size={18} /> Upload Syllabus (AI Analysis)</button>
                        </div>
                    </motion.div>
                ) : (
                    <div className="text-center">
                        <button onClick={() => setStep(1)} className="mb-6 flex items-center gap-2 text-white/40 mx-auto text-sm"><ChevronLeft size={16} /> Back</button>
                        <h2 className="text-3xl font-bold mb-8">Syllabus AI</h2>
                        <div className="border border-dashed border-white/20 rounded-2xl p-12 relative cursor-pointer group">
                            <input type="file" onChange={handleSyllabusUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <FileUp size={48} className="mx-auto mb-4 text-white/20 group-hover:text-white group-hover:scale-110 transition-all" />
                            <p>Drop PDF for AI structure analysis</p>
                            {uploading && (
                                <div className="absolute inset-0 bg-black flex items-center justify-center rounded-2xl">
                                    <Loader2 className="animate-spin mr-3" /> Analyzing Units...
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}