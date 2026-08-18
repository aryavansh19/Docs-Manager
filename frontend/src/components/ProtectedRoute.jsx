import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../supabaseClient";

export default function ProtectedRoute() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log("🛡️ ProtectedRoute Check:", session ? "User Found" : "No User");
      setSession(session);
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("🛡️ Auth State Changed:", _event, session ? "User Active" : "User Gone");
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-2.5" aria-hidden="true">
            {["bg-flame", "bg-lime", "bg-cobalt"].map((color, i) => (
              <motion.span
                key={color}
                className={`h-3.5 w-3.5 rounded-full border-2 border-ink ${color}`}
                animate={{ y: [0, -10, 0] }}
                transition={{
                  duration: 0.7,
                  repeat: Infinity,
                  delay: i * 0.13,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
          <p
            role="status"
            aria-live="polite"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink-45"
          >
            Checking your session
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    console.warn("⛔ ProtectedRoute: Redirecting to /login because no session found.");
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
