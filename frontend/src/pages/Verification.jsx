import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Smartphone, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

const Verification = () => {
    const navigate = useNavigate();
    const [phone, setPhone] = useState("...");
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
        // 1. Initial Fetch to get Phone Number
        fetchStatus();

        // 2. Poll every 2 seconds to check if they sent the message
        const interval = setInterval(() => {
            fetchStatus();
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    const fetchStatus = () => {
        axios.get('http://localhost:8001/api/dashboard-data', { withCredentials: true })
            .then(res => {
                setPhone(res.data.phone);

                // If status is NOT pending, they are done!
                if (res.data.status !== "PENDING_VERIFICATION" && res.data.status !== "NEW") {
                    setIsVerified(true);
                    // Wait 1.5s for animation then go to dashboard
                    setTimeout(() => navigate('/dashboard'), 1500);
                }
            })
            .catch(() => navigate('/login'));
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">

                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-yellow-500 to-orange-600" />

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                        {isVerified ? (
                            <CheckCircle2 className="w-8 h-8 text-green-500 animate-bounce" />
                        ) : (
                            <Smartphone className="w-8 h-8 text-yellow-500" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold mb-2">
                        {isVerified ? "Verification Successful!" : "Verify WhatsApp"}
                    </h1>
                    <p className="text-slate-400 text-sm">
                        {isVerified
                            ? "Redirecting to your dashboard..."
                            : `To secure your account, we need to verify you own ${phone}`}
                    </p>
                </div>

                {!isVerified && (
                    <div className="space-y-6">
                        {/* Step 1 */}
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-start gap-4">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xs font-bold">1</span>
                            <div>
                                <p className="text-sm font-semibold text-slate-200">Send the verify command</p>
                                <p className="text-xs text-slate-500 mt-1">Open WhatsApp and send the word <span className="text-white font-mono">VERIFY</span></p>
                            </div>
                        </div>

                        {/* Step 2 (Button) */}
                        <a
                            href={`https://wa.me/${import.meta.env.VITE_BOT_NUMBER}?text=VERIFY`}
                            target="_blank"
                            className="block w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-center transition-all flex items-center justify-center gap-2"
                        >
                            <span>Open WhatsApp</span>
                            <ArrowRight size={16} />
                        </a>

                        {/* Step 3 (Waiting Animation) */}
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-4">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Listening for your message...</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Verification;