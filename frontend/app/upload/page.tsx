'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiUrl } from "@/lib/api";

// All 80 YOLOv8 Categories Grouped
const YOLO_CATEGORIES: Record<string, string[]> = {
  "Person": ["person"],
  "Vehicle": ["bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat"],
  "Outdoor": ["traffic light", "fire hydrant", "stop sign", "parking meter", "bench"],
  "Animal": ["bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"],
  "Accessory": ["backpack", "umbrella", "handbag", "tie", "suitcase"],
  "Sports": ["frisbee", "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket"],
  "Kitchen": ["bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl"],
  "Food": ["banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake"],
  "Furniture": ["chair", "couch", "potted plant", "bed", "dining table", "toilet"],
  "Electronic": ["tv", "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator"],
  "Indoor": ["book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"]
};

function CategoryDropdown({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredMain, setHoveredMain] = useState<string | null>(null);

  return (
    <div className="relative w-full text-black">
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setHoveredMain(null); }}></div>
      )}
      <div 
        className="relative z-50 w-full p-2 border border-gray-300 rounded bg-white cursor-pointer flex justify-between items-center h-10"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{value || "Select a category"}</span>
        <span className="text-gray-400 text-xs">▼</span>
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full sm:w-96 bg-white border border-gray-200 rounded-xl flex shadow-2xl z-50 overflow-hidden max-h-[300px]">
          <ul className="w-1/2 border-r bg-white py-1 overflow-y-auto">
            {Object.keys(YOLO_CATEGORIES).map(main => (
              <li 
                key={main}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between font-medium text-sm transition-colors"
                onMouseEnter={() => setHoveredMain(main)}
              >
                {main} <span className="text-gray-300">▶</span>
              </li>
            ))}
          </ul>
          <div className="w-1/2 bg-gray-50 py-1 overflow-y-auto">
            {hoveredMain ? (
              <ul>
                {YOLO_CATEGORIES[hoveredMain].map(sub => (
                  <li 
                    key={sub}
                    className={`px-4 py-2 hover:bg-indigo-50 text-indigo-700 cursor-pointer text-sm transition-colors ${value === sub ? 'bg-indigo-600 text-white hover:bg-indigo-700 font-bold' : ''}`}
                    onClick={() => {
                      onChange(sub);
                      setIsOpen(false);
                    }}
                  >
                    {sub}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center justify-center p-4 text-gray-400 h-full text-sm italic text-center">
                Hover a category<br/>to see items
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface Product {
  id: string;
  title: string;
  category: string;
  price: number;
}

export default function DashboardPage() {
  // --- Product State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [prodTitle, setProdTitle] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCategory, setProdCategory] = useState('chair');
  const [prodLink, setProdLink] = useState('');
  const [prodFile, setProdFile] = useState<File | null>(null);
  const [prodStatus, setProdStatus] = useState('');

  // --- Scene Upload State ---
  const [sceneFile, setSceneFile] = useState<File | null>(null);
  const [sceneTitle, setSceneTitle] = useState('');
  const [sceneStatus, setSceneStatus] = useState('');
  const [modelType, setModelType] = useState('yolo');
  const [isScanning, setIsScanning] = useState(false);
  
  // Preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [serverImageUrl, setServerImageUrl] = useState<string | null>(null);
  const [previewHotspots, setPreviewHotspots] = useState<any[]>([]);
  const [cachedResults, setCachedResults] = useState<{yolo: any[] | null, dino: any[] | null}>({yolo: null, dino: null});

  // Track which models we've currently drafted for this file
  const [draftedViews, setDraftedViews] = useState<{ [key: string]: string | null }>({});

  const [hotspotCount, setHotspotCount] = useState(0);
  const [sceneId, setSceneId] = useState<string | null>(null);

  // --- Fetch Products on Load ---
  const fetchProducts = async () => {
    try {
      const res = await fetch(apiUrl('/products'), {
        headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '' }
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error('Failed to fetch products', e);
    }
  };

  useEffect(() => {
    const draftId = sessionStorage.getItem('draftSceneId');
    if (draftId) {
      setSceneId(draftId);
      setHotspotCount(parseInt(sessionStorage.getItem('draftHotspotCount') || '0', 10));
      setSceneStatus('You have a draft scene waiting to be finalized.');
    }
    fetchProducts();

    // Check for auto-upload from stitch
    const urlParams = new URLSearchParams(window.location.search);
    const stitchImg = urlParams.get('img');
    if (stitchImg) {
      setSceneStatus("Loading stitched panorama...");
      fetch(apiUrl(stitchImg))
        .then(res => res.blob())
        .then(blob => {
          const fileName = stitchImg.split('/').pop() || 'panorama.jpg';
          const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
          setSceneFile(file);
          setSceneStatus("Panorama loaded! You can now analyze it.");
        })
        .catch(err => {
          console.error("Failed to load stitched image as File:", err);
          setSceneStatus("Error loading stitched panorama. Please upload manually.");
        });
    }
  }, []);

  // --- Handler: Add Product ---
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodTitle) {
      setProdStatus('Error: Title is required.');
      return;
    }

    setProdStatus('Creating Product...');

    try {
      // 1. Create Product
      const productRes = await fetch(apiUrl('/products'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-mock-user-id': localStorage.getItem('mockUserId') || ''
        },
        body: JSON.stringify({
          title: prodTitle,
          price: prodPrice ? parseFloat(prodPrice) : 0,
          category: prodCategory,
          externalLink: prodLink || undefined,
        }),
      });

      if (!productRes.ok) throw new Error('Failed to create product');
      const product = await productRes.json();

      // 2. Upload Image (if selected)
      if (prodFile) {
        setProdStatus('Uploading Image...');
        const formData = new FormData();
        formData.append('file', prodFile);
        
        await fetch(apiUrl(`/products/${product.id}/image`), {
          method: 'POST',
          headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '' },
          body: formData,
        });
      }

      setProdStatus(`Success! Added "${product.title}".`);
      setProdTitle('');
      setProdPrice('');
      setProdLink('');
      setProdFile(null);
      fetchProducts(); // Refresh list
    } catch (err) {
      setProdStatus(`Error: ${String(err)}`);
    }
  };

  // --- Handler: Upload Scene ---
  const handleSceneAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sceneFile || isScanning) return;

    setIsScanning(true);
    setSceneStatus(`Running ${modelType.toUpperCase()}... (This may take a moment)`);
    
    const formData = new FormData();
    formData.append('file', sceneFile);
    formData.append('title', sceneTitle);
    formData.append('modelType', modelType);

    try {
      const res = await fetch(apiUrl('/scenes/analyze'), {
        method: 'POST',
        headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '' },
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setSceneStatus(`Success! ${modelType.toUpperCase()} found ${data.hotspots.length} items.`);
        
        // Cache result and update preview immediately
        const newCache = { ...cachedResults, [modelType]: data.hotspots };
        setCachedResults(newCache);
        setServerImageUrl(data.imageUrl); // Store raw path for backend
        setPreviewImage(apiUrl(`${data.imageUrl}`));
        setPreviewHotspots(data.hotspots);

      } else {
        setSceneStatus(`Error: ${data.message || 'Analysis failed'}`);
      }
    } catch (error) {
      setSceneStatus(`Network Error: ${String(error)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleModelSwitch = async (type: 'yolo' | 'dino') => {
    if (isScanning) return;
    setModelType(type);
    if (cachedResults[type] !== null) {
      setPreviewHotspots(cachedResults[type] || []);
      setSceneStatus(`Switched to ${type.toUpperCase()} preview`);
    } else if (serverImageUrl) {
      // AI hasn't run for this yet, so we re-analyze the ALREADY uploaded image seamlessly.
      setSceneStatus(`Running ${type.toUpperCase()}... (This may take a moment)`);
      setIsScanning(true);
      try {
        const res = await fetch(apiUrl('/scenes/analyze-existing'), {
          method: 'POST',
          headers: { 
            'x-mock-user-id': localStorage.getItem('mockUserId') || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageUrl: serverImageUrl,
            modelType: type
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setSceneStatus(`Success! ${type.toUpperCase()} found ${data.hotspots.length} items.`);
          const newCache = { ...cachedResults, [type]: data.hotspots };
          setCachedResults(newCache);
          setPreviewHotspots(data.hotspots);
        } else {
          setSceneStatus(`Error: ${data.message || 'Analysis failed'}`);
        }
      } catch (error) {
        setSceneStatus(`Network Error: ${String(error)}`);
      } finally {
        setIsScanning(false);
      }
    } else {
      setSceneStatus(`Ready to scan with ${type.toUpperCase()}`);
    }
  };

  const saveScene = async (isDraft = false) => {
    if (!serverImageUrl) return;

    // Prevent direct finalize if this model was already saved as a draft
    if (!isDraft && draftedViews[modelType]) {
      alert("You have already saved this result as a Draft! Please go to the Edit page to finalize it, or undo your draft here if you want to Finalize directly.");
      return;
    }

    try {
      const res = await fetch(apiUrl('/scenes/save'), {
        method: 'POST',
        headers: { 
          'x-mock-user-id': localStorage.getItem('mockUserId') || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: sceneTitle || 'Untitled',
          imageUrl: serverImageUrl,
          modelType: modelType.toLowerCase(),
          hotspots: previewHotspots,
          status: isDraft ? 'DRAFT' : 'LIVE'
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (isDraft) {
          setDraftedViews({ ...draftedViews, [modelType]: data.sceneId });
          setSceneStatus(`Saved as Draft! You can switch models and draft another, or view drafts in Edit page.`);
          alert(`Successfully saved ${modelType.toUpperCase()} draft!`);
        } else {
          alert('Scene Finalized! It is now live.');
          window.location.href = `/scenes/view`;
        }
      } else {
        alert('Failed to save scene.');
      }
    } catch (e) {
      alert('Error saving.');
    }
  };

  const undoDraft = async () => {
    const draftId = draftedViews[modelType];
    if (!draftId) return;

    try {
      const res = await fetch(apiUrl(`/scenes/${draftId}`), { 
        method: 'DELETE',
        headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '' }
      });
      if (res.ok) {
        setDraftedViews({ ...draftedViews, [modelType]: null });
        setSceneStatus(`Draft reversed. You can now finalize directly or draft again.`);
      } else {
        alert('Failed to remove draft.');
      }
    } catch (e) {
      alert('Failed to remove draft.');
    }
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await fetch(apiUrl(`/products/${id}`), { 
        method: 'DELETE',
        headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '' }
      });
      fetchProducts();
    } catch (e) {
      alert('Failed to delete');
    }
  };

  const finalizeScene = async () => {
    if (!sceneId) return;
    try {
      const res = await fetch(apiUrl(`/scenes/${sceneId}/finalize`), {
        method: 'POST',
        headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '' }
      });
      if (res.ok) {
        sessionStorage.removeItem('draftSceneId');
        sessionStorage.removeItem('draftHotspotCount');
        alert('Scene Finalized successfully! It is now live.');
        window.location.href = `/scenes/view`;
      } else {
        alert('Failed to finalize scene.');
      }
    } catch (e) {
      alert('Error finalizing.');
    }
  };

  return (
    <div className="min-h-screen bg-[#e5e7eb] font-sans p-4 md:p-10 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300 mb-10 flex-shrink-0">
            <div>
              <h1 className="text-3xl font-black text-black tracking-tight">Upload Scene</h1>
              <p className="text-slate-500 font-medium text-sm mt-1">Manage your inventory and create new 3D experiences.</p>
            </div>
            <div className="flex gap-3">
              <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-black transition-all hover:-translate-y-0.5 shadow-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Home
              </Link>
            </div>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* --- LEFT COLUMN: INVENTORY --- */}
          <div className="bg-white/80 backdrop-blur-2xl p-10 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
               <span className="text-2xl">📦</span>
               <h2 className="text-xl font-bold text-black">1. Build Inventory</h2>
            </div>
            
            <div className="mb-8">
              <div className="flex justify-between items-end mb-3">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Items</h3>
                 <span className="text-xs bg-gray-100 text-slate-500 px-2 py-1 rounded-full">{products.length} items</span>
              </div>
              
              <div className="max-h-[350px] overflow-y-auto border border-slate-100/50 rounded-3xl bg-slate-50/50 p-3 text-sm custom-scrollbar">
                {products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white/40 border border-dashed border-slate-200 rounded-3xl text-slate-400 font-medium">
                     <span className="text-xl mb-1">📭</span>
                     <p>Inventory is empty</p>
                  </div>
                ) : (
                  products.map(p => (
                    <div key={p.id} className="group flex justify-between items-center p-4 mb-3 bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 last:mb-0">
                      <div className="flex-1">
                          <div className="font-bold text-slate-800">{p.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs font-medium text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-md">{p.category}</span>
                             {p.price > 0 && <span className="text-xs text-slate-400">₹{p.price}</span>}
                          </div>
                      </div>
                      <button 
                          onClick={() => deleteProduct(p.id, p.title)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg"
                          title="Delete Item"
                      >
                          🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <form onSubmit={handleProductSubmit} className="bg-white/50 backdrop-blur-lg p-6 rounded-2xl border border-white/60 hover:shadow-md transition-shadow">
              <h3 className="font-black tracking-tight text-xl text-black mb-5 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">＋</span>
                Add New Item
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Product Name</label>
                  <input 
                    type="text" 
                    value={prodTitle}
                    onChange={e => setProdTitle(e.target.value)}
                    placeholder="e.g. Leather Sofa"
                    className="w-full px-5 py-3 border border-slate-200 rounded-xl text-sm font-medium text-black bg-white/60 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                    <CategoryDropdown value={prodCategory} onChange={setProdCategory} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Price (₹) - Optional</label>
                    <input 
                      type="number" 
                      value={prodPrice}
                      onChange={e => setProdPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-5 py-3 border border-slate-200 rounded-xl text-sm font-medium text-black bg-white/60 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">External Link / Action URL</label>
                  <input
                    type="url"
                    value={prodLink}
                    onChange={e => setProdLink(e.target.value)}
                    placeholder="https://example.com/product/123"
                    className="w-full px-5 py-3 border border-slate-200 rounded-xl text-sm font-medium text-black bg-white/60 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div>
                   <label className="block text-xs font-medium text-slate-400 mb-1">Product Image (Optional)</label>
                   <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setProdFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={!!prodStatus && !prodStatus.includes('Error') && !prodStatus.includes('Success')}
                  className="w-full mt-2 bg-gray-900 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-black transition-colors shadow-lg shadow-gray-200 disabled:opacity-50"
                >
                  Add to Inventory
                </button>
                {prodStatus && (
                  <div className={`text-xs p-2 rounded ${prodStatus.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                    {prodStatus}
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* --- RIGHT COLUMN: SCENE UPLOAD --- */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 h-fit">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
               <span className="text-2xl">📸</span>
               <h2 className="text-xl font-bold text-black">2. Upload Scene</h2>
            </div>
            
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Upload your 360° panorama. Our AI will scan the image and automatically tag any inventory items it recognizes.
            </p>

            <form onSubmit={handleSceneAnalyze} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Scene Title</label>
                <input 
                  type="text" 
                  value={sceneTitle}
                  onChange={e => setSceneTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-black bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                  placeholder="e.g. My Living Room"
                />
              </div>

              <div className="relative group">
                <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${sceneFile ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'}`}>
                  <input 
                    type="file" 
                    accept=".jpg,.jpeg,.png"
                    onChange={e => setSceneFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-3 pointer-events-none">
                     <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-xl">
                        {sceneFile ? '📎' : '☁️'}
                     </div>
                     <div className="text-sm font-medium text-black">
                        {sceneFile ? sceneFile.name : (sceneId ? 'Using Draft Image. Click to change.' : 'Click to Upload Panorama')}
                     </div>
                     {!sceneFile && <div className="text-xs text-slate-400">Supports JPG, PNG (2:1 Ratio)</div>}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Select AI Model</label>
                <select 
                  value={modelType}
                  onChange={e => setModelType(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-black bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                >
                  <option value="yolo">🚀 Fast Scan (YOLO + CLIP)</option>
                  <option value="dino">🧠 Deep Text Search (Grounding DINO)</option>
                </select>
              </div>

              <button 
                type="submit"
                disabled={(!sceneFile && !sceneId) || sceneStatus.includes('Processing') || isScanning}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 rounded-xl font-bold hover:shadow-lg hover:shadow-blue-200 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
              >
                {sceneStatus.includes('Scanning') || isScanning ? 'Processing...' : '🚀 Upload & Run AI Scan'}
              </button>
            </form>

            {(sceneStatus || sceneId) && (
              <div className="mt-8 animate-fade-in">
                {sceneStatus && !sceneId && (
                   <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 ${
                    sceneStatus.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                   }`}>
                      {sceneStatus.includes('Scanning') && <span className="animate-spin">⏳</span>}
                      {sceneStatus}
                   </div>
                )}

                {sceneId && (
                  <div className="bg-green-50 border border-green-100 rounded-2xl p-6 text-center">
                    <div className="text-5xl mb-3">🎉</div>
                    <h3 className="font-bold text-lg text-green-800 mb-1">Scan Complete!</h3>
                    <p className="text-green-700 text-sm mb-6">
                      {hotspotCount > 0 ? `Found ${hotspotCount} matching inventory items.` : 'No matching items found.'}
                    </p>
                    
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => {
                          setSceneId(null);
                          setSceneStatus('');
                          setHotspotCount(0);
                          setSceneFile(null);
                          sessionStorage.removeItem('draftSceneId');
                          sessionStorage.removeItem('draftHotspotCount');
                        }}
                        className="text-sm text-slate-400 underline mb-2 hover:text-slate-700"
                      >
                         Cancel & Upload A Different Scene
                      </button>
                      <Link 
                        href={`/view/${sceneId}`} 
                        className="inline-flex items-center justify-center gap-2 w-full bg-white text-green-700 border-2 border-green-200 px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-green-50 transition-all"
                      >
                        Preview Draft 3D Experience
                      </Link>
                      <button 
                        onClick={finalizeScene}
                        className="inline-flex items-center justify-center gap-2 w-full bg-green-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 hover:-translate-y-0.5 transition-all"
                      >
                        Finalize Scene (Make Live) &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* NEW AI PREVIEW UI */}
            {previewImage && (
              <div className="mt-8 animate-fade-in bg-slate-50/50 border border-slate-100 rounded-2xl p-6 text-center shadow-inner">
                <h3 className="font-bold text-lg text-slate-800 mb-4">Preview AI Results</h3>
                
                {/* Model Toggle Buttons */}
                <div className="flex justify-center gap-4 mb-6">
                  <button 
                    type="button"
                    disabled={isScanning}
                    onClick={() => handleModelSwitch('yolo')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50 ${modelType === 'yolo' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-gray-100'}`}
                  >
                    Show YOLO Fast Scan
                  </button>
                  <button 
                    type="button"
                    disabled={isScanning}
                    onClick={() => handleModelSwitch('dino')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50 ${modelType === 'dino' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-gray-100'}`}
                  >
                    Show Grounding DINO
                  </button>
                </div>

                {/* Image Preview with overlay markers */}
                <div className="relative w-full aspect-[2/1] bg-black rounded-lg overflow-hidden border border-slate-200 mb-6">
                  <img src={previewImage} alt="Scene Preview" className="w-full h-full object-cover opacity-80" />
                  {previewHotspots && previewHotspots.map((hs, idx) => (
                    <div 
                      key={idx} 
                      className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${(hs.yaw / 360) * 100}%`,
                        top: `${((90 - hs.pitch) / 180) * 100}%`
                      }}
                    >
                        <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded shadow pointer-events-none whitespace-nowrap z-10">
                          {hs.label}
                        </div>
                    </div>
                  ))}
                </div>

                <p className="text-slate-500 text-sm mb-6">
                  Showing <strong>{previewHotspots ? previewHotspots.length : 0}</strong> items detected by {modelType.toUpperCase()}.
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      sessionStorage.setItem('previewHotspots', JSON.stringify(previewHotspots));
                      window.open(`/view/local?img=${serverImageUrl}`, '_blank');
                    }}
                    className="w-full bg-indigo-50/50 text-indigo-700 py-3 rounded-xl font-bold hover:bg-indigo-100 shadow-sm border border-indigo-100 transition-all flex items-center justify-center gap-2"
                  >
                    👁️ Test in 3D Viewer Before Saving
                  </button>

                  {draftedViews[modelType] ? (
                    <button
                      onClick={undoDraft}
                      disabled={isScanning}
                      className="w-full bg-gray-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-gray-300 shadow-sm transition-all"
                    >
                      ⏪ Saved as Draft! (Undo)
                    </button>
                  ) : (
                    <button
                      onClick={() => saveScene(true)}
                      disabled={isScanning}
                      className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200 transition-all border border-indigo-700"
                    >
                      📝 Save '{modelType.toUpperCase()}' as Draft
                    </button>
                  )}

                  <button
                    onClick={() => saveScene(false)}
                    disabled={isScanning || !!draftedViews[modelType]}
                    className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg hover:shadow-green-200 transition-all disabled:opacity-50"
                  >
                    ✅ Finalize & Save Scene ({modelType.toUpperCase()})
                  </button>
                  <button
                    onClick={() => {
                      setPreviewImage(null);
                      setServerImageUrl(null);
                      setPreviewHotspots([]);
                    setCachedResults({yolo: null, dino: null});                    setDraftedViews({});                      setSceneStatus('');
                      setSceneFile(null);
                    }}
                    className="text-sm text-slate-400 underline mt-2 hover:text-slate-700"
                  >
                      Discard & Start Over
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}