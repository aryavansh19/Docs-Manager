import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, FileText, MessageSquare, FolderTree, Search, Folder, CheckCircle, Shield, Lock, Send, Sparkles, UploadCloud, Mail, Github, Twitter, ChevronLeft, ChevronRight, Zap, Star } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";

const BG_COLOR = "#030303";
//Test Commit to check something
// --- CAROUSEL SLIDE DATA ---
const carouselSlides = [
    { userMsg: "Find my OS notes from semester 3", botMsg: "Here you go! Found in /University/Sem3/", botFile: "OS_Unit1_Notes.pdf", accent: "blue" },
    { userMsg: "Where is my Adhaar card?", botMsg: "Located at /Personal/Identity/ ✓", botFile: null, accent: "green" },
    { userMsg: "Send my internship offer letter", botMsg: "Found in /Career/Internship/", botFile: "Google_Offer_Letter.pdf", accent: "purple" },
    { userMsg: "Get all uber receipts", botMsg: "Found 7 receipts in /Finance/Uber/ ✓", botFile: null, accent: "yellow" },
    { userMsg: "Show my latest resume", botMsg: "Here's your latest version!", botFile: "Resume_2024_v3.pdf", accent: "pink" }
];

// --- ANIMATED FLOATING SHAPES ---
const FloatingShape = ({ delay, duration, className }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{
            opacity: [0, 0.5, 0],
            scale: [0.8, 1.2, 0.8],
            y: [0, -30, 0]
        }}
        transition={{
            duration: duration || 6,
            delay: delay || 0,
            repeat: Infinity,
            ease: "easeInOut"
        }}
        className={className}
    />
);

