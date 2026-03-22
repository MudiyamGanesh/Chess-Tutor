import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, ArrowRight } from 'lucide-react';
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/');
      } else {
        // 1. Create the Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 2. Add username to Auth profile
        await updateProfile(user, { displayName: username });

        // 3. Create their real Database stats document
        await setDoc(doc(db, 'users', user.uid), {
          username: username,
          elo: 1200,
          peakElo: 1200, // New!
          gamesPlayed: 0,
          wins: 0,       // New!
          losses: 0,     // New!
          draws: 0,      // New!
          totalBlunders: 0 // New!
        });

        navigate('/');
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if this Google user already exists in our Firestore database
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      // If they don't exist, create a fresh stats document for them
      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          username: user.displayName || 'Player', // Fallback if Google name is missing
          elo: 1200,
          accuracy: 0,
          lessons: 0,
          gamesPlayed: 0
        });
      }

      navigate('/');
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 animate-fade-in">
      <div className="max-w-md w-full bg-surfaceLight dark:bg-surfaceDark p-8 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800">
        <div className="flex flex-col items-center justify-center mb-8">
          <Crown className="text-accentLight1 dark:text-accentDark1 mb-4" size={48} />
          <h1 className="text-3xl font-black text-textLight dark:text-textDark">
            {isLogin ? 'Welcome Back' : 'Join the Arena'}
          </h1>
        </div>

        {error && <div className="p-3 mb-4 text-sm text-red-600 bg-red-100 rounded-lg">{error}</div>}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full px-4 py-4 rounded-xl bg-gray-100 dark:bg-[#09090b] border-2 border-transparent focus:border-accentLight1 dark:focus:border-accentDark1 text-textLight dark:text-textDark outline-none transition"
              required
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-4 rounded-xl bg-gray-100 dark:bg-[#09090b] border-2 border-transparent focus:border-accentLight1 dark:focus:border-accentDark1 text-textLight dark:text-textDark outline-none transition"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-4 rounded-xl bg-gray-100 dark:bg-[#09090b] border-2 border-transparent focus:border-accentLight1 dark:focus:border-accentDark1 text-textLight dark:text-textDark outline-none transition"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-4 rounded-xl text-white font-bold text-lg bg-gradient-to-r from-accentLight1 to-accentLight2 dark:from-accentDark1 dark:to-accentDark2 hover:opacity-90 transition transform hover:scale-105 disabled:opacity-50"
          >
            <span>{loading ? 'Connecting...' : (isLogin ? 'Login' : 'Sign Up')}</span>
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>

        {/* --- GOOGLE LOGIN SECTION --- */}
        <div className="mt-6 flex items-center space-x-4">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
          <span className="text-sm font-medium text-gray-400 dark:text-gray-500">OR</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-6 w-full flex items-center justify-center space-x-3 py-4 rounded-xl bg-white dark:bg-[#09090b] border-2 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 text-textLight dark:text-textDark font-bold text-lg transition transform hover:scale-105 disabled:opacity-50"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <p className="mt-6 text-center text-sm text-gray-500">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)} className="font-bold text-accentLight1 dark:text-accentDark1 hover:underline">
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;