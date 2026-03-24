'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

// Common YOLOv8 Categories (Indoor/Furniture)
const AI_CATEGORIES = [
  'chair', 'couch', 'potted plant', 'bed', 'dining table', 
  'toilet', 'tv', 'laptop', 'mouse', 'keyboard', 
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 
  'book', 'clock', 'vase', 'bench', 'suitcase', 'handbag',
  'tie', 'bottle', 'cup', 'spoon', 'bowl'
];

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
  const [prodCategory, setProdCategory] = useState(AI_CATEGORIES[0]);
  const [prodFile, setProdFile] = useState<File | null>(null);
  const [prodStatus, setProdStatus] = useState('');

  // --- Scene Upload State ---
  const [sceneFile, setSceneFile] = useState<File | null>(null);
  const [sceneTitle, setSceneTitle] = useState('');
  const [sceneStatus, setSceneStatus] = useState('');
  const [hotspotCount, setHotspotCount] = useState(0);
  const [sceneId, setSceneId] = useState<string | null>(null);

  // --- Fetch Products on Load ---
  const fetchProducts = async () => {
    try {
      const res = await fetch('http://localhost:3001/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error('Failed to fetch products', e);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // --- Handler: Add Product ---
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodTitle || !prodPrice) {
      setProdStatus('Error: Required fields missing.');
      return;
    }

    setProdStatus('Creating Product...');

    try {
      // 1. Create Product
      const productRes = await fetch('http://localhost:3001/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: prodTitle,
          price: parseFloat(prodPrice),
          category: prodCategory,
        }),
      });

      if (!productRes.ok) throw new Error('Failed to create product');
      const product = await productRes.json();

      // 2. Upload Image (if selected)
      if (prodFile) {
        setProdStatus('Uploading Image...');
        const formData = new FormData();
        formData.append('file', prodFile);
        
        await fetch(`http://localhost:3001/products/${product.id}/image`, {
          method: 'POST',
          body: formData,
        });
      }

      setProdStatus(`Success! Added "${product.title}".`);
      setProdTitle('');
      setProdPrice('');
      setProdFile(null);
      fetchProducts(); // Refresh list
    } catch (err) {
      setProdStatus(`Error: ${String(err)}`);
    }
  };

  // --- Handler: Upload Scene ---
  const handleSceneUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sceneFile) return;

    setSceneStatus('AI is Scanning... (This may take 10-20 seconds)');
    
    const formData = new FormData();
    formData.append('file', sceneFile);
    formData.append('title', sceneTitle);

    try {
      const res = await fetch('http://localhost:3001/scenes/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setSceneStatus(`Success! Found ${data.hotspotCount} items.`);
        setHotspotCount(data.hotspotCount);
        setSceneId(data.sceneId);
      } else {
        setSceneStatus(`Error: ${data.message || 'Upload failed'}`);
      }
    } catch (error) {
      setSceneStatus(`Network Error: ${String(error)}`);
    }
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await fetch(`http://localhost:3001/products/${id}`, { method: 'DELETE' });
      fetchProducts();
    } catch (e) {
      alert('Failed to delete');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-black font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Upload Scene</h1>
              <p className="text-gray-500 mt-1">Manage your inventory and create new 3D experiences.</p>
            </div>
            <Link href="/" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-black transition-colors">
                &larr; Back to Home
            </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* --- LEFT COLUMN: INVENTORY --- */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
               <span className="text-2xl">📦</span>
               <h2 className="text-xl font-bold text-gray-900">1. Build Inventory</h2>
            </div>
            
            <div className="mb-8">
              <div className="flex justify-between items-end mb-3">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Items</h3>
                 <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{products.length} items</span>
              </div>
              
              <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50/50 p-2 text-sm custom-scrollbar">
                {products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                     <span className="text-xl mb-1">📭</span>
                     <p>Inventory is empty</p>
                  </div>
                ) : (
                  products.map(p => (
                    <div key={p.id} className="group flex justify-between items-center p-3 mb-2 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all last:mb-0">
                      <div className="flex-1">
                          <div className="font-semibold text-gray-800">{p.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{p.category}</span>
                             {p.price > 0 && <span className="text-xs text-gray-500">₹{p.price}</span>}
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

            <form onSubmit={handleProductSubmit} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">＋</span>
                Add New Item
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Product Name</label>
                  <input 
                    type="text" 
                    value={prodTitle}
                    onChange={e => setProdTitle(e.target.value)}
                    placeholder="e.g. Leather Sofa"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Price (₹)</label>
                    <input 
                      type="number" 
                      value={prodPrice}
                      onChange={e => setProdPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                    <select 
                      value={prodCategory}
                      onChange={e => setProdCategory(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:ring-2 focus:ring-green-500 outline-none appearance-none"
                    >
                      {AI_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                   <label className="block text-xs font-medium text-gray-500 mb-1">Product Image (Optional)</label>
                   <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setProdFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
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
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 h-fit">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
               <span className="text-2xl">📸</span>
               <h2 className="text-xl font-bold text-gray-900">2. Upload Scene</h2>
            </div>
            
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Upload your 360° panorama. Our AI will scan the image and automatically tag any inventory items it recognizes.
            </p>

            <form onSubmit={handleSceneUpload} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Scene Title</label>
                <input 
                  type="text" 
                  value={sceneTitle}
                  onChange={e => setSceneTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-black bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                  placeholder="e.g. My Living Room"
                />
              </div>

              <div className="relative group">
                <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${sceneFile ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}>
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
                     <div className="text-sm font-medium text-gray-900">
                        {sceneFile ? sceneFile.name : 'Click to Upload Panorama'}
                     </div>
                     {!sceneFile && <div className="text-xs text-gray-500">Supports JPG, PNG (2:1 Ratio)</div>}
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={!sceneFile || sceneStatus.includes('Scanning')}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 rounded-xl font-bold hover:shadow-lg hover:shadow-blue-200 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
              >
                {sceneStatus.includes('Scanning') ? 'Processing...' : '🚀 Upload & Run AI Scan'}
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
                    
                    <Link 
                      href={`/view/${sceneId}`} 
                      className="inline-flex items-center justify-center gap-2 w-full bg-green-600 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 hover:-translate-y-0.5 transition-all"
                    >
                      View 3D Experience 
                      <span>&rarr;</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}