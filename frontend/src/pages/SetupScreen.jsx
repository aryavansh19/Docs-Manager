import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Folder, FileUp, ArrowRight, X, Plus, ChevronLeft, UploadCloud, Loader2 } from "lucide-react";

// --- INTRO MODAL (UNCHANGED) ---
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

// --- SETUP WIZARD (UPDATED) ---
// 1. Added userData prop here
function SetupWizard({ onComplete, userData }) {
    const [step, setStep] = useState(1);
    const [subjects, setSubjects] = useState(["Physics", "Chemistry", "Maths", "CS"]);
    const [customSubject, setCustomSubject] = useState("");
    const [uploading, setUploading] = useState(false);

    const handleAddSubject = () => {
        if (customSubject && !subjects.includes(customSubject)) {
            setSubjects([...subjects, customSubject]);
            setCustomSubject("");
        }
    };

    // inside SetupWizard component...

    // 1. UPDATED: Upload to the correct endpoint
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file); // Backend expects 'file'

        try {
            // Updated URL to your specific backend route
            const res = await axios.post("http://localhost:8001/upload-syllabus", formData, {
                withCredentials: true,
                headers: { "Content-Type": "multipart/form-data" }
            });

            // Backend now returns { "subjects": ["Maths", "Physics"] }
            if (res.data.subjects) {
                // Merge new subjects with defaults
                const newSubjects = [...new Set([...subjects, ...res.data.subjects])];
                setSubjects(newSubjects);
                setStep(1); // Go to step 1 to review found subjects
            }
        } catch (err) {
            console.error("Upload failed", err);
            alert("Upload failed. Ensure you are logged in.");
        } finally {
            setUploading(false);
        }
    };

    // 2. UPDATED: Finalize setup using 'create-folders' endpoint
    const handleSetupComplete = async (finalSubjects) => {
        // Your backend expects FormData with 'selected_subjects' list
        const formData = new FormData();

        // Append each subject individually so Python .getlist() works
        finalSubjects.forEach(subject => {
            formData.append("selected_subjects", subject);
        });

        try {
            await axios.post('http://localhost:8001/create-folders', formData, {
                withCredentials: true,
                headers: { "Content-Type": "multipart/form-data" }
            });
            // Success! Redirect
            window.location.href = "/dashboard";
        } catch (err) {
            alert("Setup failed: " + err.message);
        }
    };

    // Pass this updated handler to the wizard
    const handleFinalize = () => {
        setStep(3);
        // Call the API
        handleSetupComplete(subjects);
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#020202] text-white flex items-center justify-center p-6">
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

// --- MAIN SETUP COMPONENT ---
export default function Setup() {
    const [showIntro, setShowIntro] = useState(true);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get('http://localhost:8001/api/dashboard-data', { withCredentials: true })
            .then(res => {
                setUserData(res.data);
                if (res.data.status !== "AWAITING_SYLLABUS" && res.data.root_folder_id) {
                    window.location.href = "/dashboard";
                } else if (res.data.status !== "AWAITING_SYLLABUS") {
                    setShowIntro(false);
                }
                setLoading(false);
            })
            .catch(() => window.location.href = '/login');
    }, []);

    const handleSetupComplete = (subjects) => {
        axios.post('http://localhost:8001/api/complete-setup', { phone: userData?.phone, subjects: subjects }, { withCredentials: true })
            .then(res => {
                window.location.href = "/dashboard";
            }).catch(err => {
                alert("Setup failed: " + err.message);
            });
    };

    if (loading) return <div className="h-screen bg-[#020202] flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="bg-[#020202] h-screen text-white font-mono">
            <AnimatePresence>
                {showIntro ? (
                    <IntroModal onComplete={() => setShowIntro(false)} />
                ) : (
                    // 3. PASSED USERDATA HERE
                    <SetupWizard userData={userData} onComplete={handleSetupComplete} />
                )}
            </AnimatePresence>
        </div>
    );
}