'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function StitchPage() {
  const [images, setImages] = useState<{[key: string]: File | null}>({
    front: null,
    right: null,
    back: null,
    left: null,
    top: null,
    bottom: null
  });
  
  const [status, setStatus] = useState<string>('');

  const handleFileChange = (side: string, file: File | null) => {
    setImages(prev => ({ ...prev, [side]: file }));
  };

  const isFormValid = Object.values(images).every(img => img !== null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
        setStatus('Please upload all 6 images.');
        return;
    }
    // Placeholder for backend integration
    setStatus('Ready to stitch! (Backend integration pending)');
    console.log('Files ready for stitching:', images);
  };
  
  const sides = ['front', 'right', 'back', 'left', 'top', 'bottom'];

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Create Panorama</h1>
            <Link href="/" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">
                &larr; Back to Home
            </Link>
        </div>
        
        <p className="mb-8 text-gray-600 max-w-2xl text-lg leading-relaxed">
          Upload 6 overlapping photos to create a seamless 360° panorama.  
          Label each photo correctly for the best result.
        </p>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {sides.map((side) => (
                    <div key={side} className="flex flex-col group">
                        <label className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-indigo-600 transition-colors">
                            {side} View
                        </label>
                        <div className={`
                            relative h-40 border-2 border-dashed rounded-xl transition-all duration-200
                            flex items-center justify-center overflow-hidden
                            ${images[side] ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'}
                        `}>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => handleFileChange(side, e.target.files?.[0] || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            
                            {images[side] ? (
                                <div className="p-4 text-center w-full">
                                    <div className="text-2xl mb-1">📸</div>
                                    <span className="text-indigo-700 font-semibold text-xs truncate block w-full px-2">
                                        {images[side]?.name}
                                    </span>
                                </div>
                            ) : (
                                <div className="text-center p-4">
                                    <div className="text-gray-300 text-3xl mb-2 group-hover:scale-110 transition-transform">+</div>
                                    <span className="text-gray-400 text-sm font-medium">Upload Image</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-100">
                <button 
                    type="submit" 
                    disabled={!isFormValid}
                    className={`
                        px-8 py-4 rounded-xl font-bold shadow-lg transition-all duration-200
                        ${isFormValid 
                            ? 'bg-gray-900 text-white hover:bg-black hover:shadow-xl hover:-translate-y-1' 
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}
                    `}
                >
                    ✨ Stitch Images
                </button>
            </div>
        </form>
        
        {status && (
            <div className="mt-8 p-4 bg-indigo-50 text-indigo-900 rounded-xl border border-indigo-100 font-medium text-center animate-pulse">
                {status}
            </div>
        )}
      </div>
    </div>
  );
}
