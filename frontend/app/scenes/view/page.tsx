"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ViewScenesPage() {
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LIVE' | 'DRAFT'>('LIVE');

  useEffect(() => {
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
    fetchScenes();
  }, []);

  const filteredScenes = scenes.filter(s => s.status === activeTab);

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

        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button 
            className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'LIVE' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            onClick={() => setActiveTab('LIVE')}
          >
            Live ({scenes.filter(s => s.status === 'LIVE').length})
          </button>
          <button 
            className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'DRAFT' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            onClick={() => setActiveTab('DRAFT')}
          >
            Drafts ({scenes.filter(s => s.status === 'DRAFT').length})
          </button>
        </div>

        {loading ? (
          <div className="text-center p-12 text-gray-500">Loading scenes...</div>
        ) : filteredScenes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
            You don't have any {activeTab.toLowerCase()} scenes right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredScenes.map(scene => (
              <div key={scene.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all group">
                <Link href={`/view/${scene.id}`} className="block relative aspect-video bg-gray-100 cursor-pointer overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`http://localhost:3001${scene.imageUrl}`}
                    alt={scene.title}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className={`absolute top-2 right-2 text-white text-xs px-2 py-1 rounded-md font-bold shadow ${scene.status === 'LIVE' ? 'bg-green-500' : 'bg-orange-500'}`}>
                    {scene.status}
                  </div>
                </Link>
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-lg text-gray-900 mb-1 truncate">{scene.title}</h3>
                    <p className="text-sm text-gray-500">
                      {scene.hotspots?.length || 0} interactive objects
                    </p>
                  </div>
                  <Link href={`/scenes/edit?highlight=${scene.id}`} className="shrink-0 px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors">
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}