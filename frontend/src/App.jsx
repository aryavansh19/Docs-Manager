import { Routes, Route } from "react-router-dom";
import FloatingNav from "./components/FloatingNav";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Verification from "./pages/Verification";
import SetupScreen from "./pages/SetupScreen.jsx";
import Dashboard from "./pages/Dashboard";
import AuthOptions from "./pages/AuthOptions";
import Signup from "./pages/Signup";

function App() {
  return (
    <>
      <FloatingNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthOptions />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify" element={<Verification />} />
          <Route path="/setup" element={<SetupScreen />} />
        <Route path="/dashboard" element={<Dashboard />} />
          {/* Redirect any other path to Home */}
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}

export default App;