"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function EditScenesPage() {
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScenes();
  }, []);

  const fetchScenes = async () => {
    try {
      const res = await fetch('http://localhost:3001/scenes/store/my-scenes', {
        headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '' }
      });
      if (res.ok) {
        const data = await res.json();
        setScenes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Edit Live Scenes</h1>
            <p className="text-gray-500 mt-1">Manage your active 3D scenes, edit objects, and update hotspots.</p>
          </div>
          <Link href="/" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            &larr; Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="text-center p-12 text-gray-500">Loading scenes...</div>
        ) : scenes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
            No scenes found.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {scenes.map(scene => (
              <div key={scene.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-24 h-16 bg-gray-100 rounded-lg overflow-hidden relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`http://localhost:3001${scene.imageUrl}`}
                      alt={scene.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{scene.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        scene.status === 'LIVE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {scene.status}
                      </span>
                      <span className="text-xs text-gray-500">{scene.hotspots?.length || 0} objects</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 relative">
                  <button className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                    Edit Objects
                  </button>
                  <button className="px-4 py-2 text-sm font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}