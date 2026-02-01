import React, { useEffect } from "react";
import Footer from "../components/Footer";
import { motion } from "framer-motion";

export default function TermsOfService() {
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
                    <h1 className="text-4xl md:text-5xl font-bold mt-3 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Terms of Service</h1>
                    <p className="text-white/50 text-lg">Last updated: {new Date().toLocaleDateString()}</p>
                </motion.div>

                <div className="space-y-12 text-white/80 leading-relaxed">
                    <Section title="1. Acceptance of Terms">
                        <p>By accessing and using DocsFlow's services, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
                    </Section>

                    <Section title="2. Use of Service">
                        <p>You agree to use our services only for lawful purposes. You are responsible for all content that you upload or process through our platform. You must not use our service to store or transmit any illegal or unauthorized material.</p>
                    </Section>

                    <Section title="3. User Accounts">
                        <p>To access certain features, you may need to register for an account. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.</p>
                    </Section>

                    <Section title="4. Intellectual Property">
                        <p>The service and its original content, features, and functionality are and will remain the exclusive property of DocsFlow and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of DocsFlow.</p>
                    </Section>

                    <Section title="5. Termination">
                        <p>We may terminate or suspend your account specifically if you breach the Terms. Upon termination, your right to use the Service will immediately cease.</p>
                    </Section>

                    <Section title="6. Contact Us">
                        <p>If you have any questions about these Terms, please contact us at support@docsflow.com.</p>
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
