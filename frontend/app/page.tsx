import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 text-center p-4">
      <h1 className="text-4xl font-bold mb-4 dark:text-white">Smart360</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-md">
        Turn your 360 photos into interactive virtual stores with AI-powered tagging.
      </p>
      
      <div className="flex gap-4">
        {/* EXISTING: Stitch */}
        <Link 
          href="/stitch"
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-md"
        >
          Create Panorama
        </Link>
        {/* EXISTING: Upload Scene */}
        <Link 
          href="/upload"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-md"
        >
          Upload Scene
        </Link>
        {/* EXISTING: Demo */}
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
