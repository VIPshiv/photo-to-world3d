'use client';

import { useState } from 'react';
import Link from 'next/link';
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
        className="relative z-50 w-full p-2 border rounded bg-white cursor-pointer flex justify-between items-center"
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
                    className={`px-4 py-2 hover:bg-green-100 cursor-pointer text-sm transition-colors ${value === sub ? 'bg-green-500 text-white hover:bg-green-600 font-bold' : ''}`}
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
              <div className="flex items-center justify-center h-full p-4 text-gray-400 text-sm italic text-center">
                Hover a category<br/>to see items
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddProductPage() {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('chair');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      setStatus('Error: Please provide a Product Name.');
      return;
    }

    setStatus('Creating Product...');

    try {
      // 1. Create Product
      const productRes = await fetch(apiUrl('/products'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          price: price ? parseFloat(price) : 0,
          description,
          category,
        }),
      });

      if (!productRes.ok) throw new Error('Failed to create product');
      const product = await productRes.json();

      // 2. Upload Image (if selected)
      if (file) {
        setStatus('Uploading Image...');
        const formData = new FormData();
        formData.append('file', file);
        
        const imageRes = await fetch(apiUrl(`/products/${product.id}/image`), {
          method: 'POST',
          body: formData,
        });

        if (!imageRes.ok) throw new Error('Failed to upload image');
      }

      setStatus(`Success! Product "${product.title}" added to inventory.`);
      // Clear form
      setTitle('');
      setPrice('');
      setFile(null);
      setDescription('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setStatus(`Error: ${err.message}`);
      } else {
        setStatus('Error: An unknown error occurred');
      }
    }
  };

  return (
    <div className="p-8 max-w-xl mx-auto bg-white min-h-screen text-black">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Add Inventory Item</h1>
        <Link href="/upload" className="text-blue-600 underline text-sm">
          Back to Upload Scene
        </Link>
      </div>

      <div className="bg-yellow-50 p-4 rounded mb-6 text-sm border border-yellow-200">
        <strong>Tip:</strong> Select the category that best matches your item (e.g., use &quot;dining table&quot; for a Ping Pong Table) so the AI can find it.
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Product Name</label>
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="e.g. Pro Ping Pong Table"
            required
          />
        </div>

        <div>
           <label className="block mb-1 font-medium">AI Category (Detection Tag)</label>
           <CategoryDropdown value={category} onChange={setCategory} />
           <p className="text-xs text-gray-500 mt-1">This tells the AI what shape to look for.</p>
        </div>

        <div>
          <label className="block mb-1 font-medium">Price ($) - Optional</label>
          <input 
            type="number" 
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="299.99"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Product Image (Optional)</label>
          <input 
            type="file" 
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full p-2 border rounded"
          />
        </div>

        <button 
          type="submit"
          className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold"
        >
          Add to Inventory
        </button>
      </form>

      {status && (
        <div className={`mt-4 p-3 rounded ${status.includes('Success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {status}
        </div>
      )}
    </div>
  );
}
