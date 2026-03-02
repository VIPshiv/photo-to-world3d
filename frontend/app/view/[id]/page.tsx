import SceneViewer from '@/components/viewer/SceneViewer';

// Next.js 16/15 types for params
type Props = {
  params: Promise<{ id: string }>;
};

async function getScene(id: string) {
  try {
    const res = await fetch(`http://localhost:3001/scenes/${id}`, { 
      cache: 'no-store' 
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    console.error(e);
    return null;
  }
}

export default async function ViewScenePage({ params }: Props) {
  const { id } = await params;
  const scene = await getScene(id);

  if (!scene) {
    return (
      <div className="flex h-screen items-center justify-center text-red-500">
        Scene ID &quot;{id}&quot; not found or Backend is offline.
      </div>
    );
  }

  // Construct full URL for the image
  const imageUrl = `http://localhost:3001${scene.imageUrl}`;
  console.log('Loading Scene:', imageUrl);

  return (
    <div className="relative w-full h-screen bg-black">
        {/* Navigation / Info Overlay */}
        <div className="absolute top-4 left-4 z-20">
            <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-100 max-w-sm transition-all hover:bg-white">
                <div className="flex justify-between items-start mb-2">
                    <h1 className="text-gray-900 font-bold text-lg truncate pr-4">{scene.title || 'Untitled Scene'}</h1>
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                        3D View
                    </span>
                </div>
                
                <div className="flex items-center text-sm text-gray-500 mb-4">
                    <div className="flex -space-x-1 mr-2">
                         {/* Simple visual indicator for hotspots */}
                         {[...Array(Math.min(3, scene.hotspots.length))].map((_,i) => (
                             <div key={i} className="w-4 h-4 rounded-full bg-gray-200 border border-white"></div>
                         ))}
                    </div>
                    <span>{scene.hotspots.length} Interactive Items</span>
                </div>

                <a 
                    href="/" 
                    className="block w-full text-center py-2 px-4 rounded-lg bg-gray-100 text-gray-700 font-medium text-xs hover:bg-gray-200 hover:text-black transition-colors"
                >
                    &larr; Exit to Home
                </a>
            </div>
        </div>

      <SceneViewer 
        imageUrl={imageUrl} 
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        hotspots={scene.hotspots.map((h: any) => ({
            id: h.id,
            yaw: h.yaw,
            pitch: h.pitch,
            label: h.product?.title || 'Unknown Item',
            product: h.product
        }))} 
      />
    </div>
  );
}
