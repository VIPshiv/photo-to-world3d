"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

const MOCK_USERS = [
  { id: 'user-1', name: 'Alice (Furniture)', role: 'Owner' },
  { id: 'user-2', name: 'Bob (Electronics)', role: 'Owner' },
  { id: 'user-3', name: 'Charlie (Sports)', role: 'Owner' },
];

export default function Home() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [showCreateOptions, setShowCreateOptions] = useState(false);

  useEffect(() => {
    const savedUserId = localStorage.getItem('mockUserId');
    if (savedUserId) {
      setCurrentUser(savedUserId);
    }
  }, []);

  const login = (userId: string) => {
    localStorage.setItem('mockUserId', userId);
    setCurrentUser(userId);
  };

  const logout = () => {
    localStorage.removeItem('mockUserId');
    setCurrentUser(null);
  };

  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#e5e7eb] font-sans p-4 relative">      
        
        <div className="bg-white/80 backdrop-blur-2xl p-10 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 w-full max-w-sm text-center">
          <h1 className="text-3xl font-black text-black tracking-tight mb-2">Welcome</h1>
          <p className="text-sm font-medium text-slate-500 mb-8">
            Select a mock user to continue
          </p>

          <div className="flex flex-col gap-4">
            {MOCK_USERS.map(user => (
              <button
                key={user.id}
                onClick={() => login(user.id)}
                className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group text-left"
              >
                <div>
                  <div className="font-bold text-slate-800 tracking-tight">{user.name}</div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{user.role}</div>       
                </div>
                <div className="text-indigo-600 font-bold bg-indigo-50 w-8 h-8 rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">&rarr;</div>  
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeUser = MOCK_USERS.find(u => u.id === currentUser);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#e5e7eb] font-sans p-4 relative">        
      
      {/* Top Bar Status */}
      <div className="absolute top-6 right-6 bg-white/80 backdrop-blur-xl px-5 py-2.5 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 flex items-center gap-4">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          Logged in as <b className="text-indigo-600 font-black ml-1">{activeUser?.name}</b>
        </span>
        <div className="w-px h-4 bg-slate-200"></div>
        <button onClick={logout} className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
          Logout
        </button>
      </div>

      <div className="text-center mb-10 mt-16">
        <h1 className="text-4xl md:text-5xl font-black text-black tracking-tight mb-4">Smart360 Dashboard</h1>
        <p className="text-base md:text-lg font-medium text-slate-500 max-w-lg mx-auto">       
          Turn your 360 photos into interactive virtual stores with AI-powered tagging.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-5 w-full max-w-md relative z-10">

        {/* Button 1: Create Scene */}
        <div className="w-full flex flex-col gap-4">
          <button
            onClick={() => setShowCreateOptions(!showCreateOptions)}
            className="w-full px-6 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-xl hover:shadow-indigo-500/25 transition-all hover:-translate-y-1 rounded-[24px] font-black text-lg tracking-tight flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl leading-none group-hover:scale-110 transition-transform">✨</span> Create a Scene
            </div>
            <svg className={`w-6 h-6 transform transition-transform duration-300 opacity-80 ${showCreateOptions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
          </button>

          {showCreateOptions && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
              <Link
                href="/stitch"
                className="w-full px-6 py-4 bg-white/80 backdrop-blur-2xl text-slate-800 border border-white/60 hover:border-indigo-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all hover:-translate-y-1 rounded-[20px] font-bold text-base flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">1</div>
                    Create Panorama
                </div>
                <div className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all">&rarr;</div>
              </Link>
              <Link
                href="/upload"
                className="w-full px-6 py-4 bg-white/80 backdrop-blur-2xl text-slate-800 border border-white/60 hover:border-indigo-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all hover:-translate-y-1 rounded-[20px] font-bold text-base flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">2</div>
                    Upload Objects
                </div>
                <div className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all">&rarr;</div>
              </Link>
            </div>
          )}
        </div>

        {/* Button 2: Edit Live Scenes */}
        <Link
          href="/scenes/edit"
          className="w-full px-6 py-5 bg-black text-white hover:shadow-xl hover:shadow-black/25 transition-all hover:-translate-y-1 rounded-[24px] font-black text-lg tracking-tight flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none group-hover:scale-110 transition-transform">🏗️</span> Edit Live Scenes
          </div>
          <div className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">&rarr;</div>
        </Link>

        {/* Button 3: View Scenes */}
        <Link
          href="/scenes/view"
          className="w-full px-6 py-5 bg-white/80 backdrop-blur-2xl text-slate-800 border border-white/60 hover:border-indigo-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all hover:-translate-y-1 rounded-[24px] font-black text-lg tracking-tight flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none group-hover:scale-110 transition-transform">👁️</span> View Scenes
          </div>
          <div className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-indigo-600">&rarr;</div>
        </Link>

      </div>
    </div>
  );
}