import { Github, Twitter, Linkedin, Mail } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
    return (
        <footer className="relative z-10 bg-transparent border-t border-white/5 pt-16 pb-8 text-white font-sans">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-8 mb-12">

                    {/* Brand */}
                    <div className="md:col-span-4 lg:col-span-5 flex flex-col gap-5">
                        <Link to="/" className="flex items-center gap-2">
                            <span className="px-3 py-1.5 bg-white text-black rounded-lg text-sm font-bold">Block</span>
                        </Link>
                        <p className="text-white/40 leading-relaxed max-w-sm text-sm">
                            The intelligent interface for your document organization.
                            AI-powered, secure, and built for productivity.
                        </p>
                        <div className="flex gap-3">
                            <SocialLink icon={Github} />
                            <SocialLink icon={Twitter} />
                            <SocialLink icon={Linkedin} />
                            <SocialLink icon={Mail} />
                        </div>
                    </div>

                    {/* Links */}
                    <div className="md:col-span-2 space-y-3">
                        <h4 className="text-white/70 font-medium mb-3 text-xs uppercase tracking-wider">Product</h4>
                        <FooterLink to="#">Features</FooterLink>
                        <FooterLink to="#">Solutions</FooterLink>
                        <FooterLink to="#">Pricing</FooterLink>
                        <FooterLink to="/login">Login</FooterLink>
                    </div>
                    <div className="md:col-span-2 space-y-3">
                        <h4 className="text-white/70 font-medium mb-3 text-xs uppercase tracking-wider">Resources</h4>
                        <FooterLink to="#">Documentation</FooterLink>
                        <FooterLink to="#">API</FooterLink>
                        <FooterLink to="#">Community</FooterLink>
                        <FooterLink to="#">Status</FooterLink>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3 space-y-3">
                        <h4 className="text-white/70 font-medium mb-3 text-xs uppercase tracking-wider">Company</h4>
                        <FooterLink to="#">About</FooterLink>
                        <FooterLink to="#">Open Source</FooterLink>
                        <FooterLink to="#">Careers</FooterLink>
                        <FooterLink to="#">Legal</FooterLink>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/30">
                    <p>© 2024 Block. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link to="#" className="hover:text-white transition-colors">Privacy</Link>
                        <Link to="#" className="hover:text-white transition-colors">Terms</Link>
                        <Link to="#" className="hover:text-white transition-colors">Cookies</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}

function SocialLink({ icon: Icon }) {
    return (
        <a href="#" className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all">
            <Icon size={16} />
        </a>
    )
}

function FooterLink({ to, children }) {
    return <Link to={to} className="block text-white/40 hover:text-white transition-colors text-sm">{children}</Link>
}
