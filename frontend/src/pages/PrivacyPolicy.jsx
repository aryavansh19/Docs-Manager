import React, { useEffect } from "react";
import Footer from "../components/Footer";
import { motion } from "framer-motion";

export default function PrivacyPolicy() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen text-white font-sans overflow-x-hidden selection:bg-blue-500/30 relative pt-24">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, #030303 0%, #050510 50%, #030303 100%)', zIndex: -1 }}>
                <div className="absolute top-[5%] left-[-5%] w-[800px] h-[800px] bg-gradient-to-br from-blue-600/20 via-cyan-500/10 to-transparent rounded-full blur-[180px]" />
                <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-[140px]" />
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`, backgroundSize: '80px 80px' }} />
            </div>

            <div className="container mx-auto px-6 py-12 max-w-4xl relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12"
                >
                    <span className="text-blue-400 font-medium tracking-wide uppercase text-sm">Legal</span>
                    <h1 className="text-4xl md:text-5xl font-bold mt-3 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Privacy Policy</h1>
                    <p className="text-white/50 text-lg">Last updated: {new Date().toLocaleDateString()}</p>
                </motion.div>

                <div className="space-y-12 text-white/80 leading-relaxed">
                    <Section title="1. Introduction">
                        <p>Welcome to DocsFlow ("we," "our," or "us"). We comprise a team dedicated to providing intelligent document organization services. This Privacy Policy explains how we collect, use, disclosure, and safeguard your information when you use our website and services.</p>
                    </Section>

                    <Section title="2. Information We Collect">
                        <p>We collect information that you provide directly to us when you register for an account, such as your name, email address, and Google Drive access permissions. We also collect data regarding your usage of the service to improve our offerings.</p>
                    </Section>

                    <Section title="3. How We Use Your Information">
                        <p>We use the information we collect to:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-4 text-white/60">
                            <li>Provide, maintain, and improve our services.</li>
                            <li>Process your document organization requests.</li>
                            <li>Send you technical notices and support messages.</li>
                            <li>Respond to your comments and questions.</li>
                        </ul>
                    </Section>

                    <Section title="4. Data Security">
                        <p>We implement appropriate technical and organizational measures to protect your personal information. Your documents are processed in memory and are not permanently stored on our servers.</p>
                    </Section>

                    <Section title="5. Contact Us">
                        <p>If you have any questions about this Privacy Policy, please contact us at support@docsflow.com.</p>
                    </Section>
                </div>
            </div>

            <Footer />
        </div>
    );
}

const Section = ({ title, children }) => (
    <section className="border-b border-white/5 pb-8">
        <h2 className="text-2xl font-semibold mb-4 text-white/90">{title}</h2>
        <div className="text-white/60 space-y-4">
            {children}
        </div>
    </section>
);
