'use client';

import { useState } from 'react';
import Link from 'next/link';

// Common YOLOv8 Categories (Indoor/Furniture)
const AI_CATEGORIES = [
  'chair', 'couch', 'potted plant', 'bed', 'dining table', 
  'toilet', 'tv', 'laptop', 'mouse', 'keyboard', 
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 
  'book', 'clock', 'vase', 'bench'
];

export default function AddProductPage() {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(AI_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price) {
      setStatus('Error: Please fill in required fields.');
      return;
    }

    setStatus('Creating Product...');

    try {
      // 1. Create Product
      const productRes = await fetch('http://localhost:3001/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          price: parseFloat(price),
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
        
        const imageRes = await fetch(`http://localhost:3001/products/${product.id}/image`, {
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
           <select 
             value={category}
             onChange={(e) => setCategory(e.target.value)}
             className="w-full p-2 border rounded bg-white"
           >
             {AI_CATEGORIES.map(cat => (
               <option key={cat} value={cat}>{cat}</option>
             ))}
           </select>
           <p className="text-xs text-gray-500 mt-1">This tells the AI what shape to look for.</p>
        </div>

        <div>
          <label className="block mb-1 font-medium">Price ($)</label>
          <input 
            type="number" 
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="299.99"
            required
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
