import { Routes, Route } from "react-router-dom";
import FloatingNav from "./components/FloatingNav";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Verification from "./pages/Verification";
import SetupScreen from "./pages/SetupScreen.jsx";
import Dashboard from "./pages/Dashboard";
import AuthOptions from "./pages/AuthOptions";
import Signup from "./pages/Signup";
import CreateSubject from "./pages/CreateSubject.jsx";
import AuthCallback from './pages/AuthCallback';
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <>
      <FloatingNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthOptions />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/create" element={<CreateSubject />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/verify" element={<Verification />} />
          <Route path="/setup" element={<SetupScreen />} />
        </Route>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}

export default App;

//
// import { useEffect, useState } from 'react'
// import { supabase } from './supabaseClient'
// import AuthComponent from './components/AuthComponent' // <--- IMPORT THIS
//
// function App() {
//   const [session, setSession] = useState(null)
//
//   useEffect(() => {
//     supabase.auth.getSession().then(({ data: { session } }) => {
//       setSession(session)
//     })
//
//     const {
//       data: { subscription },
//     } = supabase.auth.onAuthStateChange((_event, session) => {
//       setSession(session)
//     })
//
//     return () => subscription.unsubscribe()
//   }, [])
//
//   if (!session) {
//     // REPLACE the button with your component
//     return (
//       <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>
//         <AuthComponent />
//       </div>
//     )
//   }
//   else {
//     return (
//       <div>
//         <h1>Welcome, {session.user.email}</h1>
//         <button onClick={() => supabase.auth.signOut()}>Sign Out</button>
//       </div>
//     )
//   }
// }
//
// export default App