import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowUpRight, FileText, MessageSquare, FolderTree, Search, Folder, CheckCircle, Shield, Lock, Send, Sparkles, UploadCloud, Github, Zap, Cloud, Rocket, Wrench, Leaf } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";

// --- CAROUSEL SLIDE DATA ---
const carouselSlides = [
    { userMsg: "Find my OS notes from semester 3", botMsg: "Here you go! Found in /University/Sem3/", botFile: "OS_Unit1_Notes.pdf" },
    { userMsg: "Where is my Adhaar card?", botMsg: "Located at /Personal/Identity/ ✓", botFile: null },
    { userMsg: "Send my internship offer letter", botMsg: "Found in /Career/Internship/", botFile: "Google_Offer_Letter.pdf" },
    { userMsg: "Get all uber receipts", botMsg: "Found 7 receipts in /Finance/Uber/ ✓", botFile: null },
    { userMsg: "Show my latest resume", botMsg: "Here's your latest version!", botFile: "Resume_2024_v3.pdf" }
];

// --- COMPANY LOGOS ---
const companyLogos = [
    { name: "Cloud", icon: Cloud },
    { name: "Invert", icon: Sparkles },
    { name: "Orbitc", icon: Rocket },
    { name: "Leafe", icon: Leaf }
];

// --- FAQ DATA ---
const faqData = [
    { question: "How do I get started with DocFlow?", answer: "Simply sign up, connect your Google Drive, and add our WhatsApp bot to your contacts. Then just forward any document to the bot!" },
    { question: "What are the key features of DocFlow?", answer: "AI-powered document organization, WhatsApp integration, automatic folder structure, smart search, and privacy-first architecture." },
    { question: "Is my data secure and private?", answer: "Absolutely. We never store your documents. Files go directly from WhatsApp to your personal Google Drive with end-to-end encryption." },
    { question: "Can I customize the folder organization?", answer: "Yes! You can upload a syllabus or create custom rules. Our AI learns your preferences and organizes files accordingly." }
];

// --- FLOATING ICON BADGE ---
const FloatingIcon = ({ icon: Icon, className, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay, duration: 0.6 }}
        className={`absolute ${className}`}
        style={{ zIndex: 5 }}
    >
        <motion.div
            animate={{ y: [-8, 8, -8], rotate: [-3, 3, -3] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="w-14 h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl flex items-center justify-center border border-white/10"
            style={{ boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}
        >
            <Icon size={26} className="text-white/80" />
        </motion.div>
    </motion.div>
);

// --- FAQ ITEM ---
// --- FAQ ITEM ---
const FAQItem = ({ question, answer, isOpen, onClick }) => (
    <div className="w-full">
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`w-full flex items-center justify-between p-6 bg-gradient-to-br from-white/5 to-white/[0.02] hover:from-white/10 hover:to-white/5 border border-white/5 ${isOpen ? 'rounded-t-2xl' : 'rounded-2xl'} transition-all group backdrop-blur-sm`}
        >
            <span className="text-lg font-medium text-white text-left">{question}</span>
            <div className={`w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0 ml-4 ${isOpen ? 'rotate-180 bg-white/10' : ''}`}>
                {isOpen ? <ArrowUpRight size={18} className="text-white" /> : <ArrowUpRight size={18} className="text-white/60" />}
            </div>
        </motion.button>
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden bg-white/5 border-x border-b border-white/5 rounded-b-2xl"
                >
                    <div className="p-6 pt-0 text-white/50 text-base leading-relaxed">
                        {answer}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

// --- WHATSAPP CHAT CARD ---
const WhatsAppChatCard = ({ userMsg, botMsg, botFile }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5 }}
        className="w-full h-full flex flex-col"
    >
        <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto" style={{
            backgroundColor: '#0D1418',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="flex justify-end">
                <div className="bg-[#005c4b] px-4 py-3 rounded-lg rounded-tr-sm max-w-[75%] shadow">
                    <p className="text-sm sm:text-base text-white">{userMsg}</p>
                    <div className="text-[10px] text-white/50 text-right mt-1 flex items-center justify-end gap-1">
                        10:42 AM <CheckCircle size={10} className="text-blue-300" />
                    </div>
                </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="flex justify-start">
                <div className="bg-[#1f2c34] px-4 py-3 rounded-lg rounded-tl-sm max-w-[80%] shadow border-l-2 border-green-500">
                    {botFile && (
                        <div className="flex items-center gap-3 bg-black/20 rounded-lg p-2 sm:p-3 mb-2 border border-white/5">
                            <div className="w-8 h-10 sm:w-10 sm:h-12 bg-red-500/20 rounded flex items-center justify-center">
                                <FileText size={20} className="text-red-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs sm:text-sm text-white font-medium truncate">{botFile}</div>
                                <div className="text-[10px] text-white/40">PDF • 2.4 MB</div>
                            </div>
                        </div>
                    )}
                    <p className="text-sm sm:text-base text-white/90">{botMsg}</p>
                    <div className="text-[10px] text-white/40 mt-1">10:42 AM</div>
                </div>
            </motion.div>
        </div>
    </motion.div>
);

