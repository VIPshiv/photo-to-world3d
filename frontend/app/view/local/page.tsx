'use client';
import { useSearchParams } from 'next/navigation';
import SceneViewer from '@/components/viewer/SceneViewer';
import Link from 'next/link';

export default function LocalViewPage() {
  const searchParams = useSearchParams();
  const imgPath = searchParams.get('img');

  if (!imgPath) {
    return (
      <div className="flex h-screen items-center justify-center text-red-500 flex-col gap-4">
        <p>No image URL provided.</p>
        <Link href="/stitch" className="text-blue-500 underline">Back to Stitcher</Link>
      </div>
    );
  }

  // Construct full URL pointing to Nest.js static uploads
  const fullImageUrl = `http://localhost:3001${imgPath}`;

  return (
    <div className="relative w-full h-screen bg-black">
      {/* Basic Navigation Overlay */}
      <div className="absolute top-4 left-4 z-20">
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-100 max-w-sm">
              <div className="flex justify-between items-start mb-2">
                  <h1 className="text-gray-900 font-bold text-lg truncate pr-4">Test Panorama</h1>
                  <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                      Local Mode
                  </span>
              </div>
              <p className="text-sm text-gray-500 mb-4">Viewing locally stitched image. Not saved to database.</p>
              
              <Link 
                href="/stitch"
                className="w-full bg-gray-900 text-white font-medium py-2 rounded-lg hover:bg-black transition-colors block text-center"
              >
                  &larr; Back to Sticher
              </Link>
          </div>
      </div>

      {/* The 3D Viewer */}
      <div className="w-full h-full relative cursor-grab active:cursor-grabbing overflow-hidden outline-none">
          <SceneViewer imageUrl={fullImageUrl} hotspots={[]} />
      </div>
    </div>
  );
}