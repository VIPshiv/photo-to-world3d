"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

type StitchMode = "cubemap" | "guided";
type GuidedSubMode = "manual" | "auto";

export default function StitchPage() {
  const router = useRouter();
  const [mode, setMode] = useState<StitchMode>("cubemap");
  const [guidedMode, setGuidedMode] = useState<GuidedSubMode>("manual");
  const [status, setStatus] = useState<string>("");
  const [resultId, setResultId] = useState<string | null>(null);

  const [autoFiles, setAutoFiles] = useState<File[]>([]);

  const [cubeImages, setCubeImages] = useState<{ [key: string]: File | null }>({
    front: null,
    right: null,
    back: null,
    left: null,
    top: null,
    bottom: null,
  });

  const [guidedImages, setGuidedImages] = useState<{
    [key: string]: File | null;
  }>({
    "front-left": null,
    front: null,
    "front-right": null,
    left: null,
    right: null,
    "back-left": null,
    back: null,
    "back-right": null,
  });

  const handleCubeFileChange = (side: string, file: File | null) => {
    setCubeImages((prev) => ({ ...prev, [side]: file }));
  };

  const handleGuidedFileChange = (position: string, file: File | null) => {
    setGuidedImages((prev) => ({ ...prev, [position]: file }));
  };

  const handleAutoFileChange = (files: FileList | null) => {
    if (!files) return;
    setAutoFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const isCubeValid = Object.values(cubeImages).every((img) => img !== null);
  const isGuidedValid = Object.values(guidedImages).filter((img) => img !== null).length >= 2;
  const isAutoValid = autoFiles.length >= 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "cubemap" && !isCubeValid) {
      setStatus("Please upload all 6 cubemap images.");
      return;
    }
    if (mode === "guided" && guidedMode === "manual" && !isGuidedValid) {
      setStatus("Please upload at least 2 images for stitching.");
      return;
    }
    if (mode === "guided" && guidedMode === "auto" && !isAutoValid) {
      setStatus("Please upload at least 2 images.");
      return;
    }

    setStatus(`Stitching (${mode} mode) in progress...`);
    setResultId(null);

    const formData = new FormData();
    formData.append("mode", mode);

    if (mode === "cubemap") {
      Object.entries(cubeImages).forEach(([side, file]) => {
        if (file) formData.append(side, file);
      });
    } else if (mode === "guided") {
      if (guidedMode === "manual") {
        Object.values(guidedImages).forEach((file) => file && formData.append("files", file));
      } else {
        autoFiles.forEach((file) => formData.append("files", file));
      }
    }

    try {
      const response = await fetch(apiUrl('/scenes/stitch'), {
        method: "POST",
        headers: { "x-mock-user-id": localStorage.getItem("mockUserId") || "" },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Stitching failed");
      }

      const data = await response.json();
      setStatus("Stitching complete! Click to view.");
      setResultId(encodeURIComponent(data.imageUrl));
    } catch (err: unknown) {
      console.error("Upload Error:", err);
      const errorMsg = err instanceof Error ? err.message : "Unknown error occurred";
      setStatus(`Error: ${errorMsg}`);
    }
  };

  const guidedLayout = [
    ["front-left", "front", "front-right"],
    ["left", null, "right"],
    ["back-left", "back", "back-right"],
  ];

  return (
    <div className="min-h-screen bg-[#e5e7eb] text-slate-800 font-sans xl:overflow-hidden flex flex-col p-4 md:p-8">
      <div className="max-w-[1800px] w-full mx-auto flex flex-col h-full xl:h-[calc(100vh-4rem)] gap-6">
        
        {/* Header Container */}
        <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-black text-black tracking-tight">Create Panorama</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Stitch multiple photos into a seamless 3D world.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-black transition-all hover:-translate-y-0.5 shadow-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Home
            </Link>
            <Link href="/upload" className="px-5 py-2.5 rounded-xl text-sm font-bold bg-black text-white hover:shadow-lg hover:shadow-black/25 transition-all hover:-translate-y-0.5 flex items-center gap-2">
              Next Step
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="relative flex-1 min-h-0 w-full overflow-hidden">
          
          <form onSubmit={handleSubmit} className="absolute inset-0 flex flex-col xl:flex-row gap-6 w-full h-full">

            {/* INFO PANEL */}
            <div className="w-full xl:w-[28%] flex flex-col gap-6 h-full transition-all duration-[600ms] ease-in-out absolute xl:relative z-10 xl:order-first">
              
              {/* Mode Selection */}
              <div className="bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-sm border border-white/50 hover:shadow-md transition-shadow duration-300 flex-shrink-0 animate-in fade-in slide-in-from-top-4">
                 <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3 border-b border-slate-100 pb-3">Stitching Mode</h2>
                 <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 relative overflow-hidden">
                    <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg shadow-sm transition-transform duration-[400ms] ease-out ${mode === "guided" ? "translate-x-[calc(100%+4px)] bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/20" : "translate-x-0 bg-black shadow-md shadow-black/10"}`} />
                    
                    <button type="button" onClick={() => setMode("cubemap")} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 flex items-center justify-center gap-2 relative z-10 ${mode === "cubemap" ? "text-white" : "text-slate-500 hover:text-black"}`}>
                      <span className="text-sm">🎲</span> Cubemap
                    </button>
                    <button type="button" onClick={() => setMode("guided")} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 flex items-center justify-center gap-2 relative z-10 ${mode === "guided" ? "text-white" : "text-slate-500 hover:text-black"}`}>
                      <span className="text-sm">📸</span> Guided
                    </button>
                 </div>
                 
                 {mode === "guided" && (
                   <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                     <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                        <button type="button" onClick={() => setGuidedMode("manual")} className={`flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${guidedMode === "manual" ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-slate-500 hover:text-black hover:bg-slate-100"}`}>Grid</button>
                        <button type="button" onClick={() => setGuidedMode("auto")} className={`flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${guidedMode === "auto" ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-slate-500 hover:text-black hover:bg-slate-100"}`}>Auto</button>
                     </div>
                   </div>
                 )}
              </div>

              {/* Instructions Panel */}
              <div className="bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-sm border border-white/50 hover:shadow-md transition-shadow duration-300 flex-shrink-0">
                 <div className="flex items-center gap-2 mb-2">
                   <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white transition-colors duration-500 text-[10px] ${mode === "cubemap" ? "bg-black" : "bg-indigo-500"}`}>ℹ️</div>
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Requirements</h3>
                 </div>
                 <p className="text-[11px] font-bold text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 uppercase tracking-wide">
                   {mode === "cubemap" ? "Upload exactly 6 specific faces of a cube (front, back, top, bottom, left, right) to create a seamless 360° panorama." : "Capture overlapping photos around you. Our AI will automatically align and stitch them together."}
                 </p>
              </div>

              {/* Process / Status Box (Shown only when active) */}
              {(status || resultId) && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 transition-all duration-300 flex flex-col relative overflow-hidden animate-in fade-in zoom-in duration-300">
                   <div className={`absolute top-0 left-0 w-full h-1 transition-colors duration-500 ${mode === "cubemap" ? "bg-gradient-to-r from-gray-700 to-black" : "bg-gradient-to-r from-indigo-500 to-purple-600"}`} />
                   <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Processing Station</h2>
                   
                   <div className="flex flex-col justify-center items-center text-center p-3 bg-[#f8fafc] rounded-xl border border-slate-100">
                       <div className={`flex flex-col items-center gap-3 ${status.includes("Error") ? "text-rose-600" : "text-emerald-700"}`}>
                          {status.includes("progress") ? (
                            <div className={`w-8 h-8 border-4 border-t-transparent rounded-full animate-spin ${mode === "cubemap" ? "border-slate-900" : "border-indigo-600"}`}/>
                          ) : status.includes("Error") ? (
                            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xl font-black shadow-sm">!</div>
                          ) : (
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-lg font-black shadow-sm">✓</div>
                          )}
                          <span className="text-[10px] font-black leading-snug uppercase tracking-widest bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">{status}</span>
                       </div>
                   </div>

                   {/* Results Button */}
                   {resultId && (
                     <div className="mt-4 animate-in slide-in-from-bottom-4 fade-in duration-500">
                       <Link href={`/view/local?img=${resultId}`} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${mode === "cubemap" ? "bg-black hover:bg-black text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}>
                         View Final 3D Panorama
                       </Link>
                     </div>
                   )}
                </div>
              )}
            </div>

            {/* MAIN DROP PANEL */}
            <div className="flex-1 bg-white/80 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-[600ms] ease-in-out flex flex-col h-full overflow-hidden relative z-0">
              
              <div className="flex justify-between items-center border-b border-slate-100 p-5 bg-slate-50/50 rounded-t-[32px] flex-shrink-0">
                 <div className="flex items-center gap-3">
                   <div className={`w-3 h-3 rounded-full shadow-sm transition-colors duration-500 ${mode === "cubemap" ? "bg-black" : "bg-indigo-500"}`} />
                   <h2 className="text-[14px] font-black text-slate-700 uppercase tracking-widest">{mode === "cubemap" ? "Cubemap Assembly Workspace" : "Guided Image Workspace"}</h2>
                 </div>
              </div>
              
<div className="flex-1 overflow-hidden bg-[#f8fafc] relative">
                
                <div 
                  className="absolute inset-0 flex transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]" 
                  style={{ transform: mode === "cubemap" ? "translateX(0%)" : "translateX(-50%)", width: "200%" }}
                >
                  
                  {/* CUBEMAP PANEL */}
                  <div className="w-1/2 h-full flex flex-col items-center justify-center p-4 xl:p-6 opacity-100 transition-opacity duration-500" style={{ opacity: mode === "cubemap" ? 1 : 0.3 }}>
                    <div className="grid grid-cols-4 gap-2 md:gap-3 w-full max-w-lg">
                      <div className="col-start-2 col-span-2 mx-auto w-20 md:w-24 lg:w-28"><FileUploadBox label="Top" file={cubeImages["top"]} onChange={(f) => handleCubeFileChange("top", f)} theme="black" /></div>
                      <div className="col-start-1 col-span-4 grid grid-cols-4 gap-2 md:gap-3 w-full">
                        {["left", "front", "right", "back"].map((side) => (
                           <div key={side} className="w-full aspect-square"><FileUploadBox label={side.toUpperCase()} file={cubeImages[side]} onChange={(f) => handleCubeFileChange(side, f)} theme="black" /></div>
                        ))}
                      </div>
                      <div className="col-start-2 col-span-2 mx-auto w-20 md:w-24 lg:w-28"><FileUploadBox label="Bottom" file={cubeImages["bottom"]} onChange={(f) => handleCubeFileChange("bottom", f)} theme="black" /></div>
                    </div>
                  </div>

                  {/* GUIDED PANEL */}
                  <div className="w-1/2 h-full relative overflow-hidden opacity-100 transition-opacity duration-500" style={{ opacity: mode === "guided" ? 1 : 0.3 }}>
                    <div 
                      className="absolute inset-0 flex transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{ transform: guidedMode === "manual" ? "translateX(0%)" : "translateX(-50%)", width: "200%" }}
                    >
                      {/* MANUAL GRID */}
                      <div className="w-1/2 h-full flex flex-col items-center justify-center p-4 xl:p-6 transition-opacity duration-500" style={{ opacity: guidedMode === "manual" ? 1 : 0.3 }}>
                         <div className="flex flex-col gap-2 w-full max-w-xl mx-auto items-center">
                            {guidedLayout.map((row, rowIndex) => (
                               <div key={rowIndex} className="flex gap-2 md:gap-3 justify-center w-full">
                                  {row.map((position, colIndex) => {
                                    if (!position) return <div key={`spacer-${rowIndex}-${colIndex}`} className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 hidden sm:block opacity-0" />;
                                    return (
                                      <div key={position} className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28">
                                        <FileUploadBox label={position.replace("-", " ").toUpperCase()} file={guidedImages[position]} onChange={(f) => handleGuidedFileChange(position, f)} small />
                                      </div>
                                    );
                                  })}
                               </div>
                            ))}
                            <div className="text-center mt-3 inline-block bg-indigo-50/80 px-4 py-2 rounded-full border border-indigo-100 shadow-sm">
                               <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">💡 Ensure ~30% overlap between adjacent photos.</p>
                            </div>
                         </div>
                      </div>

                      {/* AUTO DRAG & DROP */}
                      <div className="w-1/2 h-full flex flex-col items-center justify-center p-4 xl:p-6 pb-2 transition-opacity duration-500" style={{ opacity: guidedMode === "auto" ? 1 : 0.3 }}>
                        <div className="border-2 border-dashed border-indigo-200 rounded-2xl w-full max-w-xl h-full max-h-[300px] flex flex-col items-center justify-center bg-indigo-50/40 hover:bg-white hover:border-indigo-400 transition-all cursor-pointer relative group p-4 shadow-inner">
                          <input type="file" multiple accept="image/*" onChange={(e) => handleAutoFileChange(e.target.files)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 border border-slate-100 text-indigo-500 shadow-sm">
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          </div>
                          <h3 className="text-lg font-black text-slate-900 tracking-tight mb-1">
                             {autoFiles.length > 0 ? `${autoFiles.length} Images Ready` : "Drop All Photos Here"}
                          </h3>
                          <p className="text-slate-500 font-bold max-w-sm text-center leading-relaxed text-[10px] uppercase tracking-wide">
                             {autoFiles.length > 0 ? "Click tags below to remove." : "Select 2+ overlapping photos. We recommend 8-12 photos."}
                          </p>
                        </div>
                        
                        {autoFiles.length > 0 && (
                          <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm max-h-[100px] overflow-y-auto custom-scrollbar mt-3 w-full max-w-xl relative z-20">
                             <div className="flex flex-wrap gap-2 justify-center relative pointer-events-none">
                               {autoFiles.map((f, i) => (
                                 <div key={i} className="pl-2 pr-1 py-1 bg-slate-50 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-200 text-slate-700 flex items-center gap-2 pointer-events-auto hover:border-rose-200 hover:bg-rose-50 transition-colors group/tag shadow-sm">
                                   <span className="truncate max-w-[100px]">{f.name}</span>
                                   <button type="button" title="Remove" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAutoFiles((prev) => prev.filter((_, idx) => idx !== i)); }} className="w-5 h-5 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-rose-500 transition-colors">✕</button>
                                 </div>
                               ))}
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between p-4 md:p-5 bg-white border-t border-slate-100 rounded-b-[32px] flex-shrink-0 z-10">
                  <div className="hidden md:block">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{mode === "cubemap" ? "Requires precisely 6 images." : "Requires 2+ images seamlessly shot."}</p>
                  </div>
                  <button
                    type="submit"
                    disabled={mode === "cubemap" ? !isCubeValid : mode === "guided" && guidedMode === "manual" ? !isGuidedValid : mode === "guided" && guidedMode === "auto" ? !isAutoValid : true}
                    className={`px-8 py-3 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${(mode === "cubemap" && isCubeValid) || (mode === "guided" && guidedMode === "manual" && isGuidedValid) || (mode === "guided" && guidedMode === "auto" && isAutoValid) ? mode === "cubemap" ? "bg-black text-white hover:bg-black hover:-translate-y-0.5 hover:shadow-xl" : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-xl hover:shadow-indigo-500/25 hover:-translate-y-0.5" : "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none border border-slate-200"}`}
                  >
                    {mode === "cubemap" ? (
                      <><span className="text-base leading-none">✨</span> Stitch Cube Map</>
                    ) : (
                      <><span className="text-base leading-none">🚀</span> Launch Stitch</>
                    )}
                  </button>
              </div>

            </div>

          </form>
        </div>
      </div>
    </div>
  );
}

