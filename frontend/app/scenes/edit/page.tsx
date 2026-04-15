"use client";

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function EditPageContent() {
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

  useEffect(() => {
    if (highlightId && !loading) {
      setActiveHighlight(highlightId);
      setTimeout(() => {
        const el = document.getElementById(highlightId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      // Remove highlight after 2 seconds
      const timer = setTimeout(() => {
        setActiveHighlight(null);
      }, 2000);

      // Remove query param to prevent highlighting on refresh
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('highlight');
        window.history.replaceState({}, '', url.pathname + url.search);
      }

      return () => clearTimeout(timer);
    }
  }, [highlightId, loading]);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'PUBLISH_CONFLICT' | 'REVERT_CONFLICT' | null;
    targetScene: any;
    relatedScene: any;
  }>({ isOpen: false, type: null, targetScene: null, relatedScene: null });

  useEffect(() => {
    fetchScenes();
  }, []);

  const fetchScenes = async () => {
    try {
      const res = await fetch('http://localhost:3001/scenes/store/my-scenes', {
        headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '' }
      });
      if (res.ok) {
        const data = await res.json();
        setScenes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}"?`)) return;
    
    try {
      const res = await fetch(`http://localhost:3001/scenes/${id}`, {
        method: 'DELETE',
        headers: { 'x-mock-user-id': localStorage.getItem('mockUserId') || '' }
      });
      
      if (res.ok) {
        setScenes(scenes.filter(s => s.id !== id));
      } else {
        alert('Failed to delete scene.');
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting scene');
    }
  };

  const processPublish = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3001/scenes/${id}/status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-mock-user-id': localStorage.getItem('mockUserId') || '' 
        },
        body: JSON.stringify({ status: 'LIVE' })
      });
      if (res.ok) {
        setScenes(scenes.map(s => s.id === id ? { ...s, status: 'LIVE' } : s));
      }
    } catch(e) {
      alert('Error publishing scene');
    }
  };

  const processUnpublish = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3001/scenes/${id}/status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-mock-user-id': localStorage.getItem('mockUserId') || '' 
        },
        body: JSON.stringify({ status: 'DRAFT' })
      });
      if (res.ok) {
        setScenes(scenes.map(s => s.id === id ? { ...s, status: 'DRAFT' } : s));
      }
    } catch(e) {
      alert('Error unpublishing scene');
    }
  };

  const processPublishOverwrite = async (liveId: string, draftId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:3001/scenes/${liveId}/replace-with-draft`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-mock-user-id': localStorage.getItem('mockUserId') || '' 
        },
        body: JSON.stringify({ draftId })
      });
      if (res.ok) {
        await fetchScenes();
      }
    } catch(e) {
      alert('Error updating scene');
    } finally {
      setLoading(false);
    }
  };

  const createDraftCopy = async (scene: any) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:3001/scenes/save`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-mock-user-id': localStorage.getItem('mockUserId') || '' 
        },
        body: JSON.stringify({ 
          title: scene.title, 
          imageUrl: scene.imageUrl,
          modelType: scene.modelType || 'yolo',
          hotspots: scene.hotspots.map((h: any) => ({
            productId: h.productId,
            yaw: h.yaw,
            pitch: h.pitch,
            label: h.label,
            type: h.type
          })), 
          status: 'DRAFT' 
        })
      });
      if (res.ok) {
        await fetchScenes();
      }
    } catch(e) {
      alert('Error creating copy');
    } finally {
      setLoading(false);
    }
  };

  const createAlternateScan = async (scene: any, targetModelType: string = 'dino') => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:3001/scenes/analyze-existing`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-mock-user-id': localStorage.getItem('mockUserId') || '' 
        },
        body: JSON.stringify({ 
          imageUrl: scene.imageUrl, 
          modelType: targetModelType 
        })
      });
      if (res.ok) {
        const data = await res.json();
        const saveRes = await fetch(`http://localhost:3001/scenes/save`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-mock-user-id': localStorage.getItem('mockUserId') || '' 
          },
          body: JSON.stringify({ 
            title: scene.title, 
            imageUrl: data.imageUrl,
            modelType: targetModelType,
            hotspots: data.hotspots, 
            status: 'DRAFT' 
          })
        });
        if (saveRes.ok) {
          await fetchScenes();
        }
      }
    } catch(e) {
      alert('Error scanning');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishClick = (scene: any) => {
    const conflict = scenes.find((s) => s.imageUrl === scene.imageUrl && s.status === 'LIVE' && s.id !== scene.id);
    if (conflict) {
      setModalConfig({ isOpen: true, type: 'PUBLISH_CONFLICT', targetScene: scene, relatedScene: conflict });
    } else {
      processPublish(scene.id);
    }
  };

  const handleUnpublishClick = (scene: any) => {
    const conflict = scenes.find((s) => s.imageUrl === scene.imageUrl && s.status === 'DRAFT' && s.id !== scene.id);
    if (conflict) {
      setModalConfig({ isOpen: true, type: 'REVERT_CONFLICT', targetScene: scene, relatedScene: conflict });
    } else {
      processUnpublish(scene.id);
    }
  };

  const groupedScenes = scenes.reduce((acc: Record<string, { lives: any[], drafts: any[] }>, scene) => {
    if (!acc[scene.imageUrl]) {
      acc[scene.imageUrl] = { lives: [], drafts: [] };
    }
    if (scene.status === 'LIVE') acc[scene.imageUrl].lives.push(scene);
    if (scene.status === 'DRAFT') acc[scene.imageUrl].drafts.push(scene);
    return acc;
  }, {});

  const groupedList = Object.entries(groupedScenes).map(([imageUrl, group]) => ({
    imageUrl,
    lives: (group as any).lives,
    drafts: (group as any).drafts,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Manage Scenes</h1>
            <p className="text-gray-500 mt-1">Review drafts, manage active 3D scenes, and update hotspots.</p>
          </div>
          <Link href="/" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            &larr; Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="text-center p-12 text-gray-500">Loading scenes...</div>
        ) : groupedList.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
            No scenes found.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groupedList.map(({ imageUrl, lives, drafts }: any) => {
              const key = imageUrl;
              const refScene = (lives && lives.length > 0 ? lives[0] : null) || (drafts && drafts.length > 0 ? drafts[0] : null);
                const allScenes = [...(lives || []), ...(drafts || [])];
                const yScenes = allScenes.filter((s: any) => (s.modelType || 'yolo').toLowerCase() === 'yolo');
                const dScenes = allScenes.filter((s: any) => (s.modelType || '').toLowerCase() === 'dino');
                
                const canMakeYCopy = yScenes.length >= 1 && yScenes.length < 2;
                const canMakeDCopy = dScenes.length >= 1 && dScenes.length < 2;
                const canMakeDAlt = dScenes.length === 0;
                const canMakeYAlt = yScenes.length === 0;
              return (
                <div key={key} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Live Scene Slot (Left) */}
                    <div className="flex-1 w-full lg:w-1/2 border rounded-lg p-4 bg-gray-50 flex flex-col gap-4">
                      <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide border-b pb-2">Live Versions</h4>
                      {(lives && lives.length > 0) ? (
                        <div className="flex flex-col gap-6">
                           {lives.map((liveScene: any) => (
                               <div id={liveScene.id} key={liveScene.id} className={`flex flex-col h-full justify-between pb-4 border-b border-gray-200 last:border-b-0 last:pb-0 transition-colors duration-1000 ${activeHighlight === liveScene.id ? 'animate-pulse bg-gray-300 rounded-lg' : ''}`}>
                               <div className="flex items-center gap-4 mb-4">        
                                 <div className="w-24 h-16 bg-gray-200 rounded-lg overflow-hidden relative shadow-sm shrink-0">
                                   {/* eslint-disable-next-line @next/next/no-img-element */}
                                   <img
                                     src={`http://localhost:3001${liveScene.imageUrl}`}
                                     alt={liveScene.title}
                                     className="w-full h-full object-cover"
                                   />
                                 </div>
                                 <div className="overflow-hidden">
                                   <h3 className="font-bold text-gray-900 truncate">{liveScene.title}</h3>
                                   <div className="flex items-center gap-2 mt-1">    
                                     <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">LIVE</span>
                                     {liveScene.modelType && (
                                       <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700" title={`Model: ${liveScene.modelType}`}>
                                         {liveScene.modelType.toLowerCase() === 'dino' ? 'D' : 'Y'}
                                       </span>
                                     )}
                                     <span className="text-xs text-gray-500">{liveScene.hotspots?.length || 0} objects</span>
                                   </div>
                                   <div className="mt-2 flex items-center gap-2 text-xs">
                                     <code className="bg-gray-100 text-gray-600 px-2 py-1 rounded truncate max-w-[150px] inline-block select-all" title={`${window.location?.origin}/view/${liveScene.id}`}>
                                       /view/{liveScene.id}
                                     </code>
                                     <button 
                                       onClick={() => navigator.clipboard.writeText(`${window.location?.origin}/view/${liveScene.id}`)}
                                       className="text-gray-400 hover:text-indigo-600 transition shrink-0"
                                       title="Copy Public URL"
                                     >
                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                     </button>
                                     <span title="copy url and paste on you web code" className="text-gray-400 cursor-help flex items-center justify-center w-4 h-4 rounded-full border border-gray-400 text-[10px] font-bold">
                                       i
                                     </span>
                                   </div>
                                 </div>
                               </div>
                               
                               <div className="flex gap-2 flex-wrap">
                                 <Link
                                   href={`/view/${liveScene.id}`}
                                   className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"  
                                 >
                                   View 3D
                                 </Link>
                                 <button
                                   onClick={() => handleUnpublishClick(liveScene)}   
                                   className="px-3 py-1.5 text-sm font-medium bg-orange-50 border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-100 transition"
                                 >
                                   Revert to Draft
                                 </button>
                                 <button
                                   onClick={() => handleDiscard(liveScene.id, liveScene.title)}
                                   className="px-3 py-1.5 text-sm font-medium bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition ml-auto"
                                 >
                                   Discard
                                 </button>
                               </div>
                             </div>
                           ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-24 text-gray-400 italic text-sm">
                          No LIVE versions for this image
                        </div>
                      )}
                    </div>

                    {/* Draft Scene Slot (Right) */}
                    <div className="flex-1 w-full lg:w-1/2 border rounded-lg p-4 bg-gray-50 flex flex-col gap-4">
                      <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide border-b pb-2">Draft Versions</h4>
                      {(drafts && drafts.length > 0) ? (
                        <div className="flex flex-col gap-6">
                          {drafts.map((draftScene: any) => (
                                <div id={draftScene.id} key={draftScene.id} className={`flex flex-col h-full justify-between pb-4 border-b border-gray-200 last:border-b-0 last:pb-0 transition-colors duration-1000 ${activeHighlight === draftScene.id ? 'animate-pulse bg-gray-300 rounded-lg' : ''}`}>
                              <div className="flex items-center gap-4 mb-4">        
                                <div className="w-24 h-16 bg-gray-200 rounded-lg overflow-hidden relative shadow-sm shrink-0">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`http://localhost:3001${draftScene.imageUrl}`}
                                    alt={draftScene.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="overflow-hidden">
                                  <h3 className="font-bold text-gray-900 truncate">{draftScene.title}</h3>
                                  <div className="flex items-center gap-2 mt-1">    
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">DRAFT</span>
                                    {draftScene.modelType && (
                                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700" title={`Model: ${draftScene.modelType}`}>
                                        {draftScene.modelType.toLowerCase() === 'dino' ? 'D' : 'Y'}
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-500">{draftScene.hotspots?.length || 0} objects</span>
                                  </div>
                                  <div className="mt-2 flex items-center gap-2 text-xs">
                                    <code className="bg-gray-100 text-gray-600 px-2 py-1 rounded truncate max-w-[150px] inline-block select-all" title={`${window.location?.origin}/view/${draftScene.id}`}>
                                      /view/{draftScene.id}
                                    </code>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(`${window.location?.origin}/view/${draftScene.id}`)}
                                      className="text-gray-400 hover:text-indigo-600 transition shrink-0"
                                      title="Copy Public URL"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="{2}" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    </button>
                                    <span title="copy url and paste on you web code" className="text-gray-400 flex items-center justify-center w-4 h-4 rounded-full border border-gray-400 text-[10px] font-bold cursor-help">
                                      i
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex gap-2 flex-wrap">
                                <Link
                                  href={`/view/${draftScene.id}`}
                                  className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"  
                                >
                                  Preview 3D
                                </Link>
                                <button
                                  onClick={() => handlePublishClick(draftScene)}    
                                  className="px-3 py-1.5 text-sm font-bold bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-sm transition"
                                >
                                  Publish to Live
                                </button>
                                <button
                                  onClick={() => handleDiscard(draftScene.id, draftScene.title)}
                                  className="px-3 py-1.5 text-sm font-medium bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition ml-auto"
                                >
                                  Discard
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-sm">
                          <p className="text-gray-400 italic mb-2">No active drafts found.</p>
                        </div>
                      )}

                      {/* Display available creation options dynamically */}
                      {(canMakeYCopy || canMakeDCopy || canMakeDAlt || canMakeYAlt) && (
                        <div className={(drafts && drafts.length > 0) ? "mt-4 pt-4 border-t border-gray-200" : "flex flex-col items-center mt-2 w-full max-w-[250px] mx-auto"}>
                          <h5 className={(drafts && drafts.length > 0) ? "text-xs font-bold text-gray-500 uppercase mb-3" : "hidden"}>Create Options</h5>
                          <div className={(drafts && drafts.length > 0) ? "flex flex-col gap-2 w-full max-w-[250px]" : "flex flex-col gap-2 w-full"}>
                            {canMakeYCopy && yScenes[0] && (
                              <button
                                onClick={() => createDraftCopy(yScenes[0])}        
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition shadow-sm font-medium w-full"
                              >
                                + Make Copy (Y)
                              </button>
                            )}
                            {canMakeDCopy && dScenes[0] && (
                              <button
                                onClick={() => createDraftCopy(dScenes[0])}        
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition shadow-sm font-medium w-full"
                              >
                                + Make Copy (D)
                              </button>
                            )}
                            {canMakeDAlt && yScenes[0] && (
                              <button
                                onClick={() => createAlternateScan(yScenes[0], 'dino')}    
                                className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 transition shadow-sm font-medium w-full"
                              >
                                + New Alt Scan (D)
                              </button>
                            )}
                            {canMakeYAlt && dScenes[0] && (
                              <button
                                onClick={() => createAlternateScan(dScenes[0], 'yolo')}    
                                className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 transition shadow-sm font-medium w-full"
                              >
                                + New Alt Scan (Y)
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

          {/* Modal for Warnings/Conflicts */}
        {modalConfig.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
              {modalConfig.type === 'PUBLISH_CONFLICT' && (
                <>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Wait! Similar Scene is already LIVE</h3>
                  <p className="text-gray-600 mb-4 text-sm">
                    You are about to publish <strong>{modalConfig.targetScene?.title}</strong>, but another version of this exact imagery 
                    (<strong>{modalConfig.relatedScene?.title}</strong>) is already mapped and live on your site.
                  </p>
                  <div className="mb-6 p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
                    <strong>Note:</strong> Replacing this scene will generate a new public URL:<br/>
                    <code className="bg-yellow-100 mt-2 block px-2 py-1 rounded font-mono select-all">/view/{modalConfig.targetScene?.id}</code><br/>
                    Remember to update any connects, embeds, or links that currently point to the old version.
                  </div>
                  <div className="flex flex-col gap-3">
                    <Link 
                      href={`/view/${modalConfig.relatedScene?.id}`} 
                      className="w-full justify-center flex items-center bg-indigo-50 text-indigo-700 font-bold py-3 rounded-lg hover:bg-indigo-100 border border-indigo-200"
                    >
                      Check out the LIVE version first
                    </Link>
                    <button 
                      onClick={() => {
                        processPublishOverwrite(modalConfig.relatedScene?.id, modalConfig.targetScene?.id);
                        setModalConfig({ ...modalConfig, isOpen: false });      
                      }}
                      className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 shadow-sm"
                    >
                      Replace LIVE Content (Keep Original URL)
                    </button>
                    <button
                      onClick={() => {
                        processUnpublish(modalConfig.relatedScene?.id); // Demote old one
                        processPublish(modalConfig.targetScene?.id); // Promote new one
                        setModalConfig({ ...modalConfig, isOpen: false });      
                      }}
                      className="w-full bg-green-500 text-white font-bold py-3 rounded-lg hover:bg-green-600 shadow-sm"
                    >
                      Swap them (Publish New URL, Draft Original)
                    </button>
                    <button 
                      onClick={() => {
                        processPublish(modalConfig.targetScene?.id);
                        setModalConfig({ ...modalConfig, isOpen: false });
                      }} 
                      className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200 shadow-sm"
                    >
                      Publish Anyway (Keep both LIVE)
                    </button>
                    <button 
                      onClick={() => setModalConfig({ ...modalConfig, isOpen: false })} 
                      className="mt-2 text-sm text-gray-500 hover:text-black font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {modalConfig.type === 'REVERT_CONFLICT' && (
                <>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Reverting {modalConfig.targetScene?.title}?</h3>
                  <p className="text-gray-600 mb-4 text-sm">
                    You are reverting the specific version you had LIVE. However, you also have 
                    an alternate draft (<strong>{modalConfig.relatedScene?.title}</strong>) built from the exact same image.
                  </p>
                  <div className="mb-6 p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
                    <strong>Note:</strong> If you make the alternate Draft LIVE, your new public URL will be:<br/>
                    <code className="bg-yellow-100 mt-2 block px-2 py-1 rounded font-mono select-all">/view/{modalConfig.relatedScene?.id}</code><br/>
                    You will need to manually change the URL in your website wherever the scene is embedded.
                  </div>
                  <div className="flex flex-col gap-3">
                    <Link 
                      href={`/view/${modalConfig.relatedScene?.id}`} 
                      className="w-full justify-center flex items-center bg-indigo-50 text-indigo-700 font-bold py-3 rounded-lg hover:bg-indigo-100 border border-indigo-200"
                    >
                      Check out the AI alternate Draft
                    </Link>
                    <button 
                      onClick={() => { 
                        processUnpublish(modalConfig.targetScene?.id);
                        processPublish(modalConfig.relatedScene?.id);
                        setModalConfig({ ...modalConfig, isOpen: false });
                      }} 
                      className="w-full bg-green-500 text-white font-bold py-3 rounded-lg hover:bg-green-600 shadow-sm"
                    >
                      Revert this, and make the alternate Draft LIVE
                    </button>
                    <button 
                      onClick={() => { 
                        processUnpublish(modalConfig.targetScene?.id); 
                        setModalConfig({ ...modalConfig, isOpen: false });
                      }} 
                      className="w-full bg-orange-500 text-white font-bold py-3 rounded-lg hover:bg-orange-600"
                    >
                      Revert Anyway (Both are Drafts)
                    </button>
                    <button 
                      onClick={() => setModalConfig({ ...modalConfig, isOpen: false })} 
                      className="mt-2 text-sm text-gray-500 hover:text-black font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function EditScenesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-8 text-center text-gray-500">Loading editor...</div>}>
      <EditPageContent />
    </Suspense>
  );
}