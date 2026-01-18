// frontend/src/components/AuthComponent.jsx
import { supabase } from '../supabaseClient'

const AuthComponent = () => {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:5173', // or your specific redirect
      },
    })
  }

  return (
    <button onClick={handleGoogleLogin}>
      Sign in with Google
    </button>
  )
}

export default AuthComponent // <--- THIS LINE IS CRUCIAL