import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";

export default function FloatingNav() {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const { scrollY } = useScroll();

    useMotionValueEvent(scrollY, "change", (latest) => {
        if (latest > window.innerHeight - 100) {
            setHidden(true);
        } else {
            setHidden(false);
        }
        setScrolled(latest > 150);
    });

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
    };

    // Hide on special pages
    if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/auth') || location.pathname.startsWith('/login') || location.pathname.startsWith('/signup') || location.pathname.startsWith('/setup') || location.pathname.startsWith('/verify') || location.pathname.startsWith('/create')) {
        return null;
    }

    return (
        <>
            <motion.nav
                initial={{ y: 0, opacity: 1 }}
                animate={{
                    y: hidden ? -100 : 0,
                    opacity: hidden ? 0 : 1,
                    width: "95%",
                    maxWidth: scrolled ? "60rem" : "80rem",
                    top: "24px",
                    borderRadius: scrolled ? "50px" : "0px",
                    backgroundColor: scrolled ? "rgba(17, 17, 17, 0.9)" : "transparent",
                    borderColor: scrolled ? "rgba(255, 255, 255, 0.1)" : "transparent",
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="fixed left-1/2 -translate-x-1/2 z-50 backdrop-blur-sm border border-transparent overflow-hidden"
            >
                <div className="w-full px-6 py-4 flex items-center justify-between">

                    {/* Logo - DocsFlow style */}
                    <Link to="/" className="flex items-center gap-2">
                        <span className="text-xl md:text-2xl font-bold tracking-tighter text-white">DocsFlow</span>
                    </Link>

                    {/* Links */}
                    {/* Links */}
                    <div className="hidden md:flex items-center gap-8">
                        {[
                            { label: 'Features', id: 'features' },
                            { label: 'Workflow', id: 'how-it-works' },
                            { label: 'Get in Touch', id: 'contact' }
                        ].map((item) => (
                            <button
                                key={item.label}
                                onClick={() => scrollToSection(item.id)}
                                className="text-base font-medium text-white/70 hover:text-white transition-colors"
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <Link to="/auth" className={`px-6 py-2.5 rounded-full text-base font-medium transition-all ${scrolled ? 'bg-white/10 text-white hover:bg-white hover:text-black' : 'bg-white text-black hover:bg-gray-200'}`}>
                            Start Organizing
                        </Link>
                        <button className="md:hidden p-2 text-white/80" onClick={() => setIsOpen(!isOpen)}>
                            {isOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>
            </motion.nav>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-[#0a0a0a] flex flex-col items-center justify-center gap-8 md:hidden"
                    >
                        <button onClick={() => setIsOpen(false)} className="absolute top-8 right-8 text-white/50 hover:text-white"><X size={32} /></button>
                        {[
                            { label: 'Features', id: 'features' },
                            { label: 'Workflow', id: 'how-it-works' },
                            { label: 'Get in Touch', id: 'contact' }
                        ].map((item) => (
                            <button key={item.label} onClick={() => { scrollToSection(item.id); setIsOpen(false); }} className="text-3xl font-bold text-white hover:text-blue-400 transition-colors">{item.label}</button>
                        ))}
                        <Link to="/auth" className="w-64 py-4 rounded-full bg-white text-black font-bold text-center" onClick={() => setIsOpen(false)}>Start Organizing</Link>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
