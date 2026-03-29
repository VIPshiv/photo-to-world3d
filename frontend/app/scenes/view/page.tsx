"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ViewScenesPage() {
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScenes = async () => {
      try {
        const res = await fetch('http://localhost:3001/scenes/store/my-scenes', {
          headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '' }
        });
        if (res.ok) {
          const data = await res.json();
          // Only show 'LIVE' scenes on the viewer gallery
          setScenes(data.filter((s: any) => s.status === 'LIVE'));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchScenes();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">View Scenes</h1>
            <p className="text-gray-500 mt-1">Explore your live 3D worlds and interact with objects.</p>
          </div>
          <Link href="/" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            &larr; Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="text-center p-12 text-gray-500">Loading scenes...</div>
        ) : scenes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
            You don't have any Live scenes yet. Go create and finalize one!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenes.map(scene => (
              <Link href={`/view/${scene.id}`} key={scene.id} className="block group">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer">
                  <div className="aspect-video bg-gray-100 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`http://localhost:3001${scene.imageUrl}`}
                      alt={scene.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-md font-bold shadow">
                      LIVE
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-1">{scene.title}</h3>
                    <p className="text-sm text-gray-500">
                      {scene.hotspots?.length || 0} interactive objects
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}