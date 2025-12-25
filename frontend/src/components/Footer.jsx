import { Terminal, Github, Twitter, Linkedin, Mail } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
    return (
        <footer className="bg-[#020202] border-t border-white/5 pt-20 pb-10 text-white font-mono relative overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 pointer-events-none opacity-5"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            />

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-8 mb-16">

                    {/* Brand Column */}
                    <div className="md:col-span-4 lg:col-span-5 flex flex-col gap-6">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5 text-white border border-white/10">
                                <Terminal size={24} />
                            </div>
                            <span className="font-bold text-2xl tracking-tight">SmartDoc.ai</span>
                        </Link>
                        <p className="text-white/50 leading-relaxed max-w-sm">
                            The intelligent interface for your academic and professional knowledge base.
                            Open source, secure, and built for speed.
                        </p>
                        <div className="flex gap-4">
                            <SocialLink icon={Github} />
                            <SocialLink icon={Twitter} />
                            <SocialLink icon={Linkedin} />
                            <SocialLink icon={Mail} />
                        </div>
                    </div>

                    {/* Links Column 1 */}
                    <div className="md:col-span-2 lg:col-span-2 space-y-4">
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs text-blue-500">Product</h4>
                        <FooterLink to="/#features">Features</FooterLink>
                        <FooterLink to="/#how-it-works">Architecture</FooterLink>
                        <FooterLink to="/#contact">Pricing</FooterLink>
                        <FooterLink to="/login">Login</FooterLink>
                    </div>

                    {/* Links Column 2 */}
                    <div className="md:col-span-2 lg:col-span-2 space-y-4">
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs text-purple-500">Resources</h4>
                        <FooterLink to="#">Documentation</FooterLink>
                        <FooterLink to="#">API Reference</FooterLink>
                        <FooterLink to="#">Community</FooterLink>
                        <FooterLink to="#">Status</FooterLink>
                    </div>

                    {/* Links Column 3 */}
                    <div className="md:col-span-2 lg:col-span-3 space-y-4">
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs text-green-500">Company</h4>
                        <FooterLink to="#">About Us</FooterLink>
                        <FooterLink to="#">Open Source</FooterLink>
                        <FooterLink to="#">Careers</FooterLink>
                        <FooterLink to="#">Legal</FooterLink>
                    </div>

                </div>

                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/30">
                    <p>© 2024 SmartDoc AI Inc. All rights reserved.</p>
                    <div className="flex gap-8">
                        <Link to="#" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link to="#" className="hover:text-white transition-colors">Terms of Service</Link>
                        <Link to="#" className="hover:text-white transition-colors">Cookie Settings</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}

function SocialLink({ icon: Icon }) {
    return (
        <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 transition-all hover:scale-110">
            <Icon size={18} />
        </a>
    )
}

function FooterLink({ to, children }) {
    return (
        <Link to={to} className="block text-white/50 hover:text-white transition-colors text-sm">
            {children}
        </Link>
    )
}
