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
    <div className="min-h-screen bg-gray-50 text-black p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* --- LEFT COLUMN: INVENTORY --- */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">1. Build Inventory</h2>
          
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Current Items</h3>
            <div className="max-h-40 overflow-y-auto border rounded bg-gray-50 p-2 text-sm">
              {products.length === 0 ? (
                <p className="text-gray-400 italic">No products yet.</p>
              ) : (
                products.map(p => (
                  <div key={p.id} className="flex justify-between items-center py-2 border-b last:border-0 border-gray-200">
                    <div>
                        <span className="font-semibold">{p.title}</span>
                        <span className="ml-2 text-gray-500 text-xs bg-gray-200 px-2 py-0.5 rounded-full">{p.category}</span>
                    </div>
                    <button 
                        onClick={() => deleteProduct(p.id, p.title)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 border border-red-200 rounded hover:bg-red-50"
                    >
                        DELETE
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <form onSubmit={handleProductSubmit} className="space-y-3 bg-gray-50 p-4 rounded border">
            <h3 className="font-bold text-sm">Add New Item</h3>
            
            <input 
              type="text" 
              value={prodTitle}
              onChange={e => setProdTitle(e.target.value)}
              placeholder="Product Name (e.g. Ping Pong Table)"
              className="w-full p-2 border rounded text-sm"
            />
            
            <div className="flex gap-2">
              <input 
                type="number" 
                value={prodPrice}
                onChange={e => setProdPrice(e.target.value)}
                placeholder="Price ($)"
                className="w-1/2 p-2 border rounded text-sm"
              />
              <select 
                value={prodCategory}
                onChange={e => setProdCategory(e.target.value)}
                className="w-1/2 p-2 border rounded text-sm"
              >
                {AI_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-500">Select category matching the object shape!</p>

            <input 
              type="file" 
              accept="image/*"
              onChange={e => setProdFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />

            <button type="submit" className="w-full bg-green-600 text-white py-2 rounded font-bold text-sm hover:bg-green-700">
              + Add to Inventory
            </button>
            {prodStatus && <div className="text-xs font-mono">{prodStatus}</div>}
          </form>
        </div>

        {/* --- RIGHT COLUMN: SCENE UPLOAD --- */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">2. Upload Scene</h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload your 360 panorama. The AI will scan it for items listed in your inventory (on the left) and tag them automatically.
          </p>

          <form onSubmit={handleSceneUpload} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium text-sm">Scene Title</label>
              <input 
                type="text" 
                value={sceneTitle}
                onChange={e => setSceneTitle(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="e.g. Game Room"
              />
            </div>

            <div className="border-2 border-dashed border-gray-300 p-6 rounded-lg text-center bg-gray-50">
              <input 
                type="file" 
                accept=".jpg,.jpeg,.png"
                onChange={e => setSceneFile(e.target.files?.[0] || null)}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-2">Requires 2:1 Equirectangular Image</p>
            </div>

            <button 
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg transition-transform hover:scale-[1.02]"
            >
              🚀 Upload & Run AI
            </button>
          </form>

          {sceneStatus && (
            <div className={`mt-4 p-3 rounded text-sm border ${
              sceneStatus.includes('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              {sceneStatus}
            </div>
          )}

          {sceneId && (
            <div className="mt-6 text-center">
              <div className="text-4xl mb-2">{hotspotCount > 0 ? '🎉' : '✅'}</div>
              <h3 className="font-bold text-lg text-green-700">{hotspotCount > 0 ? 'Scan Complete!' : 'Upload Successful!'}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {hotspotCount > 0 ? `Found ${hotspotCount} matching items.` : 'No matching items found in inventory.'}
              </p>
              
              <Link 
                href={`/view/${sceneId}`} 
                className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700"
              >
                View 3D Experience &rarr;
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}