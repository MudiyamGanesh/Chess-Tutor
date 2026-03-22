import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, Crown, LogIn, LogOut } from 'lucide-react';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const Navbar = ({ darkMode, toggleTheme }) => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation(); // Grabs the current URL path

  // Listen for login/logout changes automatically
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthAction = async () => {
    if (user) {
      await signOut(auth);
      navigate('/login');
    } else {
      navigate('/login');
    }
  };

  // Check if the user is currently on the login page
  const isLoginPage = location.pathname === '/login';

  return (
    <nav className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-surfaceLight dark:bg-surfaceDark shadow-sm z-10 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3 text-2xl font-black tracking-tighter">
          <Crown className="text-accentLight2 dark:text-accentDark2" size={32} />
          <span className="bg-clip-text text-transparent bg-[length:200%_200%] bg-gradient-to-r from-accentLight1 to-accentLight2 dark:from-accentDark1 dark:to-accentDark2">
            ChessTutor
          </span>
        </Link>
        <div className="flex items-center space-x-4 sm:space-x-6">
          
          {/* Dynamic Login / Logout Button - Completely hidden if on the Login page and not logged in */}
          {!(isLoginPage && !user) && (
            <>
              <button 
                onClick={handleAuthAction}
                className="flex items-center space-x-2 text-sm sm:text-base font-bold text-gray-600 dark:text-gray-300 hover:text-accentLight1 dark:hover:text-accentDark1 transition"
              >
                {user ? (
                  <>
                    <span className="hidden sm:inline">Logout</span>
                    <LogOut size={20} />
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Login</span>
                    <LogIn size={20} />
                  </>
                )}
              </button>
              
              {/* Vertical divider line */}
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-700"></div>
            </>
          )}

          <button 
            onClick={toggleTheme} 
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            aria-label="Toggle Theme"
          >
            {darkMode ? <Sun size={22} className="text-yellow-400" /> : <Moon size={22} className="text-gray-700" />}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;