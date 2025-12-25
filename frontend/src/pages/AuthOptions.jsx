import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { LogIn, UserPlus, ArrowLeft, Terminal } from "lucide-react";

export default function AuthOptions() {
    return (
        <div className="min-h-screen bg-[#020202] text-white font-mono relative overflow-hidden flex flex-col">

            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.15),transparent_50%)]" />
                <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_0%_100%,rgba(168,85,247,0.15),transparent_50%)]" />
                <div className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                />
            </div>

            {/* Navbar */}
            <nav className="relative z-20 flex items-center justify-between px-6 py-6 container mx-auto">
                <Link to="/" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors group">
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span>Back to Home</span>
                </Link>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20">
                        <Terminal size={20} />
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 -mt-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
                        Welcome to <span className="text-blue-500">SmartDoc</span>
                    </h1>
                    <p className="text-white/50 max-w-md mx-auto">
                        Choose how you want to access your intelligent workspace.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                    {/* Log In Option */}
                    <Link to="/login" className="group">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 p-10 rounded-2xl h-full flex flex-col items-center justify-center text-center hover:border-blue-500/50 hover:bg-blue-900/5 transition-all group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-blue-900/20"
                        >
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-white/70 group-hover:text-blue-400 group-hover:bg-blue-500/20">
                                <LogIn size={32} />
                            </div>
                            <h2 className="text-2xl font-bold mb-3 group-hover:text-blue-400 transition-colors">Log In</h2>
                            <p className="text-white/40 text-sm">
                                Access your existing projects and continue where you left off.
                            </p>
                        </motion.div>
                    </Link>

                    {/* Sign Up Option */}
                    <Link to="/signup" className="group">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 p-10 rounded-2xl h-full flex flex-col items-center justify-center text-center hover:border-purple-500/50 hover:bg-purple-900/5 transition-all group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-purple-900/20"
                        >
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-white/70 group-hover:text-purple-400 group-hover:bg-purple-500/20">
                                <UserPlus size={32} />
                            </div>
                            <h2 className="text-2xl font-bold mb-3 group-hover:text-purple-400 transition-colors">Create Account</h2>
                            <p className="text-white/40 text-sm">
                                Join the platform and start organizing your knowledge base today.
                            </p>
                        </motion.div>
                    </Link>
                </div>
            </main>

            <footer className="relative z-10 py-6 text-center text-white/20 text-xs">
                &copy; {new Date().getFullYear()} SmartDoc AI. All systems operational.
            </footer>
        </div>
    );
}
