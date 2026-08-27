import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
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
 * Query params that are safe to send to analytics. Everything else is dropped.
 *
 * This is an allowlist rather than a blocklist on purpose. Analytics records the URL of
 * every pageview, and some of our URLs carry things that must never leave the browser:
 * /auth/callback is reached with ?phone=<the user's WhatsApp number> during signup, and
 * Google redirects back with the OAuth credential in the URL. A blocklist would only stop
 * the cases we thought of today; an allowlist stops anything a future route adds too.
 *
 * The campaign params stay so we can still tell where traffic came from, which is the
 * whole reason for adding analytics.
 */
const ANALYTICS_SAFE_PARAMS = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "ref",
]);

/**
 * Strips anything sensitive out of a pageview URL before it is sent.
 *
 * The hash is always removed. Supabase's default OAuth flow returns the access token in
 * the fragment (#access_token=...), so keeping it would mean posting session tokens to a
 * third party. Returning null cancels the event entirely, which is what we do if the URL
 * cannot be parsed, on the grounds that an unsendable event is better than a leaky one.
 */
function scrubAnalyticsUrl(event) {
    try {
        const url = new URL(event.url);
        for (const key of Array.from(url.searchParams.keys())) {
            if (!ANALYTICS_SAFE_PARAMS.has(key)) {
                url.searchParams.delete(key);
            }
        }
        url.hash = "";
        return { ...event, url: url.toString() };
    } catch {
        return null;
    }
}

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
      <Analytics beforeSend={scrubAnalyticsUrl} />
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
