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
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 text-center p-4">
        <h1 className="text-4xl font-bold mb-2 dark:text-white">Welcome to Smart360</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-md">
          Select a mock user to continue
        </p>

        <div className="flex flex-col gap-4 w-full max-w-sm">
          {MOCK_USERS.map(user => (
            <button
              key={user.id}
              onClick={() => login(user.id)}
              className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="text-left">
                <div className="font-semibold text-gray-900 dark:text-white">{user.name}</div>
                <div className="text-sm text-gray-500">{user.role}</div>
              </div>
              <div className="text-indigo-600 dark:text-indigo-400 font-medium">Log in &rarr;</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const activeUser = MOCK_USERS.find(u => u.id === currentUser);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 text-center p-4">
      <div className="absolute top-4 right-4 bg-white dark:bg-zinc-800 px-4 py-2 rounded-full shadow border border-gray-200 dark:border-zinc-700 flex items-center gap-4">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          Logged in as <b>{activeUser?.name}</b>
        </span>
        <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 font-medium">
          Logout
        </button>
      </div>

      <h1 className="text-4xl font-bold mb-4 dark:text-white">Smart360 Dashboard</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-md">
        Turn your 360 photos into interactive virtual stores with AI-powered tagging.
      </p>
      
<div className="flex flex-col items-center gap-6 w-full max-w-md mt-6">
        
        {/* Button 1: Create Scene */}
        <div className="w-full">
          <button
            onClick={() => setShowCreateOptions(!showCreateOptions)}
            className="w-full px-6 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-bold shadow-md text-lg flex items-center justify-between"
          >
            <span>Create a Scene</span>
            <span className={`transform transition-transform ${showCreateOptions ? 'rotate-180' : ''}`}>▼</span>
          </button>
          
          {showCreateOptions && (
            <div className="flex flex-col gap-3 mt-3 w-full animate-in fade-in slide-in-from-top-2 duration-200">
              <Link
                href="/stitch"
                className="px-6 py-3 bg-white text-indigo-700 border-2 border-indigo-100 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition font-semibold shadow-sm w-full block text-center"
              >
                1. Create Panorama
              </Link>
              <Link
                href="/upload"
                className="px-6 py-3 bg-white text-indigo-700 border-2 border-indigo-100 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition font-semibold shadow-sm w-full block text-center"
              >
                2. Upload Scene (Objects)
              </Link>
            </div>
          )}
        </div>

        {/* Button 2: Edit Live Scenes */}
        <Link
          href="/scenes/edit"
          className="w-full px-6 py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-bold shadow-md text-lg block text-center"
        >
          Edit Live Scenes
        </Link>

        {/* Button 3: View Scenes */}
        <Link
          href="/scenes/view"
          className="w-full px-6 py-4 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition font-bold shadow-md text-lg block text-center"
        >
          View Scenes
        </Link>

      </div>
    </div>
  );
}
