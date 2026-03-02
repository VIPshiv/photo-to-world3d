# Project Status Report: Photo to World3D
**Date:** February 6, 2026
**Version:** 2.0 (AI Visual Search Integration)

## Executive Summary
The project has successfully transitioned from a basic "Object Detector" to a context-aware "Visual Search" system. The application can now ingest 360° panoramas, visually identify specific products from the user's inventory (e.g., a specific model of Ping Pong Table), and map them accurately into a 3D interactive viewer.

---

## 1. AI & Computer Vision Upgrades
**File:** `model/src/detector.py`, `model/main.py`

### A. Hybrid Architecture (YOLO + CLIP)
- **Previous:** Relied solely on YOLOv8 logic. If YOLO saw a "table", it was just a generic table.
- **Current:** Uses YOLOv8m for *location* (finding where objects are) and OpenAI's CLIP for *identification* (figuring out exactly *which* product it is).
- **Mechanism:** The system crops detected objects and computes their "Visual Embedding" (a mathematical fingerprint of the image). It compares this against the embeddings of your store's product catalog using Cosine Similarity.

### B. High-Res 360 Handling
- **Problem:** 360 photos are wide (2:1 ratio). Resizing them to square (640x640) for AI caused small objects (chairs) to disappear or warp.
- **Solution:** Implemented **Layout Slicing**. The AI now cuts the image into Left/Right halves, processing them at full resolution. This double-resolution scan allows it to capture small background details.

### C. Smart Deduplication
- **Problem:** Large objects (tables) were detected as 4-10 overlapping boxes, cluttering the view.
- **Solution:** Implemented a dynamic merging algorithm:
    - If detections have the **Same Label** (e.g., Table vs Table) -> Merge Aggressively (20% overlap).
    - If detections have **Different Labels** (e.g., Table vs Chair) -> Keep Separate (5% overlap).
- **Result:** One clean hotspot per object.

---

## 2. Frontend 3D Viewer
**File:** `frontend/components/viewer/SceneViewer.tsx`

### A. Rich Product Cards
- **Feature:** Clicking a hotspot now opens a floating HTML card overlaid on the 3D canvas.
- **Content:** Displays Product Title, Dynamic Price (formatted), Main Product Image (fetched from backend), and Description.
- **Fallbacks:** If an object is detected but not in inventory (e.g., a random couch), it displays a "Generic Object" label instead of breaking.

### B. Interactive Stability
- **Interaction:** Separated `mousedown/mouseup` (dragging camera) from `click` (selection). This prevents "accidental clicks" while looking around.
- **Crash Fix:** Implemented `renderer.dispose()` and memory cleanup. Fixed the "WebGL Context Loss" error that occurred after viewing multiple scenes.

---

## 3. Backend Logic
**File:** `backend/src/scenes/scenes.service.ts`

### A. Coordinate Mapping
- **Fix:** Corrected the mathematical mapping between 2D pixel coordinates and 3D Spherical coordinates.
- **Math:** 
    - `Yaw`: Mapped 0-1 to 0-360 degrees.
    - `Pitch`: Inverted Y-axis to match 3D standard (Top-down).
- **Result:** Hotspots now appear exactly "on top" of the real-world object in the viewer.

### B. Data Integrity
- **Logic:** Updated service to prioritize AI findings. If the AI provides a specific `productId`, the backend saves it directly. It only falls back to "Name Matching" if the AI detection was generic.

---

## 4. Next Steps / Recommendations
1.  **Inventory Expansion:** Add more product photos to the backend to leverage the new Visual Search.
2.  **Mobile Polish:** The 3D viewer controls are mouse-optimized. Touch controls for mobile devices could be tuned further.
3.  **Manual Editing:** Currently, hotspots are auto-generated. Adding a UI to manually drag/delete hotspots in the viewer would be a valuable admin feature.
