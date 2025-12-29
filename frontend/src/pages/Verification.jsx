import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Smartphone, CheckCircle2, Loader2, ArrowRight, Shield, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const Verification = () => {
    const navigate = useNavigate();
    const [phone, setPhone] = useState("...");
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
        // Function to check status from Backend
        const fetchStatus = () => {
            axios.get(`${API_URL}/api/dashboard-data`, { withCredentials: true })
                .then(res => {
                    if (res.data.phone) setPhone(res.data.phone);
                    const status = res.data.status;

                    // If status is no longer NEW, they have verified!
                    if (["CONNECTED", "AWAITING_SYLLABUS", "ACTIVE", "EDITING_LIST"].includes(status)) {
                        setIsVerified(true);

                        // Wait 1.5s for success animation then navigate
                        setTimeout(() => {
                            if (status === "ACTIVE") {
                                navigate('/dashboard');
                            } else {
                                navigate('/setup');
                            }
                        }, 1500);
                    }
                })
                .catch((err) => console.error("Waiting for login...", err));
        };

        // 1. Initial Check
        fetchStatus();

        // 2. Poll every 2 seconds
        const interval = setInterval(() => {
            if (!isVerified) fetchStatus();
        }, 2000);

        return () => clearInterval(interval);
    }, [isVerified, navigate]);

    return (
        <div className="min-h-screen bg-[#020202] text-white font-mono flex flex-col items-center justify-center relative overflow-hidden">

            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-30"
                style={{
                    backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)',
                    backgroundSize: '32px 32px'
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-transparent to-purple-900/10 z-0 pointer-events-none" />

            {/* Glowing Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

            {/* Navbar Placeholder */}
            <div className="absolute top-8 left-8 z-20">
                <Link to="/" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors group">
                    <div className="p-1.5 rounded-md bg-white/5 group-hover:bg-white/10 transition-colors border border-white/10">
                        <Terminal size={16} />
                    </div>
                    <span className="text-sm font-bold tracking-tight">SmartDoc.ai</span>
                </Link>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md relative z-10 mx-4"
            >
                <div className="bg-[#0a0a0a]/80 border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden group">

                    {/* Top Accent Gradient */}
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r transition-all duration-1000 ${isVerified ? 'from-green-500 via-emerald-500 to-green-500' : 'from-yellow-500 via-orange-500 to-yellow-500'}`} />

                    <div className="mb-8">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider mb-4 transition-colors duration-500 ${isVerified ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'}`}>
                            {isVerified ? <CheckCircle2 size={12} /> : <Shield size={12} />}
                            <span>{isVerified ? "Verified" : "Verification Pending"}</span>
                        </div>

                        <h1 className="text-3xl font-bold mb-2 tracking-tight text-white">
                            {isVerified ? "You're all set!" : "Verify Phone"}
                        </h1>
                        <p className="text-white/40 text-sm leading-relaxed">
                            {isVerified
                                ? "Redirecting you to setup..."
                                : `Start the bot to verify ownership of ${phone}`
                            }
                        </p>
                    </div>

                    {!isVerified && (
                        <div className="space-y-6">
                            {/* Instruction Box */}
                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-start gap-4 transition-all hover:bg-white/[0.07]">
                                <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 shrink-0">
                                    <Terminal size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white mb-1">Send Verification Code</p>
                                    <p className="text-xs text-white/40 leading-relaxed">
                                        Open WhatsApp and send the code <span className="text-white bg-white/10 px-1.5 py-0.5 rounded font-mono border border-white/10 mx-1">VERIFY</span> to start.
                                    </p>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="relative group/btn">
                                <a
                                    href={`https://wa.me/${import.meta.env.VITE_BOT_NUMBER}?text=VERIFY`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full py-4 bg-white hover:bg-gray-200 text-black font-bold rounded-xl flex items-center justify-center gap-3 transition-all relative overflow-hidden shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <Smartphone size={18} className="text-green-600" />
                                    <span>Open WhatsApp</span>
                                    <ArrowRight size={16} className="absolute right-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </a>
                            </div>

                            {/* Status Indicator */}
                            <div className="flex items-center justify-center gap-3 text-xs text-white/30 pt-2">
                                <div className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </div>
                                <span className="font-mono tracking-wide">LISTENING FOR "VERIFY"...</span>
                            </div>
                        </div>
                    )}

                    {isVerified && (
                        <div className="py-8 flex justify-center">
                            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                        </div>
                    )}
                </div>

                <div className="mt-6 text-center">
                    <div className="inline-flex items-center gap-2 text-white/20 text-[10px] uppercase tracking-widest">
                        <Shield size={10} />
                        <span>Secure Connection</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Verification;