// --- CAROUSEL ---
const ChatCarousel = () => {
    const [current, setCurrent] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setCurrent((prev) => (prev + 1) % carouselSlides.length), 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="relative w-full h-full">
            <AnimatePresence mode="wait">
                <WhatsAppChatCard key={current} {...carouselSlides[current]} />
            </AnimatePresence>
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex justify-center gap-2">
                {carouselSlides.map((_, i) => (
                    <button key={i} onClick={() => setCurrent(i)} className={`h-1.5 rounded-full transition-all ${i === current ? 'bg-white w-6' : 'bg-white/20 w-1.5'}`} />
                ))}
            </div>
        </div>
    );
};

// --- FEATURE CARD (UPDATED WITH GLASS EFFECT) ---
const FeatureCard = ({ title, description, icon: Icon, link = "#", className, tall }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className={`group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 flex flex-col hover:border-white/20 transition-all hover:bg-white/[0.08] hover:shadow-2xl hover:shadow-purple-500/5 ${className}`}
    >
        {Icon && (
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-white border border-white/5 shadow-inner">
                <Icon size={24} />
            </div>
        )}
        <h3 className="text-2xl font-bold text-white mb-4">{title}</h3>
        <p className="text-white/60 leading-relaxed mb-6 flex-grow">{description}</p>
        <Link to={link} className="inline-flex items-center gap-2 text-sm font-medium text-white hover:text-blue-400 transition-colors mt-auto">
            Explore More <ArrowUpRight size={14} />
        </Link>
    </motion.div>
);

