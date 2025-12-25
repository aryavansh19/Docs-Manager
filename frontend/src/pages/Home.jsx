import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue, useVelocity, useAnimationFrame } from "framer-motion";
import { wrap } from "framer-motion";
import { ArrowRight, Mail, MessageSquare, Twitter, Radio, Wifi, Zap, FileText, Database, Search, GitBranch, Terminal, ExternalLink } from "lucide-react";
import Footer from "../components/Footer";
import { Link } from "react-router-dom";

// Infinite Marquee Component
function ParallaxText({ children, baseVelocity = 100 }) {
    const baseX = useMotionValue(0);
    const { scrollY } = useScroll();
    const scrollVelocity = useVelocity(scrollY);
    const smoothVelocity = useSpring(scrollVelocity, {
        damping: 50,
        stiffness: 400
    });
    const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], {
        clamp: false
    });

    const x = useTransform(baseX, (v) => `${wrap(-20, -45, v)}%`);

    const directionFactor = useRef(1);
    useAnimationFrame((t, delta) => {
        let moveBy = directionFactor.current * baseVelocity * (delta / 1000);

        if (velocityFactor.get() < 0) {
            directionFactor.current = -1;
        } else if (velocityFactor.get() > 0) {
            directionFactor.current = 1;
        }

        moveBy += directionFactor.current * moveBy * velocityFactor.get();

        baseX.set(baseX.get() + moveBy);
    });

    return (
        <div className="overflow-hidden m-0 whitespace-nowrap flex flex-nowrap">
            <motion.div
                className="flex whitespace-nowrap flex-nowrap gap-8"
                style={{ x, willChange: 'transform' }}
            >
                {children}
                {children}
                {children}
                {children}
            </motion.div>
        </div>
    );
}

