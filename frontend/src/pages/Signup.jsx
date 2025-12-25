import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Terminal, ArrowRight, UserPlus, ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Signup() {
    const [phone, setPhone] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSignup = () => {
        if (!phone || phone.length < 10) {
            alert("Please enter a valid WhatsApp number.");
            return;
        }

        setIsLoading(true);
        // DOOR A: Redirect browser to Python Backend with the phone number
        window.location.href = `http://localhost:8001/login?phone=${phone}`;
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
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-blue-900/10 z-0 pointer-events-none" />

            {/* Animated Glow */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

            {/* Navbar / Back Button */}
            <div className="absolute top-8 left-8 z-20">
                <Link to="/auth" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors group">
                    <ArrowLeft size={16} />
                    <span className="text-sm font-bold tracking-tight">Back</span>
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
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 opacity-50 group-hover:opacity-100 transition-opacity" />

                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-4">
                            <ShieldCheck size={12} />
                            <span>Registration Protocol</span>
                        </div>
                        <h1 className="text-3xl font-bold mb-2 tracking-tight text-white">
                            Join the Network
                        </h1>
                        <p className="text-white/40 text-sm leading-relaxed">
                            Link your WhatsApp to create a secure file gateway.
                        </p>
                    </div>

                    {/* Input Section */}
                    <div className="mb-6 space-y-2">
                        <label className="text-[11px] text-purple-300/70 uppercase tracking-widest font-bold ml-1">WhatsApp Number</label>
                        <div className="relative group/input">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/30 group-focus-within/input:text-purple-400 transition-colors">
                                <Phone size={18} />
                            </div>
                            <input
                                type="tel"
                                placeholder="919876543210"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all font-mono text-lg shadow-inner"
                                autoFocus
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-mono">
                                NO +
                            </div>
                        </div>
                        <p className="text-[10px] text-white/30 pl-1">
                            * Enter country code + number.
                        </p>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleSignup}
                        disabled={!phone}
                        className={`w-full py-4 font-bold rounded-xl flex items-center justify-center gap-3 transition-all relative overflow-hidden group/btn ${phone
                            ? "bg-white hover:bg-gray-200 text-black cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                            : "bg-white/5 text-white/20 cursor-not-allowed border border-white/5"
                            }`}
                    >
                        {isLoading ? (
                            <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                            <>
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-[18px] h-[18px] group-hover/btn:scale-110 transition-transform" />
                                <span className="tracking-wide">Verify & Continue</span>
                                {phone && <ArrowRight size={16} className="absolute right-6 opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all" />}
                            </>
                        )}
                    </button>

                    {/* Footer Toggle */}
                    <div className="mt-6 text-center pt-6 border-t border-white/5">
                        <p className="text-xs text-white/40">
                            Already have an account?{" "}
                            <Link to="/login" className="text-purple-400 hover:text-purple-300 font-bold underline decoration-purple-500/30 underline-offset-4 ml-1 transition-colors">
                                Log In
                            </Link>
                        </p>
                    </div>

                </div>
            </motion.div>
        </div>
    );
}