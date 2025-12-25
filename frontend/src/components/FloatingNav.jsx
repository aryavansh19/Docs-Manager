import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Terminal, ArrowRight } from "lucide-react";

export default function FloatingNav() {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Hide Nav on Dashboard and Login pages
    if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/auth') || location.pathname.startsWith('/login') || location.pathname.startsWith('/signup')) {
        return null;
    }

    return (
        <>
            <motion.nav
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl"
            >
                <div className="rounded-full px-6 py-4 flex items-center justify-between bg-[#111111]/80 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden">

                    {/* Logo (Left) */}
                    <Link to="/" className="flex items-center gap-3 group relative z-10 mr-8">
                        <div className="p-2 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white">
                            <Terminal size={20} />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-white hidden sm:block font-syne">
                            SmartDoc
                        </span>
                    </Link>

                    {/* Links (Center) */}
                    <div className="hidden md:flex items-center gap-8 relative z-10">
                        {[
                            { name: 'Features', id: 'features' },
                            { name: 'How it Works', id: 'how-it-works' },
                            // { name: 'Showcase', id: 'photo-section' }
                        ].map((item) => (
                            <button
                                key={item.name}
                                onClick={() => scrollToSection(item.id)}
                                className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>

                    {/* Actions (Right) */}
                    <div className="flex items-center gap-4 relative z-10 ml-auto">
                        <button
                            onClick={() => scrollToSection('contact')}
                            className="hidden sm:block px-6 py-2.5 rounded-full border border-white/20 text-white text-sm font-medium hover:bg-white/5 transition-all"
                        >
                            Get in Touch
                        </button>
                        <Link
                            to="/auth"
                            className="hidden sm:flex px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all items-center gap-2 group"
                        >
                            <span>Get Started</span>
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </Link>

                        {/* Mobile Menu Toggle */}
                        <button
                            className="md:hidden p-2 text-white/80"
                            onClick={() => setIsOpen(!isOpen)}
                        >
                            {isOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>
            </motion.nav>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-40 bg-[#050505] flex flex-col items-center justify-center gap-8 md:hidden font-mono p-8"
                    >
                        <button onClick={() => setIsOpen(false)} className="absolute top-8 right-8 text-white/50 hover:text-white">
                            <X size={32} />
                        </button>

                        {['Features', 'How it Works', 'Contact'].map((item) => (
                            <button
                                key={item}
                                onClick={() => {
                                    scrollToSection(item.toLowerCase().replace(/\s+/g, '-'));
                                    setIsOpen(false);
                                }}
                                className="text-3xl font-bold text-white hover:text-blue-400 transition-colors"
                            >
                                {item}
                            </button>
                        ))}
                        <div className="flex flex-col gap-4 w-full mt-8">
                            <button className="w-full py-4 rounded-full border border-white/20 text-white font-bold">
                                Get in Touch
                            </button>
                            <Link to="/auth" className="w-full py-4 rounded-full bg-blue-600 text-white font-bold text-center block" onClick={() => setIsOpen(false)}>
                                Get Started
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
