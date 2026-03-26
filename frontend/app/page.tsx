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
      
      <div className="flex flex-wrap justify-center gap-4">
        <Link 
          href="/stitch"
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-md"
        >
          Create Panorama
        </Link>
        <Link 
          href="/upload"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-md"
        >
          Upload Scene / Inventory
        </Link>
        <Link 
          href="/view/demo" 
          className="px-6 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-100 transition font-medium shadow-sm"
        >
          View Demo
        </Link>
      </div>
    </div>
  );
}
