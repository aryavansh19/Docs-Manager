import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
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
    return <div className="p-10 text-white font-mono">Loading Session...</div>;
  }

  if (!session) {
    console.warn("⛔ ProtectedRoute: Redirecting to /login because no session found.");
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}