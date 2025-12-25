import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Terminal, ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export default function Login() {
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleLogin = () => {
        setIsLoading(true);
        // Direct browser to Python Backend (Door B: Login via Email lookup)
        window.location.href = `http://localhost:8001/login`;
    };

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

            {/* Animated Glow */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

            {/* Navbar Placeholder (Back to Home) */}
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

                    {/* Top Accent Line */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 opacity-50 group-hover:opacity-100 transition-opacity" />

                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-4">
                            <ShieldCheck size={12} />
                            <span>Access Control</span>
                        </div>
                        <h1 className="text-3xl font-bold mb-2 tracking-tight text-white">
                            Welcome Back
                        </h1>
                        <p className="text-white/40 text-sm leading-relaxed">
                            Authenticate to access your existing dashboard.
                        </p>
                    </div>

                    {/* Direct Auth Info Box */}
                    <div className="mb-8">
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                <CheckCircle size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-blue-100 mb-0.5">Direct Authentication</h3>
                                <p className="text-xs text-blue-200/60 leading-relaxed">
                                    We will identify your account using your Google Email automatically.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full py-4 bg-white hover:bg-gray-200 text-black font-bold rounded-xl flex items-center justify-center gap-3 transition-all relative overflow-hidden group/btn shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                    >
                        {isLoading ? (
                            <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                            <>
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-[18px] h-[18px] group-hover/btn:scale-110 transition-transform" />
                                <span className="tracking-wide">Continue with Google</span>
                                <ArrowRight size={16} className="absolute right-6 opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all" />
                            </>
                        )}
                    </button>

                    {/* Footer */}
                    <div className="mt-6 text-center">
                        <p className="text-white/20 text-[10px] uppercase tracking-widest">
                            Protected by reCAPTCHA Enterprise
                        </p>
                    </div>

                </div>
            </motion.div>
        </div>
    );
}