// --- WHATSAPP CHAT CARD (Internal Content) ---
const WhatsAppChatCard = ({ userMsg, botMsg, botFile, accent }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full h-full flex flex-col"
        >
            {/* Chat Area */}
            <div className="flex-1 p-6 space-y-5 overflow-y-auto" style={{
                backgroundColor: '#0D1418',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}>
                {/* User Message */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex justify-end"
                >
                    <div className="bg-[#005c4b] px-4 py-3 rounded-lg rounded-tr-sm max-w-[75%] shadow">
                        <p className="text-base text-white leading-snug">{userMsg}</p>
                        <div className="text-[10px] text-white/50 text-right mt-1 flex items-center justify-end gap-1">
                            10:42 AM
                            <CheckCircle size={11} className="text-blue-300" />
                        </div>
                    </div>
                </motion.div>

                {/* Bot Response */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex justify-start"
                >
                    <div className="bg-[#1f2c34] px-4 py-3 rounded-lg rounded-tl-sm max-w-[80%] shadow border-l-2 border-green-500">
                        {botFile && (
                            <div className="flex items-center gap-3 bg-black/20 rounded-lg p-3 mb-3 border border-white/5">
                                <div className="w-10 h-12 bg-red-500/20 rounded flex items-center justify-center">
                                    <FileText size={24} className="text-red-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white font-medium truncate">{botFile}</div>
                                    <div className="text-[10px] text-white/40">PDF • 2.4 MB</div>
                                </div>
                            </div>
                        )}
                        <p className="text-base text-white/90 leading-snug">{botMsg}</p>
                        <div className="text-[10px] text-white/40 mt-1">10:42 AM</div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};

// --- CAROUSEL ---
const ChatCarousel = () => {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrent((prev) => (prev + 1) % carouselSlides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="relative w-full h-full">
            <AnimatePresence mode="wait">
                <WhatsAppChatCard key={current} {...carouselSlides[current]} />
            </AnimatePresence>

            {/* Navigation Arrows */}
            <button onClick={() => setCurrent((c) => (c - 1 + carouselSlides.length) % carouselSlides.length)} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16 w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 hover:scale-110 transition-all hidden lg:flex">
                <ChevronLeft size={24} />
            </button>
            <button onClick={() => setCurrent((c) => (c + 1) % carouselSlides.length)} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-16 w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 hover:scale-110 transition-all hidden lg:flex">
                <ChevronRight size={24} />
            </button>

            {/* Dots */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex justify-center gap-2">
                {carouselSlides.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setCurrent(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'bg-white w-6' : 'bg-white/20 w-1.5 hover:bg-white/40'}`}
                    />
                ))}
            </div>
        </div>
    );
};

// --- BENTO CARD ---
const BentoCard = ({ className, title, desc, icon: Icon, children, gradient }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        className={`group relative rounded-3xl border border-white/10 p-6 lg:p-8 overflow-hidden hover:border-white/20 transition-colors ${className}`}
        style={{ background: `linear-gradient(135deg, ${gradient || '#0a0a0a'}, #050505)` }}
    >
        <div className="relative z-10">
            <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 text-white group-hover:scale-110 transition-transform"><Icon size={22} /></div>
            <h3 className="text-xl lg:text-2xl font-bold mb-2 text-white">{title}</h3>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">{desc}</p>
        </div>
        {children}
    </motion.div>
);

// --- WORKFLOW CARD ---
const WorkflowCard = ({ number, title, description, icon: Icon, color }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 text-center hover:border-white/20 transition-colors group"
    >
        <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-5 ${color} group-hover:scale-110 transition-transform`}><Icon size={24} /></div>
        <div className="text-[10px] font-mono text-white/30 mb-1 tracking-wider">STEP {number}</div>
        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <p className="text-white/50 text-xs leading-relaxed">{description}</p>
    </motion.div>
);

// --- MAIN PAGE ---
export default function Home() {
    return (
        <div className="min-h-screen text-white font-sans overflow-x-hidden selection:bg-blue-500/30" style={{ backgroundColor: BG_COLOR }}>

            {/* === HERO SECTION === */}
            <section className="relative h-screen flex items-center justify-center overflow-hidden pt-20" style={{ backgroundColor: BG_COLOR }}>
                {/* Simplified Background */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {/* Gradient Orbs */}
                    <div className="absolute top-[10%] left-[5%] w-[500px] h-[500px] bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent rounded-full blur-[150px]" />
                    <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] bg-gradient-to-tl from-blue-500/10 via-indigo-500/5 to-transparent rounded-full blur-[120px]" />

                    {/* Grid Pattern */}
                    <div className="absolute inset-0 opacity-[0.02]" style={{
                        backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.15) 1px, transparent 1px)`,
                        backgroundSize: '50px 50px'
                    }} />
                </div>

                <div className="container mx-auto px-6 relative z-10 text-center">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/30 bg-blue-500/10 mb-8 backdrop-blur-sm"
                    >
                        <div className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
                        </div>
                        <span className="text-xs font-mono text-blue-400 tracking-wider uppercase">Online</span>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
                    >
                        <span className="text-white">Organize files,</span>
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                            at the speed of chat
                        </span>
                        <motion.span
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="inline-block w-0.5 h-8 sm:h-10 md:h-12 lg:h-16 bg-blue-400 ml-1 align-middle"
                        />
                    </motion.h1>

                    {/* Blue underline */}
                    <motion.div
                        initial={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        transition={{ delay: 0.2 }}
                        className="h-1 w-24 bg-blue-500 mx-auto rounded-full mb-6"
                    />

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-base sm:text-lg text-white/50 mb-10 max-w-xl mx-auto leading-relaxed"
                    >
                        Forward documents to WhatsApp. AI analyzes, sorts, and saves to Google Drive. <span className="text-white/70 font-medium">Automatically.</span>
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10"
                    >
                        <Link
                            to="/signup"
                            className="group px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all hover:scale-105 flex items-center gap-2 shadow-xl shadow-blue-500/20"
                        >
                            <MessageSquare size={18} />
                            Get Started Free
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <button className="px-8 py-4 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-medium transition-all flex items-center gap-2">
                            <Github size={18} />
                            View on GitHub
                        </button>
                    </motion.div>

                    {/* Trust Indicators */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex flex-wrap items-center justify-center gap-6 text-white/40 text-xs sm:text-sm"
                    >
                        <div className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-blue-400" />
                            <span>Free Forever</span>
                        </div>
                        <div className="w-1 h-1 bg-white/20 rounded-full hidden sm:block" />
                        <div className="flex items-center gap-2">
                            <Shield size={14} className="text-blue-400" />
                            <span>Privacy First</span>
                        </div>
                        <div className="w-1 h-1 bg-white/20 rounded-full hidden sm:block" />
                        <div className="flex items-center gap-2">
                            <Zap size={14} className="text-blue-400" />
                            <span>Instant Setup</span>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* === CAROUSEL SECTION === */}
            <section className="py-24 relative overflow-hidden" style={{ backgroundColor: BG_COLOR }}>
                {/* Enhanced Background Effects */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* Animated Gradient Orbs */}
                    <motion.div
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.1, 0.15, 0.1]
                        }}
                        transition={{ duration: 8, repeat: Infinity }}
                        className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-green-500/10 via-blue-500/10 to-transparent rounded-full blur-[120px]"
                    />
                    <motion.div
                        animate={{
                            scale: [1.2, 1, 1.2],
                            opacity: [0.08, 0.12, 0.08]
                        }}
                        transition={{ duration: 10, repeat: Infinity }}
                        className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-purple-500/10 via-pink-500/10 to-transparent rounded-full blur-[100px]"
                    />

                    {/* Floating Particles */}
                    {[...Array(8)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 0 }}
                            animate={{
                                opacity: [0, 0.6, 0],
                                y: [-50, -200],
                                x: [0, Math.sin(i) * 30]
                            }}
                            transition={{
                                duration: 4 + i * 0.5,
                                delay: i * 0.8,
                                repeat: Infinity,
                                ease: "easeOut"
                            }}
                            className="absolute w-1 h-1 rounded-full bg-blue-400/50"
                            style={{
                                left: `${20 + i * 10}%`,
                                bottom: '10%'
                            }}
                        />
                    ))}
                </div>

                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center mb-16">
                        <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="text-sm font-mono text-blue-400 tracking-widest uppercase">See It In Action</motion.span>
                        <motion.h2 initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} className="text-4xl lg:text-5xl font-bold mt-4">Real Conversations</motion.h2>
                        <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-white/40 mt-4 max-w-lg mx-auto">
                            Watch how DocFlow handles everyday file organization requests.
                        </motion.p>
                    </div>

                    {/* Main Showcase Container with 3D Perspective */}
                    <div className="relative max-w-6xl mx-auto mb-16" style={{ perspective: '2000px' }}>



                        {/* Laptop Browser Mockup (Enhanced with 3D) */}
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="relative"
                            style={{ transformStyle: 'preserve-3d', transform: 'rotateX(5deg) rotateY(-2deg)' }}
                        >
                            {/* Dynamic Glow Effect */}
                            <div className="absolute -inset-8 bg-gradient-to-b from-blue-500/20 via-cyan-500/15 to-indigo-500/10 rounded-[3rem] blur-[80px] animate-pulse" />

                            {/* Laptop Frame */}
                            <div className="relative shadow-2xl">
                                {/* Browser Window */}
                                <div className="relative bg-gradient-to-br from-gray-800 via-gray-850 to-gray-900 rounded-t-3xl border border-gray-700/50 overflow-hidden backdrop-blur-xl">
                                    {/* Browser Chrome - Enhanced */}
                                    <div className="h-12 bg-black/40 backdrop-blur-md border-b border-gray-700/50 flex items-center px-5 gap-3">
                                        {/* Window Controls */}
                                        <div className="flex gap-2">
                                            <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-lg hover:shadow-red-500/50 transition-shadow" />
                                            <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg hover:shadow-yellow-500/50 transition-shadow" />
                                            <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg hover:shadow-green-500/50 transition-shadow" />
                                        </div>
                                        {/* Address Bar - Enhanced */}
                                        <div className="flex-1 bg-gray-700/30 backdrop-blur-sm rounded-lg px-4 py-2 text-xs text-gray-300 flex items-center gap-2 border border-gray-600/30">
                                            <Lock size={12} className="text-blue-400" />
                                            <span className="opacity-60">web.whatsapp.com</span>
                                        </div>
                                        {/* Browser Actions */}
                                        <div className="flex gap-2 opacity-40">
                                            <div className="w-6 h-6 rounded bg-white/5" />
                                            <div className="w-6 h-6 rounded bg-white/5" />
                                        </div>
                                    </div>

                                    {/* Browser Content - WhatsApp Web */}
                                    <div className="relative bg-[#0D1418] h-[520px]">
                                        {/* WhatsApp Header - Enhanced */}
                                        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#202c33] to-[#1a252c] z-20 flex items-center px-6 border-b border-black/30 shadow-lg">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center text-sm font-bold text-white shadow-xl">
                                                        DF
                                                    </div>
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#202c33]" />
                                                </div>
                                                <div>
                                                    <div className="text-base font-semibold text-white">DocFlow Bot</div>
                                                    <div className="text-xs text-green-400 flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                                        online
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Chat Content */}
                                        <div className="absolute inset-0 pt-16">
                                            <ChatCarousel />
                                        </div>
                                    </div>
                                </div>

                                {/* Laptop Base - Enhanced */}
                                <div className="h-2 bg-gradient-to-b from-gray-700 via-gray-750 to-gray-800 rounded-b-2xl shadow-inner" />
                                <div className="h-5 bg-gradient-to-b from-gray-800 to-gray-900 rounded-b-[2rem] mx-12 shadow-2xl relative">
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                </div>

                                {/* Desk Shadow */}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[90%] h-8 bg-black/30 blur-2xl rounded-full" />
                            </div>


                        </motion.div>
                    </div>
                </div>
            </section>

            {/* === FEATURES === */}
            <section id="features" className="py-20" style={{ backgroundColor: BG_COLOR }}>
                <div className="container mx-auto px-6">
                    <div className="text-center mb-14">
                        <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="text-sm font-mono text-blue-400 tracking-widest uppercase">Features</motion.span>
                        <motion.h2 initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} className="text-4xl lg:text-5xl font-bold mt-4">Everything automatic.</motion.h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
                        <BentoCard className="md:col-span-4" gradient="#0a0a0a" title="Syllabus Intelligence" desc="Upload your course PDF. AI auto-generates the folder structure." icon={FolderTree}>
                            <div className="absolute -right-2 -bottom-2 w-[45%] h-[55%] bg-[#0f0f0f] border border-white/5 rounded-tl-xl p-4 opacity-70 group-hover:opacity-100 transition-opacity">
                                <div className="space-y-1.5 font-mono text-[11px] text-white/60">
                                    <div className="flex items-center gap-1.5"><Folder size={12} className="text-yellow-400" /> /Sem3</div>
                                    <div className="flex items-center gap-1.5 pl-3"><Folder size={12} className="text-blue-400" /> /OS</div>
                                    <div className="flex items-center gap-1.5 pl-6"><FileText size={10} /> Notes.pdf</div>
                                </div>
                            </div>
                        </BentoCard>
                        <BentoCard className="md:col-span-2" gradient="#050a05" title="WhatsApp Native" desc="Just forward. No app needed." icon={MessageSquare}>
                            <div className="absolute right-4 bottom-4 w-9 h-9 rounded-full bg-[#25D366]/20 flex items-center justify-center"><Send size={16} className="text-green-400" /></div>
                        </BentoCard>
                        <BentoCard className="md:col-span-3" gradient="#0a050a" title="Magic Search" desc='"Where is my Adhaar?" — instant results.' icon={Search}>
                            <div className="absolute right-5 bottom-5 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2 text-[11px] font-mono text-white/50"><Search size={10} /> "find reports"</div>
                        </BentoCard>
                        <BentoCard className="md:col-span-3" gradient="#050505" title="Private & Secure" desc="Files go to your Drive. We never store." icon={Shield}>
                            <div className="absolute right-5 bottom-5 w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center"><Lock size={18} className="text-green-400" /></div>
                        </BentoCard>
                    </div>
                </div>
            </section>

            {/* === WORKFLOW (Timeline Style) === */}
            <section id="how-it-works" className="py-24" style={{ backgroundColor: BG_COLOR }}>
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="text-sm font-mono text-blue-400 tracking-widest uppercase">Workflow</motion.span>
                        <motion.h2 initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} className="text-4xl lg:text-5xl font-bold mt-4">From Chaos to Order</motion.h2>
                    </div>

                    <div className="relative max-w-4xl mx-auto">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500/30 via-cyan-500/30 to-indigo-500/30 hidden md:block" />

                        <div className="grid md:grid-cols-3 gap-12 relative z-10">
                            {[
                                { num: "01", title: "Forward", desc: "Send any document to our WhatsApp bot. That's it.", icon: Send, color: "blue" },
                                { num: "02", title: "Analyze", desc: "AI reads the content and understands context.", icon: Sparkles, color: "cyan" },
                                { num: "03", title: "Organize", desc: "File is renamed and saved to the perfect folder.", icon: UploadCloud, color: "indigo" }
                            ].map((step, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.2 }}
                                    className="text-center"
                                >
                                    <div className={`w-20 h-20 mx-auto rounded-2xl bg-[#0a0a0a] border border-white/10 flex items-center justify-center mb-6 relative z-10 hover:scale-110 transition-transform shadow-2xl shadow-${step.color}-500/10`}>
                                        <step.icon size={32} className={`text-${step.color}-400`} />
                                        <div className={`absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#111] border border-white/10 flex items-center justify-center text-xs font-bold text-white/50`}>{step.num}</div>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-3">{step.title}</h3>
                                    <p className="text-white/50 leading-relaxed max-w-[200px] mx-auto">{step.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* === CONTACT (Terminal Style) === */}
            <section id="contact" className="py-32" style={{ backgroundColor: BG_COLOR }}>
                <div className="container mx-auto px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="max-w-6xl mx-auto"
                    >
                        {/* Terminal Window */}
                        <div className="relative bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                            {/* Terminal Header */}
                            <div className="relative h-14 bg-black/60 border-b border-white/10 flex items-center justify-between px-6">
                                {/* Signal Indicator */}
                                <div className="flex items-center gap-2">
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                                    </div>
                                    <span className="text-xs font-mono text-blue-400 tracking-wider uppercase">Signal Detected</span>
                                </div>

                                {/* macOS Window Controls */}
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors cursor-pointer" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors cursor-pointer" />
                                    <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors cursor-pointer" />
                                </div>
                            </div>

                            {/* Terminal Content */}
                            <div className="grid lg:grid-cols-2 gap-12 p-12 lg:p-16">
                                {/* Left Side - Text Content */}
                                <div className="flex flex-col justify-center">
                                    <h2 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                                        Ready to organize your documents?
                                        <div className="h-1.5 w-32 bg-blue-500 mt-4 rounded-full" />
                                    </h2>
                                    <p className="text-gray-400 text-lg leading-relaxed">
                                        Open source DocFlow. WhatsApp + AI + Drive.<br />
                                        Join thousands organizing smarter.
                                    </p>
                                </div>

                                {/* Right Side - Action Buttons */}
                                <div className="flex flex-col justify-center gap-4">
                                    {/* Primary CTA Button */}
                                    <Link
                                        to="/signup"
                                        className="group flex items-center justify-center gap-3 px-8 py-5 bg-white text-black rounded-2xl font-semibold text-lg hover:bg-gray-100 transition-all hover:scale-105"
                                    >
                                        <MessageSquare size={20} />
                                        Start Organizing Free
                                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </Link>

                                    {/* Secondary Buttons */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <a
                                            href="https://github.com"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 px-6 py-4 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all font-medium"
                                        >
                                            <Github size={18} />
                                            GITHUB
                                        </a>
                                        <a
                                            href="https://wa.me/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 px-6 py-4 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all font-medium"
                                        >
                                            <MessageSquare size={18} />
                                            TRY BOT
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-12 pb-8 pt-6 border-t border-white/5">
                                <p className="text-white/30 text-sm text-center">© 2024 DocFlow AI. All rights reserved.</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