const DenseCard = ({ title, type, delay }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ delay, duration: 0.5 }}
        whileHover={{ scale: 0.98, borderColor: "rgba(255,255,255,0.3)" }}
        className="w-[400px] h-[300px] bg-white/5 border border-white/10 rounded-lg backdrop-blur-md p-6 flex flex-col justify-between shrink-0 transition-all cursor-pointer group hover:shadow-2xl hover:shadow-purple-500/10"
    >
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${type === 'err' ? 'bg-red-500 box-shadow-red' : type === 'warn' ? 'bg-yellow-500' : 'bg-green-500 box-shadow-green'}`} />
                <span className="text-xs font-mono text-white/40 tracking-widest">{title}</span>
            </div>
            <span className="text-xs font-mono text-white/20">LOG_ID_8492</span>
        </div>

        <div className="font-mono text-[10px] text-white/60 leading-relaxed overflow-hidden py-4 opacity-50 group-hover:opacity-100 transition-opacity">
            <p>00:01:23.456 [INFO] Initializing quantum core...</p>
            <p>00:01:23.490 [DEBUG] Vector embeddings loaded in 3ms</p>
            <p>00:01:23.512 [WARN] High entropy detected in sector 7</p>
            <p className="text-blue-400">00:01:23.600 [NET] Establishing p2p mesh connection</p>
            <p>00:01:23.750 [AUTH] Handshake Acknowleged</p>
            <p>00:01:23.880 [DATA] Syncing fragmented shards...</p>
            <p className="text-green-400">00:01:24.001 [SUCCESS] Node online and ready.</p>
            <p className="opacity-50">... (150 more lines)</p>
        </div>

        <div className="flex gap-2 items-center">
            <div className="h-[2px] flex-1 bg-white/10 overflow-hidden">
                <motion.div
                    initial={{ x: "-100%" }}
                    whileInView={{ x: "100%" }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="h-full bg-white/40 w-[30%]"
                />
            </div>
            <div className="text-[9px] font-mono text-white/30">SYNCED</div>
        </div>
    </motion.div>
)

const FeatureCard = ({ icon: Icon, title, description, delay }) => (
    <motion.div
        initial={{ y: 50, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay, ease: "easeOut" }}
        viewport={{ once: true }}
        className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-sm group hover:border-blue-500/30"
    >
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-cyan-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300">
            <Icon size={24} />
        </div>
        <h3 className="text-xl font-bold mb-4 font-mono">{title}</h3>
        <p className="text-white/60 leading-relaxed text-sm">
            {description}
        </p>
    </motion.div>
)

const StepCard = ({ number, title, description }) => (
    <div className="relative pl-12 pb-12 border-l border-white/10 last:border-0 hover:border-purple-500/50 transition-colors">
        <div className="absolute left-[-20px] top-0 w-10 h-10 rounded-full bg-[#020202] border border-white/20 flex items-center justify-center font-mono font-bold text-sm z-10 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
            {number}
        </div>
        <h3 className="text-xl font-bold mb-2 font-mono group-hover:text-purple-400 transition-colors">{title}</h3>
        <p className="text-white/60">{description}</p>
    </div>
)

export default function Home() {
    return (
        <div className="min-h-screen bg-[#020202] text-white selection:bg-cyan-500/30 font-mono overflow-x-hidden">

            {/* Hero Section */}
            <section id="hero" className="relative pt-48 pb-4 overflow-hidden">

                {/* Scope Dot Matrix Background to Hero */}
                <div className="absolute inset-0 z-0 pointer-events-none opacity-20"
                    style={{
                        backgroundImage: 'radial-gradient(circle, #444 1px, transparent 1px)',
                        backgroundSize: '32px 32px',
                        maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)' // Fade out at bottom of hero
                    }}
                />

                <div className="container mx-auto px-6 mb-32 text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-8 text-xs font-medium text-white/70">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            System Online v2.4
                        </div>
                    </motion.div>

                    <h1 className="text-5xl md:text-8xl font-bold tracking-tighter mb-8 max-w-5xl mx-auto leading-[0.95]">
                        INFINITE <br />
                        <span className="bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 bg-clip-text text-transparent filter drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                            DATA STREAM
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto font-light leading-relaxed">
                        Processing millions of signals per second. <br className="hidden md:block" />
                        Watch the pulse of your global file infrastructure in real-time.
                    </p>

                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/auth" className="px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all hover:scale-105 shadow-lg shadow-blue-900/40">
                            Start Deploying
                        </Link>
                        <button className="px-8 py-4 rounded-full border border-white/20 hover:bg-white/10 text-white font-medium transition-all flex items-center gap-2 group">
                            <span>Read Documentation</span>
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* Marquee Section 1 (Right) */}
                <div className="mb-16 rotate-[-1deg] scale-105 relative z-10 hover:z-20 transition-all">
                    {/* Reduced Gradient Opacity */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#020202] via-transparent to-[#020202] z-10 pointer-events-none opacity-40" />
                    <ParallaxText baseVelocity={-2}>
                        <div className="flex gap-8">
                            <DenseCard title="SYSTEM_KERNEL" type="success" delay={0} />
                            <DenseCard title="NETWORK_Mesh" type="warn" delay={0} />
                            <DenseCard title="AUTH_PROTOCOL" type="success" delay={0} />
                            <DenseCard title="VECTOR_DB" type="success" delay={0} />
                        </div>
                    </ParallaxText>
                </div>

                {/* Marquee Section 2 (Left) */}
                <div className="mb-20 rotate-[1deg] scale-105 relative z-10">
                    {/* Reduced Gradient Opacity */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#020202] via-transparent to-[#020202] z-10 pointer-events-none opacity-40" />
                    <ParallaxText baseVelocity={2}>
                        <div className="flex gap-8">
                            <DenseCard title="AI_AGENT_01" type="success" delay={0} />
                            <DenseCard title="ENCRYPTION_LAYER" type="err" delay={0} />
                            <DenseCard title="STORAGE_CLUSTER" type="success" delay={0} />
                            <DenseCard title="SYNC_DAEMON" type="warn" delay={0} />
                        </div>
                    </ParallaxText>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-32 container mx-auto px-6 relative z-10">
                <div className="text-center mb-20">
                    <span className="text-blue-500 text-xs font-bold tracking-[0.2em] uppercase mb-4 block">Capabilities</span>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Intelligence Module</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FeatureCard
                        icon={FileText}
                        title="Syllabus Intelligence"
                        description="Upload your course PDF. Our AI reads it, understands your subjects, and creates a perfect folder hierarchy automatically."
                        delay={0}
                    />
                    <FeatureCard
                        icon={MessageSquare}
                        title="The WhatsApp Bridge"
                        description="Don't change your habits. Just forward files to our WhatsApp Bot. We handle the filing in the background."
                        delay={0.1}
                    />
                    <FeatureCard
                        icon={Search}
                        title="Instant Retrieval (RAG)"
                        description="Need notes fast? Just ask the bot: 'Show me the OS Unit 1 notes' and get the link instantly."
                        delay={0.2}
                    />
                </div>
            </section>

            {/* Photo / Interface Showcase Section (New) */}
            <section id="showcase" className="py-32 bg-[#080808] border-y border-white/5 relative z-10">
                <div className="container mx-auto px-6 text-center">
                    <div className="mb-16">
                        <span className="text-purple-500 text-xs font-bold tracking-[0.2em] uppercase mb-4 block">Interface</span>
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Designed for Focus</h2>
                        <p className="text-white/50 max-w-2xl mx-auto">
                            Every pixel is crafted to reduce cognitive load. Dark mode default, high contrast data points, and keyboard-first navigation.
                        </p>
                    </div>

                    {/* Visual Placeholder for Interface */}
                    <div className="relative max-w-6xl mx-auto rounded-xl overflow-hidden shadow-2xl shadow-blue-900/20 border border-white/10 group">
                        {/* Browser frame mockup */}
                        <div className="h-12 bg-[#111] border-b border-white/10 flex items-center px-4 gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/20" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                            <div className="w-3 h-3 rounded-full bg-green-500/20" />
                            <div className="ml-4 px-4 py-1 bg-black/50 rounded text-xs text-white/30 font-mono w-64">smartdoc.ai/dashboard</div>
                        </div>

                        {/* Placeholder Content Area */}
                        <div className="h-[500px] bg-[#050505] relative flex items-center justify-center overflow-hidden">
                            {/* Abstract UI Representation */}
                            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                            <div className="grid grid-cols-12 gap-4 w-full h-full p-8 opacity-60">
                                {/* Sidebar */}
                                <div className="col-span-3 h-full rounded-lg border border-white/10 bg-white/5 p-4 flex flex-col gap-3">
                                    <div className="h-8 w-24 bg-white/10 rounded mb-4" />
                                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-4 w-full bg-white/5 rounded" />)}
                                </div>
                                {/* Main Content */}
                                <div className="col-span-9 h-full flex flex-col gap-4">
                                    <div className="h-48 w-full rounded-lg border border-white/10 bg-gradient-to-br from-blue-900/10 to-transparent p-6 relative overflow-hidden group-hover:border-blue-500/30 transition-colors">
                                        <div className="absolute top-0 right-0 p-32 bg-blue-500/20 blur-[100px] rounded-full" />
                                        <h3 className="text-2xl font-bold mb-2">Project Delta</h3>
                                        <p className="text-sm text-white/50">Last synced: 2 mins ago</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 h-full">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-4" />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-black/80 backdrop-blur-md border border-white/20 p-6 rounded-2xl text-center transform group-hover:scale-105 transition-transform duration-500">
                                    <Terminal size={48} className="mx-auto mb-4 text-blue-500" />
                                    <h3 className="text-xl font-bold mb-2">Immersive Dashboard</h3>
                                    <p className="text-white/60 text-sm">Visualize your entire knowledge base in one view.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="py-32 relative z-10">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <span className="text-green-500 text-xs font-bold tracking-[0.2em] uppercase mb-4 block">Workflow</span>
                            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">System Architecture</h2>
                            <p className="text-white/50 text-lg mb-12">
                                A seamless pipeline designed for zero-friction data entry. Recruiters love this because it shows deep understanding of User Experience.
                            </p>
                        </div>

                        <div className="relative">
                            <StepCard
                                number="01"
                                title="Connect Google Drive"
                                description="Secure OAuth 2.0 handshake to establish a dedicated storage cluster."
                            />
                            <StepCard
                                number="02"
                                title="Upload Syllabus"
                                description="Parsing engine extracts metadata to form the directory skeleton."
                            />
                            <StepCard
                                number="03"
                                title="Send via WhatsApp"
                                description="Webhooks capture the payload and route it to the correct destination."
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section (Redesigned - Simplified Layout) */}
            <section id="contact" className="py-32 container mx-auto px-6 relative z-10">
                <div className="max-w-6xl mx-auto rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl shadow-green-900/10">
                    <div className="grid grid-cols-1 md:grid-cols-2">

                        {/* Left Panel: Clean, Dark with Text */}
                        <div className="p-16 flex flex-col justify-center relative bg-[#050505] border-r border-white/5">
                            <div className="absolute top-10 left-10 flex items-center gap-2 text-green-500 text-xs font-bold tracking-widest uppercase mb-4">
                                <Wifi size={16} />
                                <span>Signal Detected</span>
                            </div>

                            <h2 className="text-5xl md:text-6xl font-bold tracking-tight text-white mb-6 mt-12">
                                Ready to upgrade <br /> your workflow?
                            </h2>

                            {/* The bright green block requested in image 1 was mostly creating a visual imbalance.
                            Instead, we use a vibrant green accent bar or button to solve "visualization covering whole page"
                        */}
                            <div className="h-2 w-24 bg-green-500 rounded-full mb-8" />

                            <p className="text-white/60 text-lg max-w-md">
                                Open source and built for efficiency. Join the secure network.
                            </p>
                        </div>

                        {/* Right Panel: Actions (Matching Image 1 Reference) */}
                        <div className="p-16 bg-black flex flex-col justify-center items-center gap-6 relative">
                            {/* Status dots */}
                            <div className="absolute top-8 right-8 flex gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500/40" />
                                <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                            </div>

                            <button className="w-full max-w-md py-5 bg-white hover:bg-gray-100 text-black font-bold text-lg rounded-full transition-transform hover:scale-[1.02] flex items-center justify-center gap-3">
                                <GitBranch size={20} />
                                <span>View on GitHub</span>
                                <ArrowRight size={20} />
                            </button>

                            <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                                <button className="py-4 border border-white/10 hover:border-white/30 rounded-lg text-sm font-mono text-white/70 hover:text-white transition-colors flex items-center justify-center gap-2">
                                    <Twitter size={16} /> @ARYAV
                                </button>
                                <button className="py-4 border border-white/10 hover:border-white/30 rounded-lg text-sm font-mono text-white/70 hover:text-white transition-colors flex items-center justify-center gap-2">
                                    <Mail size={16} /> CONTACT
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Detailed Footer */}
            <Footer />

        </div>
    );
}
