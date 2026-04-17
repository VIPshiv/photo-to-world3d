'use client';
import { useSearchParams } from 'next/navigation';
import SceneViewer from '@/components/viewer/SceneViewer';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { apiUrl } from "@/lib/api";

function LocalViewContent() {
  const searchParams = useSearchParams();
  const imgPath = searchParams.get('img');
  const [hotspots, setHotspots] = useState<any[]>([]);

  useEffect(() => {
    // Read the passed hotspots from the preview page
    const stored = sessionStorage.getItem('previewHotspots');
    if (stored) {
      try {
        setHotspots(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse preview hotspots', e);
      }
    }
  }, []);

  if (!imgPath) {
    return (
      <div className="flex h-screen items-center justify-center text-red-500 flex-col gap-4">
        <p>No image URL provided.</p>
        <button onClick={() => window.close()} className="text-blue-500 underline">Close Preview</button> 
      </div>
    );
  }

  // Construct full URL pointing to Nest.js static uploads
  const fullImageUrl = apiUrl(`${imgPath}`);

  return (
    <div className="relative w-full h-screen bg-black">
      {/* Basic Navigation Overlay */}
      <div className="absolute top-4 left-4 z-20">
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-100 max-w-sm">
              <div className="flex justify-between items-start mb-2">
                  <h1 className="text-black font-black tracking-tight font-bold text-lg truncate pr-4">Test Panorama</h1>
                  <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                      Local Mode
                  </span>
              </div>
              <p className="text-sm text-slate-400 mb-4">Viewing locally stitched image. Not saved to database.</p>

              <button
                onClick={() => {
                  if (window.history.length > 2) {
                    window.history.back();
                  } else {
                    window.close();
                  }
                }}
                className="w-full bg-gray-900 text-white font-medium py-2 rounded-lg hover:bg-black transition-colors block text-center"
              >
                  &larr; Back / Close Preview
              </button>
          </div>
      </div>

      {/* The 3D Viewer */}
      <div className="w-full h-full relative cursor-grab active:cursor-grabbing overflow-hidden outline-none">
          <SceneViewer imageUrl={fullImageUrl} hotspots={hotspots} />
      </div>
    </div>
  );
}

export default function LocalViewPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-white bg-black">Loading Preview...</div>}>
      <LocalViewContent />
    </Suspense>
  );
}