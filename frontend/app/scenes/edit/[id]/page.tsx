'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import SceneViewer from '@/components/viewer/SceneViewer';
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
        className="relative z-50 w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-xs font-medium text-gray-600 cursor-pointer flex justify-between items-center transition-all hover:bg-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{value || "Select a category"}</span>
        <span className="text-gray-400 text-xs">▼</span>
      </div>
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-full sm:w-80 bg-white border border-gray-200 rounded-xl flex shadow-2xl z-50 overflow-hidden max-h-[300px]">
          <ul className="w-1/2 border-r bg-white py-1 overflow-y-auto">
            {Object.keys(YOLO_CATEGORIES).map(main => (
              <li 
                key={main}
                className="px-3 py-1.5 hover:bg-gray-100 cursor-pointer flex justify-between font-bold text-[11px] transition-colors"
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
                    className={`px-3 py-1.5 hover:bg-indigo-50 text-indigo-700 cursor-pointer text-[11px] transition-colors ${value === sub ? 'bg-indigo-600 text-white hover:bg-indigo-700 font-bold' : ''}`}
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
              <div className="flex items-center justify-center p-3 h-full text-gray-400 text-[10px] italic text-center">
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
  externalLink?: string;
  mainImageUrl?: string;
}

export default function EditScenePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // --- Product State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [prodTitle, setProdTitle] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCategory, setProdCategory] = useState("chair");
  const [prodLink, setProdLink] = useState('');
  const [prodFile, setProdFile] = useState<File | null>(null);
  const [prodStatus, setProdStatus] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // --- Scene Upload State ---
  const [initialScene, setInitialScene] = useState<any>(null);
  const [sceneFile, setSceneFile] = useState<File | null>(null);
  const [sceneTitle, setSceneTitle] = useState('');
  const [sceneStatus, setSceneStatus] = useState('');
  const [modelType, setModelType] = useState('yolo');
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(true);

  // Selection for 3D View & Saving
  // type can be 'original', 'yolo', or 'dino'
  const [selectedPreview, setSelectedPreview] = useState<'original' | 'yolo' | 'dino'>('original');

  // Preview caches
  const [cachedResults, setCachedResults] = useState<{
    yolo: { imageUrl: string, hotspots: any[], serverImageUrl: string } | null, 
    dino: { imageUrl: string, hotspots: any[], serverImageUrl: string } | null,
    original: { imageUrl: string, hotspots: any[], serverImageUrl: string } | null
  }>({
    yolo: null, 
    dino: null,
    original: null
  });

  useEffect(() => {
    fetchProducts();
    fetchScene();
  }, [id]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(apiUrl(`/products?sceneId=${id}`), {
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

  const fetchScene = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/scenes/${id}`));
      if (res.ok) {
        const data = await res.json();
        setInitialScene(data);
        setSceneTitle(data.title || '');
        setModelType('yolo'); // Default scan selection to yolo
        
        const originalData = { 
          imageUrl: data.imageUrl.startsWith('http') ? data.imageUrl : apiUrl(`${data.imageUrl}`), 
          hotspots: data.hotspots || [],
          serverImageUrl: data.imageUrl
        };

        setCachedResults(prev => ({ 
          ...prev, 
          original: originalData
        }));
        setSelectedPreview('original');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  const startEditingProduct = (p: Product) => {
    setEditingProductId(p.id);
    setProdTitle(p.title);
    setProdPrice(p.price.toString());
    setProdCategory(p.category);
    setProdLink(p.externalLink || '');
    setProdFile(null);
    setProdStatus('');
  };

  const cancelEditProduct = () => {
    setEditingProductId(null);
    setProdTitle('');
    setProdPrice('');
    setProdCategory('chair');
    setProdLink('');
    setProdFile(null);
    setProdStatus('');
  };



  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodTitle) {
      setProdStatus('Error: Title is required.');
      return;
    }
    setProdStatus(editingProductId ? 'Saving Changes...' : 'Creating Product...');
    try {
      const url = editingProductId 
        ? apiUrl(`/products/${editingProductId}`) 
        : apiUrl('/products');
      const method = editingProductId ? 'PUT' : 'POST';
      
      const productRes = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-mock-user-id': localStorage.getItem('mockUserId') || '' },
        body: JSON.stringify({ sceneId: id, title: prodTitle, price: prodPrice ? parseFloat(prodPrice) : 0, category: prodCategory, externalLink: prodLink || undefined }),
      });
      if (!productRes.ok) throw new Error('Failed to save product');
      const product = await productRes.json();

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
      setProdStatus(`Success! ${editingProductId ? 'Saved' : 'Added'} "${product.title}".`);
      setProdTitle(''); setProdPrice(''); setProdLink(''); setProdFile(null); setEditingProductId(null);
      fetchProducts();
    } catch (err) {
      setProdStatus(`Error: ${String(err)}`);
    }
  };

  const deleteProduct = async (prodId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await fetch(apiUrl(`/products/${prodId}`), {
        method: 'DELETE',
        headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '' }
      });
      fetchProducts();
    } catch (e) {
      alert('Failed to delete');
    }
  };

  const handleSceneAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isScanning || (!sceneFile && !cachedResults.original)) return;
    setIsScanning(true);
    setSceneStatus(`Running ${modelType.toUpperCase()}... (This may take a moment)`);
    
    try {
        if (sceneFile) {
            const formData = new FormData();
            formData.append('file', sceneFile);
            formData.append('title', sceneTitle);
            formData.append('modelType', modelType);
            formData.append('sceneId', id);

            const res = await fetch(apiUrl('/scenes/analyze'), {
                method: 'POST',
                headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '' },
                body: formData,
            });
            const data = await res.json();
            if (res.ok) {
                setSceneStatus(`Success! ${modelType.toUpperCase()} found ${data.hotspots.length} items.`);
                const fullImageUrl = apiUrl(`${data.imageUrl}`);
                
                // When uploading a new file, we assign the result to the respective model
                setCachedResults(prev => ({ 
                  ...prev, 
                  [modelType]: { imageUrl: fullImageUrl, serverImageUrl: data.imageUrl, hotspots: data.hotspots } 
                }));
                setSelectedPreview(modelType as 'yolo' | 'dino');
            } else setSceneStatus(`Error: ${data.message || 'Analysis failed'}`);
        } else {
            // Using currently selected original image to rescan
            const serverImgUrl = cachedResults.original?.serverImageUrl;
            if (!serverImgUrl) throw new Error("No image to analyze");

            const res = await fetch(apiUrl('/scenes/analyze-existing'), {
                method: 'POST',
                headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '', 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: serverImgUrl, modelType: modelType, sceneId: id }),
            });
            const data = await res.json();
            if (res.ok) {
                setSceneStatus(`Success! ${modelType.toUpperCase()} found ${data.hotspots.length} items.`);
                setCachedResults(prev => ({ 
                  ...prev, 
                  [modelType]: { imageUrl: cachedResults.original!.imageUrl, serverImageUrl: serverImgUrl, hotspots: data.hotspots } 
                }));
                setSelectedPreview(modelType as 'yolo' | 'dino');
            } else setSceneStatus(`Error: ${data.message || 'Analysis failed'}`);
        }
    } catch (error) {
      setSceneStatus(`Network Error: ${String(error)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const saveChanges = async () => {
    const activeData = cachedResults[selectedPreview];
    if (!activeData?.serverImageUrl) return;

    setSceneStatus('Saving changes...');
    try {
      const res = await fetch(apiUrl(`/scenes/${id}`), {
        method: 'POST',
        headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: sceneTitle || 'Untitled', 
          imageUrl: activeData.serverImageUrl, 
          modelType: selectedPreview === 'original' ? initialScene.modelType : selectedPreview, 
          hotspots: activeData.hotspots 
        })
      });
      if (res.ok) {
        alert('Changes Saved Successfully!');
        fetchScene();
        setSceneStatus('Changes saved.');
        setSceneFile(null);
      } else {
        alert('Failed to save changes.');
        setSceneStatus('Error saving changes.');
      }
    } catch (e) {
      alert('Error saving.');
      setSceneStatus('Network error while saving.');
    }
  };

  const revertAll = () => {
    if (!initialScene) return;
    if (confirm('Are you sure you want to revert all unsaved changes? This cannot be undone.')) {
      setSceneTitle(initialScene.title);
      setSceneFile(null);
      setSceneStatus('Reverted to original state.');
      
      const originalData = { 
        imageUrl: initialScene.imageUrl.startsWith('http') ? initialScene.imageUrl : apiUrl(`${initialScene.imageUrl}`), 
        serverImageUrl: initialScene.imageUrl,
        hotspots: initialScene.hotspots || []
      };

      setCachedResults({ yolo: null, dino: null, original: originalData });
      setSelectedPreview('original');
    }
  };

  const renderMiniPreviewBox = (type: 'original' | 'yolo' | 'dino', title: string) => {
    const data = cachedResults[type];
    const isActive = selectedPreview === type;
    
    if (!data) {
      return (
        <div className="bg-white p-4 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-center h-full opacity-70">
           <span className="text-3xl mb-2 grayscale">🖼️</span>
           <p className="text-gray-500 font-medium text-[13px]">{title}</p>
           <p className="text-gray-400 text-[11px] mt-1 italic">Not reanalysed by {type.toUpperCase()} yet.</p>
        </div>
      );
    }

    return (
      <div 
        onDoubleClick={() => setIsModalOpen(true)}
        onClick={() => setSelectedPreview(type)}
        className={`relative cursor-pointer transition-all duration-200 rounded-xl overflow-hidden shadow-sm border-2 h-full ${isActive ? 'border-blue-500 shadow-md ring-2 ring-blue-100 scale-[1.02]' : 'border-gray-200 hover:border-gray-400'}`}
      >
         <div className="absolute top-2 left-2 z-10 bg-black/75 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">
           {title} {isActive && '✅'}
         </div>
         <div className="absolute top-2 right-2 z-10 bg-white/95 text-gray-800 text-[10px] px-2 py-1 rounded font-bold shadow-sm">
           {data.hotspots.length} items
         </div>
         <div className="w-full h-full bg-gray-900 relative">
            <img src={data.imageUrl ? apiUrl(data.imageUrl) : ''} alt={title} className="w-full h-full object-cover opacity-80" />
            {data.hotspots.map((hs, idx) => (
              <div key={idx} className="absolute w-2.5 h-2.5 bg-green-500 rounded-full border border-white shadow-sm transform -translate-x-1/2 -translate-y-1/2" style={{ left: `${(hs.yaw / 360) * 100}%`, top: `${((90 - hs.pitch) / 180) * 100}%`}} />
            ))}
         </div>
      </div>
    );
  };

  // Close modal on ESC key
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  if (loading || !cachedResults.original) return <div className="p-8 min-h-screen text-black flex items-center justify-center bg-gray-50"><div className="animate-pulse flex flex-col items-center gap-3"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div><div className="font-bold text-gray-500 tracking-widest text-sm">LOADING WORKSPACE...</div></div></div>;

  return (
    <div className="min-h-screen bg-[#e5e7eb] text-black font-sans p-4 md:p-6 flex flex-col items-center">
      <div className="max-w-[1800px] w-full flex flex-col xl:h-[calc(100vh-3rem)] gap-6">

        {/* MAIN LAYOUT WRAPPER */}
        <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0 w-full">
            
            {/* LEFT COLUMN: HEADER + INVENTORY (spanning full height) */}
            <div className="w-full xl:w-[28%] flex flex-col gap-6 h-full flex-shrink-0">
              
              {/* COMPACT HEADER */}
              <div className="flex flex-col gap-4 flex-shrink-0 bg-white p-4 rounded-[32px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black rounded-xl shadow-inner flex items-center justify-center text-white flex-shrink-0 hover:scale-105 transition-transform duration-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <h1 className="text-[16px] font-black text-gray-900 tracking-tight">Edit Panel</h1>
                    <p className="text-gray-500 text-[9px] font-bold mt-0.5 tracking-wide uppercase">Manage • Refine • Analyze</p>
                  </div>
                </div>
                <Link href="/scenes/edit" className="w-full py-2.5 rounded-xl text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:text-black hover:-translate-y-0.5 hover:shadow-sm transition-all flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Back to Home
                </Link>
              </div>

              {/* INVENTORY */}
              <div className="flex flex-col flex-1 bg-white rounded-[32px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300 overflow-hidden min-h-[500px]">
                <div className="flex border-b border-gray-100 p-4 items-center gap-3 bg-gray-50/50 rounded-t-[32px] flex-shrink-0">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  <h2 className="text-[13px] font-black text-gray-800 uppercase tracking-widest">Inventory</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4 relative">
                  <div className="flex-1 min-h-[100px] overflow-y-auto border border-gray-100 rounded-2xl bg-[#f8fafc] p-2 text-xs custom-scrollbar flex flex-col gap-1.5 shadow-inner">
                    {products.length === 0 ? <div className="text-center py-6 flex flex-col items-center justify-center opacity-50 h-full"><p className="italic font-medium">Store inventory is empty</p></div> : products.map(p => (
                      <div key={p.id} className="group flex justify-between items-center p-2 cursor-default bg-white rounded-xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                        <div className="w-10 h-10 rounded-lg overflow-hidden mr-2 flex-shrink-0 border border-gray-200 bg-gray-50 relative flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                          {p.mainImageUrl ? (
                            <img src={apiUrl(p.mainImageUrl)} alt={p.title} className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16h16M4 20h16M4 4h16v12H4z" /></svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pr-1">
                           <div className="font-bold text-gray-800 truncate mb-0.5 text-[11px] uppercase tracking-wide" title={p.title}>{p.title}</div>
                           <div className="flex items-center gap-1.5">
                             <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">{p.category}</span>
                             <span className="text-[10px] text-gray-500 font-bold">${p.price}</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                           <button onClick={() => startEditingProduct(p)} className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors" title="Edit">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                           </button>
                           <button onClick={() => deleteProduct(p.id, p.title)} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Delete">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <form onSubmit={handleProductSubmit} className="bg-white p-4 rounded-xl border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col gap-2.5 flex-shrink-0 hover:shadow-lg transition-shadow duration-300">
                    <div className="flex justify-between items-center">
                      <h3 className="font-black text-gray-800 text-[11px] uppercase tracking-widest flex items-center gap-1.5">
                        <span className="w-5 h-5 flex items-center justify-center rounded bg-gray-50 border border-gray-100 text-indigo-600">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editingProductId ? "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" : "M12 4v16m8-8H4"} /></svg>
                        </span>
                        {editingProductId ? "Edit Item" : "Create Item"}
                      </h3>
                      {editingProductId && (
                        <button type="button" onClick={cancelEditProduct} className="text-[9px] bg-white border border-gray-200 hover:bg-gray-100 text-gray-500 px-2 py-1 rounded-md font-bold uppercase transition-colors">Cancel</button>
                      )}
                    </div>
                    <div><input type="text" value={prodTitle} onChange={e => setProdTitle(e.target.value)} placeholder="Product Name" className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-xs text-black focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-medium transition-all"/></div>
                    <div className="grid grid-cols-2 gap-2">
                      <CategoryDropdown value={prodCategory} onChange={setProdCategory} />
                      <input type="number" value={prodPrice} onChange={e => setProdPrice(e.target.value)} placeholder="Price (Optional)" className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-xs text-black focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-medium transition-all"/>
                    </div>
                    <div><input type="url" value={prodLink} onChange={e => setProdLink(e.target.value)} placeholder="URL" className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-xs text-black focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-medium transition-all"/></div>
                    <div className="border border-dashed border-gray-300 rounded-lg p-1 hover:border-indigo-400 bg-gray-50/50 transition-colors"><input type="file" accept="image/*" onChange={e => setProdFile(e.target.files?.[0] || null)} className="w-full text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[9px] file:font-black file:bg-white file:border file:border-gray-200 file:text-gray-700 hover:file:bg-gray-100 file:transition-colors cursor-pointer uppercase"/></div>
                    <button type="submit" disabled={!!prodStatus && !prodStatus.includes('Error') && !prodStatus.includes('Success')} className="w-full bg-gray-900 border border-black text-white py-2 rounded-lg text-[11px] uppercase tracking-widest font-black hover:bg-indigo-600 hover:border-indigo-600 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 mt-1 shadow-sm">
                      {editingProductId ? 'Apply' : 'Save'}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE (Configuration + Finalization + Cards) */}
            <div className="w-full xl:w-[72%] flex flex-col gap-6 h-full min-h-0">
                
                {/* TOP HALF: Config & Project Space (Enlongated) */}
                <div className="flex flex-col md:flex-row gap-6 xl:h-[65%] flex-shrink-0">
                   
                   {/* Configuration */}
                   <div className="flex-1 flex flex-col h-full bg-white rounded-[32px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300 overflow-hidden">
                     <div className="flex border-b border-gray-100 p-5 items-center gap-3 bg-gray-50/50 rounded-t-[32px] flex-shrink-0">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <h2 className="text-[14px] font-black text-gray-800 uppercase tracking-widest">Configuration</h2>
                     </div>
                     <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                        <form onSubmit={handleSceneAnalyze} className="space-y-6 h-full flex flex-col justify-center max-w-lg mx-auto w-full">
                          <div>
                            <label className="flex items-center gap-2 text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                              Scene Meta Area
                            </label>
                            <input type="text" value={sceneTitle} onChange={e => setSceneTitle(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium text-black focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder-gray-400 shadow-inner" placeholder="e.g. Minimalist Living Space"/>
                          </div>
                          
                          <div className="flex-1 p-5 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 transition-all relative cursor-pointer group flex flex-col items-center justify-center min-h-[140px] shadow-inner">
                            <input type="file" accept=".jpg,.jpeg,.png" onChange={e => setSceneFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"/>
                            <div className="text-center pointer-events-none flex flex-col items-center">
                              <svg className={`w-10 h-10 mb-3 transition-colors ${sceneFile ? 'text-indigo-500' : 'text-gray-400 group-hover:text-indigo-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-[13px] font-black text-gray-700 uppercase tracking-widest">{sceneFile ? sceneFile.name : 'Update Base Background'}</span>
                              <span className="text-[11px] text-gray-400 mt-1 font-medium">Click or drag a panoramic .jpg, .png</span>
                            </div>
                          </div>

                          <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 shadow-inner flex flex-col gap-3">
                            <div>
                               <label className="flex items-center gap-2 text-[10px] font-black text-indigo-800 uppercase tracking-widest mb-2">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                  Intelligence Core
                               </label>
                               <select value={modelType} onChange={e => setModelType(e.target.value)} className="w-full px-3 py-2.5 border border-indigo-200 rounded-lg bg-white text-[12px] font-bold text-indigo-900 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer">
                                 <option value="yolo">Faster R-CNN / YOLO (Quick Scan)</option>
                                 <option value="dino">Grounding DINO (Deep Semantic)</option>
                               </select>
                            </div>
                            
                            <button type="submit" disabled={isScanning} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-[12px] uppercase tracking-widest hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md">
                              {isScanning ? (
                                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Injecting Data...</>
                              ) : (
                                 <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>{sceneFile ? 'Upload New Image & Scan' : 'Re-Analyze Current Map'}</>
                              )}
                            </button>
                          </div>
                        </form>
                        {sceneStatus && <div className="mt-4 text-[11px] font-bold text-center text-indigo-700 bg-indigo-50 p-2.5 rounded-lg border border-indigo-100 shadow-sm">{sceneStatus}</div>}
                     </div>
                   </div>

                   {/* Project Space / Finalization */}
                   <div className="w-full md:w-[45%] flex flex-col h-full bg-white rounded-[32px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300 overflow-hidden">
                     <div className="flex border-b border-gray-100 p-5 items-center gap-3 bg-gray-50/50 rounded-t-[32px] flex-shrink-0">
                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        <h2 className="text-[14px] font-black text-gray-800 uppercase tracking-widest">Project Space</h2>
                     </div>
                     <div className="flex-1 p-6 md:p-8 flex flex-col items-center justify-start pt-12 bg-[#f8fafc] custom-scrollbar overflow-y-auto">
                        <div className="w-full max-w-md bg-white p-6 md:p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 text-center flex flex-col items-center justify-start pt-10 gap-5 h-auto">
                          
                          <div className="flex flex-col items-center gap-3 w-full border-b border-gray-100 pb-5">
                             <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
                               <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                             </div>
                             <div className="flex flex-col items-center">
                               <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Active Setup</h3>
                               <div className="text-emerald-700 bg-emerald-50 px-5 py-2 rounded-xl border border-emerald-100 text-[15px] font-black uppercase tracking-wider">{selectedPreview}</div>
                             </div>
                          </div>
                          
                          <div className="flex flex-col w-full gap-3">
                            <div className="flex flex-row gap-3 w-full items-center justify-center">
                              <button onClick={saveChanges} className="flex-1 bg-emerald-500 text-white px-4 py-3.5 rounded-xl text-[12px] uppercase tracking-widest font-black hover:bg-emerald-600 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 shadow-md">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                                Save Draft
                              </button>
                              <button onClick={revertAll} className="px-4 py-3.5 bg-white text-rose-500 border border-red-100 rounded-xl hover:bg-rose-50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shadow-sm flex items-center justify-center gap-2 font-bold text-[11px] uppercase tracking-widest" title="Discard Changes">
                                Discard
                              </button>
                            </div>
                            
                            <div className="w-full bg-emerald-50/50 border border-emerald-100 rounded-lg p-2.5 flex flex-col items-center justify-center text-center shadow-inner">
                               <p className="flex items-center gap-1.5 text-[9px] text-emerald-700/80 font-bold uppercase tracking-wider leading-snug">
                                 <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                 The selected preview format below will be recorded as the active setup.
                               </p>
                            </div>
                          </div>

                        </div>
                     </div>
                   </div>
                </div>

                {/* BOTTOM HALF: The Image Cards (Decreased Height) */}
                <div className="xl:h-[35%] w-full bg-white rounded-[32px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300 overflow-hidden flex flex-col">
                  <div className="flex border-b border-gray-100 p-3 px-5 items-center justify-between bg-gray-50/50 rounded-t-[32px] flex-shrink-0">
                     <h2 className="text-[12px] font-black text-gray-800 uppercase tracking-widest flex items-center gap-1.5">
                       <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                       Analysis Previews
                     </h2>
                     <div className="text-[9px] text-indigo-700 font-bold uppercase tracking-wider px-2 py-1 bg-indigo-50 rounded border border-indigo-100 pointer-events-none">
                        Double tap to inspect
                     </div>
                  </div>
                  
                  <div className="flex-1 min-h-0 p-4 md:p-5 bg-[#f8fafc] overflow-x-auto overflow-y-hidden custom-scrollbar flex items-stretch">
                     <div className="flex flex-row gap-4 h-full w-full min-w-[700px]">
                        <div className="flex-1 w-1/3 min-w-[200px] h-full flex flex-col items-stretch">{renderMiniPreviewBox('original', 'Base Original')}</div>
                        <div className="flex-1 w-1/3 min-w-[200px] h-full flex flex-col items-stretch">{renderMiniPreviewBox('yolo', 'Quick Semantic (YOLO)')}</div>
                        <div className="flex-1 w-1/3 min-w-[200px] h-full flex flex-col items-stretch">{renderMiniPreviewBox('dino', 'Deep Precision (DINO)')}</div>
                     </div>
                  </div>
                </div>

            </div>

        </div>
      </div>

      {/* FULL SCREEN 3D MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-[#e5e7eb]/80 flex flex-col backdrop-blur-md transition-all duration-300 animate-in fade-in">
          <div className="absolute top-6 right-6 z-[110]">
            <button onClick={() => setIsModalOpen(false)} className="bg-white hover:bg-rose-50 text-rose-500 rounded-full w-12 h-12 flex items-center justify-center shadow-md border border-rose-100 transition-all hover:scale-105 group">
              <svg className="w-6 h-6 group-hover:text-rose-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[110] pointer-events-none">
             <div className="bg-white px-6 py-2.5 rounded-[32px] border border-gray-200 shadow-sm flex items-center gap-3">
               <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-gray-800 text-xs font-black uppercase tracking-[0.2em] pt-0.5">Immersive Preview mode</span>
             </div>
          </div>

          <div className="flex-1 w-full h-full p-6 md:p-12 flex items-center justify-center pointer-events-none pt-24">
            <div 
               className="w-full max-w-[95vw] h-full bg-white rounded-[32px] overflow-hidden shadow-xl relative border border-gray-100 pointer-events-auto group scale-in-center transition-transform duration-500 ease-out p-2 flex flex-col"
               onDoubleClick={() => setIsModalOpen(false)}
            >
               <div className="w-full h-full bg-gray-900 rounded-[24px] overflow-hidden relative">
                 {cachedResults[selectedPreview] && (
                   <SceneViewer imageUrl={cachedResults[selectedPreview]!.imageUrl} hotspots={cachedResults[selectedPreview]!.hotspots} height="100%" />
                 )}
               </div>
            </div>
          </div>
          
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[110] pointer-events-none px-6 py-2 bg-white rounded-full border border-gray-200 shadow-sm">
             <p className="text-gray-500 text-[10px] uppercase font-black tracking-[0.2em]">
               Double tap to collapse interface
             </p>
          </div>
        </div>
      )}
    </div>
  );
}
