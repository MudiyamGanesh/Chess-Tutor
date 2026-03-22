import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import GameArena from './pages/GameArena';
import Login from './pages/Login'; // <-- Added this import

function App() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);

  return (
    <Router>
      <div className="min-h-screen flex flex-col font-sans">
        <Navbar darkMode={darkMode} toggleTheme={toggleTheme} />
        <main className="flex-1 overflow-auto bg-bgLight dark:bg-bgDark transition-colors duration-300">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/play" element={<GameArena />} />
            <Route path="/login" element={<Login />} /> {/* <-- Added this Route */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;