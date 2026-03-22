import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, TrendingUp, Target, Swords, Trophy } from 'lucide-react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ 
    elo: '...', peakElo: '...', gamesPlayed: 0, wins: 0, losses: 0, draws: 0 
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/login');
      } else {
        setUser(currentUser);
        const unsubscribeDB = onSnapshot(doc(db, 'users', currentUser.uid), (doc) => {
          if (doc.exists()) setStats(doc.data());
        });
        return () => unsubscribeDB();
      }
    });
    return () => unsubscribeAuth();
  }, [navigate]);

  if (!user) return null; 

  // Calculate Real Win Rate
  const winRate = stats.gamesPlayed > 0 
    ? Math.round((stats.wins / stats.gamesPlayed) * 100) 
    : 0;

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-16 animate-fade-in relative">
      
      {/* Header */}
      <div className="text-center space-y-6 mt-8">
        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 dark:text-white">
          Welcome, <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500">
            {user.displayName || 'Player'}
          </span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-light">
          Ready to climb the ranks? Play matches against our AI and receive grandmaster-level insights to crush your blunders.
        </p>
        <div className="pt-8">
          <button 
            onClick={() => navigate('/play')}
            className="inline-flex items-center space-x-3 px-10 py-5 rounded-full text-white font-bold text-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90 transition-opacity shadow-[0_10px_40px_-10px_rgba(59,130,246,0.5)] transform hover:-translate-y-1"
          >
            <Play fill="currentColor" size={28} />
            <span>Play vs Bot</span>
          </button>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* ELO Rating */}
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 shadow-xl shadow-black/5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4 text-blue-500">
              <div className="p-3 rounded-full bg-blue-50 dark:bg-blue-900/20">
                <TrendingUp size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Elo Rating</h3>
            </div>
            <div className="flex items-center space-x-1 text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-full">
              <Trophy size={14} />
              <span className="text-sm font-bold">Peak: {stats.peakElo}</span>
            </div>
          </div>
          <p className="text-5xl font-black text-slate-900 dark:text-white">
            {stats.elo}
          </p>
        </div>
        
        {/* Win Rate */}
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 shadow-xl shadow-black/5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-4 mb-6 text-indigo-500">
            <div className="p-3 rounded-full bg-indigo-50 dark:bg-indigo-900/20">
              <Target size={32} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Win Rate</h3>
          </div>
          <p className="text-5xl font-black text-slate-900 dark:text-white">
            {winRate}%
          </p>
        </div>

        {/* Combat Record */}
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 shadow-xl shadow-black/5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-4 mb-6 text-purple-500">
            <div className="p-3 rounded-full bg-purple-50 dark:bg-purple-900/20">
              <Swords size={32} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Record</h3>
          </div>
          <div className="flex items-baseline space-x-2">
            <p className="text-5xl font-black text-green-500">{stats.wins}</p>
            <span className="text-2xl font-bold text-gray-400">-</span>
            <p className="text-5xl font-black text-red-500">{stats.losses}</p>
            <span className="text-2xl font-bold text-gray-400">-</span>
            <p className="text-5xl font-black text-gray-500">{stats.draws}</p>
          </div>
          <p className="text-sm font-bold text-gray-400 mt-2 tracking-widest uppercase">W - L - D</p>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;