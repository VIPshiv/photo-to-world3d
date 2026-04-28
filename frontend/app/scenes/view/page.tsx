"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiUrl } from "@/lib/api";

export default function ViewScenesPage() {
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LIVE' | 'DRAFT'>('LIVE');

  useEffect(() => {
    const fetchScenes = async () => {
      try {
        const res = await fetch(apiUrl('/scenes/store/my-scenes'), {
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
    <div className="min-h-screen bg-[#e5e7eb] font-sans p-4 md:p-10 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-6 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300 mb-10 flex-shrink-0">
            <div>
              <h1 className="text-3xl font-black text-black tracking-tight">View Scenes</h1>
              <p className="text-slate-500 font-medium text-sm mt-1">Explore your live 3D worlds and interact with objects.</p>
            </div>
            <div className="flex gap-3">
              <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-black transition-all hover:-translate-y-0.5 shadow-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Home
              </Link>
            </div>
          </div>

        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button 
            className={`pb-4 px-2 text-sm font-black tracking-tight border-b-2 transition-colors ${activeTab === 'LIVE' ? 'border-black text-black' : 'border-transparent text-slate-400 hover:text-slate-800'}`}
            onClick={() => setActiveTab('LIVE')}
          >
            Live ({scenes.filter(s => s.status === 'LIVE').length})
          </button>
          <button 
            className={`pb-4 px-2 text-sm font-black tracking-tight border-b-2 transition-colors ${activeTab === 'DRAFT' ? 'border-black text-black' : 'border-transparent text-slate-400 hover:text-slate-800'}`}
            onClick={() => setActiveTab('DRAFT')}
          >
            Drafts ({scenes.filter(s => s.status === 'DRAFT').length})
          </button>
        </div>

        {loading ? (
          <div className="text-center p-16 text-slate-500 font-bold tracking-tight animate-pulse">Loading scenes...</div>
        ) : filteredScenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white/40 border border-dashed border-slate-200 rounded-[32px] text-slate-400 font-medium">
            You don't have any {activeTab.toLowerCase()} scenes right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredScenes.map(scene => (
              <div key={scene.id} className="bg-white/80 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-500 group hover:-translate-y-1 block">
                <Link href={`/view/${scene.id}`} className="block relative aspect-video bg-slate-100 cursor-pointer overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scene.imageUrl ? apiUrl(scene.imageUrl) : undefined}
                    alt={scene.title}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className={`absolute top-2 right-2 text-white text-xs px-2 py-1 rounded-md font-bold shadow ${scene.status === 'LIVE' ? 'bg-green-500' : 'bg-orange-500'}`}>
                    {scene.status}
                  </div>
                </Link>
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="overflow-hidden">
                    <h3 className="text-xl font-black text-black tracking-tight mb-1 truncate">{scene.title}</h3>
                    <p className="text-sm text-slate-400">
                      {scene.hotspots?.length || 0} interactive objects
                    </p>
                  </div>
                  <Link href={`/scenes/edit?highlight=${scene.id}`} className="shrink-0 px-4 py-2 text-xs font-black tracking-tight bg-black text-white hover:shadow-lg hover:shadow-black/25 hover:-translate-y-0.5 rounded-xl transition-all">
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