// --- WORKFLOW CARD (UPDATED WITH GLASS EFFECT) ---
const WorkflowCard = ({ num, title, desc, icon: Icon, color }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 relative overflow-hidden group hover:border-white/20 transition-all hover:bg-white/[0.08] hover:shadow-2xl hover:shadow-blue-500/5"
    >
        {/* Step Number Background */}
        <div className="absolute top-0 right-0 p-6 opacity-5 font-bold text-6xl text-white select-none">{num}</div>

        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-6 shadow-lg`}>
            <Icon size={24} className="text-white" />
        </div>

        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
        <p className="text-white/60 leading-relaxed text-sm">{desc}</p>

        <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent w-full opacity-50" />
    </motion.div>
);

// --- MAIN PAGE ---
export default function Home() {
    const [openFAQ, setOpenFAQ] = useState(null);

    return (
        <div className="min-h-screen text-white font-sans overflow-x-hidden selection:bg-blue-500/30 relative">

            {/* === CONSISTENT BACKGROUND === */}
            <div className="fixed inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, #030303 0%, #050510 50%, #030303 100%)', zIndex: -1 }}>
                <div className="absolute top-[5%] left-[-5%] w-[800px] h-[800px] bg-gradient-to-br from-blue-600/20 via-cyan-500/10 to-transparent rounded-full blur-[180px]" />
                <div className="absolute top-[40%] right-[-10%] w-[700px] h-[700px] bg-gradient-to-tl from-purple-600/15 via-pink-500/8 to-transparent rounded-full blur-[160px]" />
                <div className="absolute bottom-[10%] left-[20%] w-[500px] h-[500px] bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-[140px]" />
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`, backgroundSize: '80px 80px' }} />
                <div className="absolute inset-0 opacity-[0.4]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, mixBlendMode: 'overlay' }} />
            </div>

            {/* === HERO SECTION === */}
            <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-28 pb-10">
                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center mb-10">
                        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm mb-8">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-sm font-medium text-white/70">🚀 Smart Document Organization</span>
                        </motion.div>

                        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl tracking-tight leading-[1.05] mb-6">
                            <span className="font-light italic text-white/40">Dedicated AI</span>{" "}
                            <span className="font-extrabold text-white">Organize Your</span>
                            <br />
                            <span className="font-extrabold bg-gradient-to-r from-green-400 via-blue-500 to-green-400 bg-clip-text text-transparent animate-gradient-x">Documents Instantly</span>
                        </motion.h1>

                        <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-base sm:text-lg md:text-xl text-white/50 mb-8 max-w-2xl mx-auto leading-relaxed">
                            Forward documents to WhatsApp. AI analyzes, sorts, and saves to Google Drive. <span className="text-white/70 font-medium">No manual work required.</span>
                        </motion.p>

                        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                            <Link to="/auth" className="group inline-flex items-center gap-3 px-10 py-5 rounded-full bg-white text-black font-bold text-lg hover:bg-gray-100 transition-all hover:scale-105 shadow-xl shadow-white/10">
                                Start Organizing Now
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <a href="/login" className="inline-flex items-center gap-2 px-8 py-5 rounded-full border border-white/20 hover:bg-white/5 text-white font-medium text-lg transition-all">
                                Login to Dashboard
                            </a>
                        </motion.div>

                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex flex-wrap items-center justify-center gap-6 lg:gap-10 text-white/30 mb-20">
                            {companyLogos.map((company, i) => (
                                <div key={i} className="flex items-center gap-2 hover:text-white/50 transition-colors">
                                    <company.icon size={18} />
                                    <span className="text-sm font-medium">{company.name}</span>
                                </div>
                            ))}
                        </motion.div>

                        {/* Tagline from Reference */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="mb-10"
                        >
                            <h3 className="text-2xl md:text-3xl font-medium text-white/90 text-center tracking-tight">
                                “Paving the way for limitless <br className="hidden sm:block" /> innovation and growth.”
                            </h3>
                        </motion.div>
                    </div>

                    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.7 }} className="relative w-full max-w-[80%] mx-auto">
                        <FloatingIcon icon={Rocket} className="top-8 -right-8 lg:-right-20" delay={0.7} />
                        <FloatingIcon icon={Wrench} className="bottom-20 -left-8 lg:-left-20" delay={0.9} />
                        <div className="relative rounded-3xl overflow-hidden border border-white/10" style={{ zIndex: 10, boxShadow: '0 50px 100px rgba(0,0,0,0.6)' }}>
                            <div className="h-11 bg-gradient-to-b from-[#1f1f1f] to-[#1a1a1a] border-b border-white/10 flex items-center px-4 gap-3">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                </div>
                                <div className="flex-1 bg-black/40 rounded-lg px-4 py-2 text-xs text-white/50 flex items-center gap-2 border border-white/5 ml-4 max-w-md">
                                    <Lock size={11} className="text-green-400" />
                                    <span>web.whatsapp.com</span>
                                </div>
                            </div>
                            <div className="relative bg-[#0D1418] h-[350px] sm:h-[420px] lg:h-[480px]">
                                <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-[#202c33] to-[#1a252c] z-20 flex items-center px-4 sm:px-6 border-b border-black/30">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="relative">
                                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center text-sm font-bold text-white shadow-lg">DF</div>
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#202c33]" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-white">DocFlow Bot</div>
                                            <div className="text-xs text-green-400 flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                                online
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute inset-0 pt-14">
                                    <ChatCarousel />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>


            {/* === FEATURES === */}
            <section id="features" className="relative py-16">
                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center mb-12">
                        <motion.h2 initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} className="text-4xl lg:text-6xl font-bold text-white mb-6">Diverse Features</motion.h2>
                        <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} className="text-lg text-white/50 max-w-2xl mx-auto">
                            Explore our diverse features tailored to meet the dynamic needs of modern organization.
                        </motion.p>
                    </div>

                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <FeatureCard
                            title="Syllabus Intelligence"
                            description="Upload your course PDF or syllabus. Our AI automatically parses the document, understands your semester structure, and auto-generates the perfect folder hierarchy in your Google Drive. No manual folder creation needed."
                            className=""
                            tall
                        />
                        <div className="flex flex-col gap-6">
                            <FeatureCard
                                title="WhatsApp Native"
                                description="Just forward documents to our verified WhatsApp bot. It feels just like chatting with a friend. No new apps to install or learn."
                                className="h-full"
                            />
                            <FeatureCard
                                title="Magic Search"
                                description="Need to find 'vaccine certificate' or 'last month's receipt'? Just ask the bot. It instantly locates files across your organised Drive."
                                className="h-full"
                            />
                        </div>
                        <FeatureCard
                            title="Private & Secure"
                            description="Your privacy is paramount. We operate on a zero-retention policy. Files are processed in memory and instantly wired to your personal Google Drive with end-to-end encryption. We never store your documents."
                            className=""
                            tall
                        />
                    </div>
                </div>
            </section>

            {/* === WORKFLOW === */}
            <section id="how-it-works" className="relative py-16">
                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center mb-12">
                        <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="text-sm font-medium text-blue-400 tracking-widest uppercase">Workflow</motion.span>
                        <motion.h2 initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} className="text-3xl lg:text-5xl font-bold mt-4 text-white">From Chaos to Order</motion.h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                        <WorkflowCard
                            num="01"
                            title="Forward"
                            desc="Send any document to our WhatsApp bot. That's it."
                            icon={Send}
                            color="from-blue-500 to-blue-600"
                        />
                        <WorkflowCard
                            num="02"
                            title="Analyze"
                            desc="AI reads the content and understands context."
                            icon={Sparkles}
                            color="from-purple-500 to-purple-600"
                        />
                        <WorkflowCard
                            num="03"
                            title="Organize"
                            desc="File is renamed and saved to the perfect folder."
                            icon={UploadCloud}
                            color="from-green-500 to-green-600"
                        />
                    </div>
                </div>
            </section>

            {/* === FAQ SECTION === */}
            <section id="faq" className="relative py-16">
                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center mb-12">
                        <motion.h2 initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} className="text-4xl lg:text-6xl font-bold text-white">FAQs</motion.h2>
                        <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-white/40 mt-5 max-w-lg mx-auto text-lg">
                            Explore our FAQs for quick answers to common queries about our platform.
                        </motion.p>
                    </div>

                    <div className="max-w-3xl mx-auto space-y-4">
                        {faqData.map((faq, i) => (
                            <FAQItem
                                key={i}
                                question={faq.question}
                                answer={faq.answer}
                                isOpen={openFAQ === i}
                                onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* === CONTACT/CTA === */}
            <section id="contact" className="relative py-20">
                <div className="container mx-auto px-6 relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-5xl mx-auto">
                        <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                            {/* Header */}
                            <div className="h-12 bg-black/40 border-b border-white/10 flex items-center justify-between px-6">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                    </div>
                                    <span className="text-xs font-medium text-green-400 uppercase tracking-wide">Ready</span>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="grid lg:grid-cols-2 gap-12 p-12 lg:p-16">
                                <div className="flex flex-col justify-center">
                                    <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
                                        Ready to organize your documents?
                                        <div className="h-1.5 w-28 bg-gradient-to-r from-blue-500 to-purple-500 mt-5 rounded-full" />
                                    </h2>
                                    <p className="text-gray-400 text-lg leading-relaxed">Open source DocFlow. WhatsApp + AI + Drive.<br />Join thousands organizing smarter.</p>
                                </div>
                                <div className="flex flex-col justify-center gap-4">
                                    <Link to="/auth" className="group flex items-center justify-center gap-3 px-8 py-5 bg-white text-black rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all hover:scale-105">
                                        <MessageSquare size={20} />
                                        Start Organizing Free
                                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                    <div className="grid grid-cols-2 gap-4">
                                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-6 py-4 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all font-medium">
                                            <Github size={18} />GITHUB
                                        </a>
                                        <a href="https://wa.me/+15551685392" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-6 py-4 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all font-medium">
                                            <MessageSquare size={18} />TRY BOT
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            <Footer />
        </div>
    );
}