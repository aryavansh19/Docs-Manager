import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import FloatingNav from "./components/FloatingNav";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Verification from "./pages/Verification";
import SetupScreen from "./pages/SetupScreen.jsx";
import Dashboard from "./pages/Dashboard";
import AuthOptions from "./pages/AuthOptions";
import Signup from "./pages/Signup";
import AuthCallback from './pages/AuthCallback';
import ProtectedRoute from "./components/ProtectedRoute";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

/**
 * Resets scroll on navigation, and honours in-page hash targets
 * (the footer links to /#features and friends).
 */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
}

function App() {
  return (
    <>
      <ScrollManager />
      <FloatingNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthOptions />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/verify" element={<Verification />} />
          <Route path="/setup" element={<SetupScreen />} />
        </Route>
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}

export default App;