// Re-styled Subcomponent
function FileUploadBox({ label, file, onChange, small, theme = "blue" }: { label: string; file: File | null; onChange: (file: File | null) => void; small?: boolean; theme?: "black" | "blue" }) {        
  return (
    <div className={`relative ${small ? "h-full" : "aspect-square"} w-full rounded-[24px] border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden group bg-white hover:shadow-md ${file ? "border-emerald-400 shadow-sm" : theme === "black" ? "border-slate-200 hover:border-black" : "border-slate-200 hover:border-indigo-300"}`}>
      <input type="file" accept="image/*" onChange={(e) => onChange(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
      {file ? (
        <div className="absolute inset-0 bg-black">
          <img src={URL.createObjectURL(file)} alt={label} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center backdrop-blur-[2px]">
            <span className="text-white font-black text-[10px] uppercase tracking-widest bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/30 shadow-xl">Replace</span>
          </div>
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-slate-900 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">{label}</div>
          <div className="absolute bottom-3 right-3 bg-emerald-500 text-white text-[10px] p-1.5 rounded-full shadow-lg">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
        </div>
      ) : (
        <div className={`absolute inset-0 flex flex-col items-center justify-center p-2 text-center transition-colors duration-300 ${theme === "black" ? "text-slate-400 group-hover:bg-slate-100" : "text-slate-400 group-hover:bg-indigo-50/30"}`}>
          <div className={`w-10 h-10 rounded-full border flex items-center justify-center mb-3 group-hover:bg-white group-hover:shadow-sm group-hover:scale-110 transition-all duration-300 ${theme === "black" ? "bg-slate-50 border-slate-100 text-slate-500 group-hover:text-black" : "bg-slate-50 border-slate-100 text-slate-500 group-hover:text-indigo-500"}`}>
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${theme === "black" ? "text-slate-400 group-hover:text-black" : "text-slate-400 group-hover:text-indigo-600"}`}>{label}</span>        
        </div>
      )}
    </div>
  );
}
