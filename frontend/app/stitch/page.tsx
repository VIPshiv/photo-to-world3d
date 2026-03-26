'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type StitchMode = 'cubemap' | 'guided';
type GuidedSubMode = 'manual' | 'auto';

export default function StitchPage() {
  const [mode, setMode] = useState<StitchMode>('cubemap');
  const [guidedMode, setGuidedMode] = useState<GuidedSubMode>('manual'); // Sub-tab state
  const [status, setStatus] = useState<string>('');
  const [resultId, setResultId] = useState<string | null>(null);
  
  // Auto Stitch state (Any number of images)
  const [autoFiles, setAutoFiles] = useState<File[]>([]);

  // Cubemap state (6 images)
  const [cubeImages, setCubeImages] = useState<{[key: string]: File | null}>({
    front: null, right: null,
    back: null, left: null,
    top: null, bottom: null
  });

  // Guided state (8 images)
  const [guidedImages, setGuidedImages] = useState<{[key: string]: File | null}>({
    'front-left': null, 'front': null, 'front-right': null,
    'left': null, 'right': null,
    'back-left': null, 'back': null, 'back-right': null
  });
  
  const handleCubeFileChange = (side: string, file: File | null) => {
    setCubeImages(prev => ({ ...prev, [side]: file }));
  };

  const handleGuidedFileChange = (position: string, file: File | null) => {
    setGuidedImages(prev => ({ ...prev, [position]: file }));
  };

  const handleAutoFileChange = (files: FileList | null) => {
      if (!files) return;
      // Append new files to existing ones instead of replacing
      setAutoFiles(prev => [...prev, ...Array.from(files)]);
  };

  // Validation
  const isCubeValid = Object.values(cubeImages).every(img => img !== null);
  // For guided, ensure at least 2 images are uploaded
  const isGuidedValid = Object.values(guidedImages).filter(img => img !== null).length >= 2;
  const isAutoValid = autoFiles.length >= 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'cubemap' && !isCubeValid) { setStatus('Please upload all 6 cubemap images.'); return; }
    if (mode === 'guided' && guidedMode === 'manual' && !isGuidedValid) {
        setStatus('Please upload at least 2 images for stitching.');
        return;
    }
    if (mode === 'guided' && guidedMode === 'auto' && !isAutoValid) {
        setStatus('Please upload at least 2 images.');
        return;
    }

    setStatus(`Stitching (${mode} mode) in progress...`);
    setResultId(null);
    
    const formData = new FormData();
    formData.append('mode', mode); // 'cubemap' or 'guided'
    
    if (mode === 'cubemap') {
        Object.entries(cubeImages).forEach(([side, file]) => {
            if (file) {
                // Send with fieldname matching the side (e.g. 'front', 'left')
                // This allows backend to identify them by fieldname
                formData.append(side, file);
            }
        });
    } else if (mode === 'guided') {
        if (guidedMode === 'manual') {
            Object.values(guidedImages).forEach(file => file && formData.append('files', file));
        } else {
            autoFiles.forEach(file => formData.append('files', file));
        }
    }

    try {
        const response = await fetch('http://localhost:3001/scenes/stitch', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Stitching failed');
        }

        const data = await response.json();
        
        // Pass the raw image URL query parameter instead of a scene ID
        // so the local test viewer can render it seamlessly.
        setStatus('Stitching complete! Click to view.');
        setResultId(encodeURIComponent(data.imageUrl)); // Passing the url string instead of ID for the "local" viewer

    } catch (err: unknown) {
        console.error('Upload Error:', err);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
        setStatus(`Error: ${errorMsg}`);
    }
  };
  
  const cubeSides = ['front', 'right', 'back', 'left', 'top', 'bottom'];
  
  // Layout for Guided Mode: 
  // Row 1: FL, F, FR
  // Row 2: L, (Spacer), R
  // Row 3: BL, B, BR
  const guidedLayout = [
    ['front-left', 'front', 'front-right'],
    ['left', null, 'right'], // null for center spacer
    ['back-left', 'back', 'back-right']
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-black font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Create Panorama</h1>
              <p className="text-gray-500 mt-1">Stitch multiple photos into a seamless 3D world.</p>
            </div>
            <Link href="/" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-black transition-colors">
                &larr; Back to Home
            </Link>
        </div>
        
        {/* Mode Toggle */}
        <div className="flex justify-center mb-10">
            <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200 inline-flex">
                <button
                    onClick={() => setMode('cubemap')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        mode === 'cubemap' 
                        ? 'bg-gray-900 text-white shadow-md' 
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    <span className="text-lg">🎲</span> Cubemap
                </button>
                <button
                    onClick={() => setMode('guided')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        mode === 'guided' 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    <span className="text-lg">📸</span> Guided 
                </button>
            </div>
        </div>

        <div className={`text-center max-w-2xl mx-auto mb-8 p-4 rounded-xl border ${mode === 'cubemap' ? 'bg-gray-100 border-gray-200' : 'bg-indigo-50 border-indigo-100'}`}>
          <p className={`text-sm font-medium ${mode === 'cubemap' ? 'text-gray-700' : 'text-indigo-800'}`}>
            {mode === 'cubemap' 
              ? "Upload 6 specific faces of a cube to create a seamless 360° panorama."
              : "Capture 8 overlapping photos around you. Our AI will automatically align and stitch them."
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 relative">
            
            {/* CUBEMAP UI */}
            {mode === 'cubemap' && (
                <div className="flex flex-col items-center mb-10 w-full">
                    {/* Unfolded Cube Layout */}
                    <div className="grid grid-cols-4 gap-4 max-w-3xl w-full">
                        {/* Row 1: Top (center-left) */}
                        <div className="col-start-2 col-span-1">
                            <FileUploadBox 
                                label="Top" 
                                file={cubeImages['top']} 
                                onChange={(f) => handleCubeFileChange('top', f)} 
                            />
                        </div>
                        
                        {/* Row 2: Left, Front, Right, Back */}
                        <div className="col-start-1 col-span-4 grid grid-cols-4 gap-4">
                            {['left', 'front', 'right', 'back'].map(side => (
                                <FileUploadBox 
                                    key={side} 
                                    label={side.charAt(0).toUpperCase() + side.slice(1)} 
                                    file={cubeImages[side]} 
                                    onChange={(f) => handleCubeFileChange(side, f)} 
                                />
                            ))}
                        </div>

                        {/* Row 3: Bottom (center-left) */}
                        <div className="col-start-2 col-span-1">
                            <FileUploadBox 
                                label="Bottom" 
                                file={cubeImages['bottom']} 
                                onChange={(f) => handleCubeFileChange('bottom', f)} 
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* GUIDED UI */}
            {mode === 'guided' && (
                <div className="flex flex-col items-center gap-6 mb-10 w-full">
                    
                    {/* SUB-TABS for Guided Mode */}
                    <div className="flex w-full justify-center mb-8">
                        <div className="inline-flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
                            <button
                                type="button"
                                onClick={() => setGuidedMode('manual')}
                                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                                    guidedMode === 'manual' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                Manual Grid
                            </button>
                            <button
                                type="button"
                                onClick={() => setGuidedMode('auto')}
                                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                                    guidedMode === 'auto' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                Auto Drag & Drop
                            </button>
                        </div>
                    </div>

                    {/* MANUAL SUB-MODE */}
                    {guidedMode === 'manual' && (
                        <>
                            {guidedLayout.map((row, rowIndex) => (
                                <div key={rowIndex} className="flex gap-4 justify-center w-full">
                                    {row.map((position, colIndex) => {
                                        if (!position) return <div key={`spacer-${rowIndex}-${colIndex}`} className="w-24 h-24 md:w-32 md:h-32 hidden sm:block opacity-0" />; // Spacer
                                        
                                        return (
                                            <div key={position} className="w-24 md:w-32">
                                                <FileUploadBox 
                                                    label={position.replace('-', ' ').toUpperCase()} 
                                                    file={guidedImages[position]} 
                                                    onChange={(f) => handleGuidedFileChange(position, f)}
                                                    small
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                            <div className="text-center mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <p className="text-sm text-blue-800 font-medium">💡 Tip: Ensure ~30% overlap between adjacent photos.</p>
                            </div>
                        </>
                    )}

                    {/* AUTO SUB-MODE */}
                    {guidedMode === 'auto' && (
                       <div className="w-full">
                           <div className="border-2 border-dashed border-indigo-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer relative min-h-[320px] group">
                                <input 
                                    type="file" 
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => handleAutoFileChange(e.target.files)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <span className="text-4xl">📸</span>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                                     {autoFiles.length > 0 ? `${autoFiles.length} Photos Selected` : "Drop Photos Here"}
                                </h3>
                                <p className="text-gray-500 max-w-sm mb-8 text-base leading-relaxed">
                                    {autoFiles.length > 0 
                                        ? "Click specific photos to remove or add more." 
                                        : "Select 2 or more overlapping photos. We recommend 8-12 photos for a full circle."}
                                </p>
                                
                                {autoFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-3 justify-center max-w-3xl px-4 z-20 relative pointer-events-none">
                                        {autoFiles.map((f, i) => (
                                            <div key={i} className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium border border-gray-200 shadow-sm text-gray-700 flex items-center gap-2 animate-fade-in pointer-events-auto hover:border-red-200 group/tag">
                                                {f.name}
                                                <button 
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setAutoFiles(prev => prev.filter((_, idx) => idx !== i));
                                                    }}
                                                    className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {autoFiles.length === 0 && (
                                     <button type="button" className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-md shadow-indigo-200 pointer-events-none group-hover:bg-indigo-700 transition-colors">
                                        Select Files
                                     </button>
                                )}
                            </div>
                       </div>
                    )}
                </div>
            )}

            {/* Submit Bar */}
            <div className="flex justify-between items-center pt-8 border-t border-gray-100 mt-auto">
                <div className="flex-1 pr-4">
                 {status && (
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${status.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                        {status.includes('progress') && <span className="animate-spin">⏳</span>}
                        {status}
                    </span>
                 )}
                </div>
                
                <div className="flex gap-4">
                    {resultId && (
                        <Link 
                            href={`/view/local?img=${resultId}`}
                            className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-green-200 transition-all hover:-translate-y-0.5 flex items-center gap-2"
                        >
                            <span>👁️</span> View Result
                        </Link>
                    )}
                    <button 
                        type="submit" 
                        disabled={
                            mode === 'cubemap' ? !isCubeValid :
                            mode === 'guided' && guidedMode === 'manual' ? !isGuidedValid :
                            mode === 'guided' && guidedMode === 'auto' ? !isAutoValid : true
                        }
                        className={`
                            px-8 py-3 rounded-xl font-bold shadow-lg transition-all duration-200 flex items-center gap-2
                            ${(
                                (mode === 'cubemap' && isCubeValid) || 
                                (mode === 'guided' && guidedMode === 'manual' && isGuidedValid) ||
                                (mode === 'guided' && guidedMode === 'auto' && isAutoValid)
                            )
                                ? 'bg-gray-900 text-white hover:bg-black hover:shadow-xl hover:-translate-y-0.5' 
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'}
                        `}
                    >
                        {mode === 'cubemap' ? '✨ Stitch Cube' : '🚀 Stitch Now'}
                    </button>
                </div>
            </div>
        </form>
      </div>
    </div>
  );
}

// Subcomponent for cleaner code
function FileUploadBox({ label, file, onChange, small }: { label: string, file: File | null, onChange: (f: File | null) => void, small?: boolean }) {
    // Generate simple object URL for preview if file exists
    // Note: In production, manage URL.revokeObjectURL to avoid memory leaks
    
    // We can't unconditionally create the URL in render because it might re-render, 
    // but for this prototype, checking file existence is fine.
    // However, URL.createObjectURL is side-effecty.
    // Let's use it directly in the img src.
    
    return (
        <div className="flex flex-col group h-full relative">
            <div className={`
                relative rounded-xl transition-all duration-300 w-full aspect-square overflow-hidden
                ${file 
                  ? 'border border-gray-200 shadow-md' 
                  : 'border-2 border-dashed border-gray-300 bg-gray-100 hover:bg-white hover:border-gray-400 hover:shadow-sm'
                }
            `}>
                <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => {
                        if (e.target.files?.[0]) {
                            onChange(e.target.files[0]);
                        }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                
                {file ? (
                    <>
                        {/* We use URL.createObjectURL temporarily. 
                            React will warn about uniqueness if we were stricter, but it works for upload previews. */}
                        <img 
                            src={URL.createObjectURL(file)} 
                            alt={label} 
                            className="w-full h-full object-cover pointer-events-none" 
                        />
                        
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                            <span className="text-white text-xs font-bold px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30">Replace</span>
                        </div>
                        
                        <div className="absolute top-2 right-2 z-30 pointer-events-auto">
                             <button 
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    onChange(null); 
                                }}
                                className="bg-white/90 rounded-full p-1.5 text-gray-500 hover:text-red-600 hover:bg-white transition-all shadow-sm"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                            <p className="text-[10px] text-white/90 font-medium truncate px-1 text-center">{file.name}</p>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center h-full p-2 pointer-events-none">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</span>
                        <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-indigo-600 group-hover:border-indigo-100 group-hover:scale-110 transition-all">
                           <span className="text-2xl leading-none pb-1 font-light">+</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
