from ultralytics import YOLO
import cv2
import numpy as np
from PIL import Image
import io
import torch
from transformers import CLIPProcessor, CLIPModel

class ObjectDetector:
    def __init__(self, model_path="yolov8n.pt"):
        print(f"Loading YOLO model: {model_path}...")
        self.model = YOLO(model_path)
        
        print("Loading CLIP model (openai/clip-vit-base-patch32)...")
        self.clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        self.clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

    def get_image_embedding(self, image_bytes):
        """Generates a CLIP embedding vector for an image (Product or Crop)."""
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        inputs = self.clip_processor(images=image, return_tensors="pt")
        with torch.no_grad():
            features = self.clip_model.get_image_features(**inputs)
        # Normalize the vector so we can use dot product for cosine similarity
        return features / features.norm(p=2, dim=-1, keepdim=True)

    def detect_best_matches(self, scene_bytes, product_embeddings, threshold=0.25):
        """
        New Main Function: visual-search-based detection.
        product_embeddings: List of {'id': str, 'name': str, 'embedding': tensor}
        """
        scene_image = Image.open(io.BytesIO(scene_bytes)).convert("RGB")
        img_width, img_height = scene_image.size
        
        # 1. Detect ALL potential objects (General Scan)
        # Low confidence to ensure we see everything
        results = self.model.predict(scene_image, conf=0.05) 
        
        matches = []
        crops = []
        crop_metadata = []

        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                # Minimum size check (Relaxed to 10px)
                if (x2 - x1) < 10 or (y2 - y1) < 10: 
                    continue 

                crop = scene_image.crop((x1, y1, x2, y2))
                crops.append(crop)
                
                center_x = ((x1 + x2) / 2) / img_width
                center_y = ((y1 + y2) / 2) / img_height
                
                crop_metadata.append({
                    "box": [x1, y1, x2, y2],
                    "center": {"x": center_x, "y": center_y},
                    "yolo_label": self.model.names[int(box.cls[0])],
                    "yolo_conf": float(box.conf[0])
                })

        if not crops:
            print("[AI Debug] No objects detected by YOLO.")
            return []

        # 2. Embed all crops in one batch (Efficiency)
        inputs = self.clip_processor(images=crops, return_tensors="pt", padding=True)
        with torch.no_grad():
            crop_features = self.clip_model.get_image_features(**inputs)
        crop_features = crop_features / crop_features.norm(p=2, dim=-1, keepdim=True)

        # 3. Compare All Crops vs All Products
        for i, crop_vec in enumerate(crop_features):
            best_score = -1.0
            best_prod = None
            
            # Find closest product
            for prod in product_embeddings:
                score = torch.dot(crop_vec, prod['embedding'].flatten()).item()
                if score > best_score:
                    best_score = score
                    best_prod = prod
            
            yolo_lbl = crop_metadata[i]['yolo_label']
            prod_name = best_prod['title'] if best_prod else "None"
            print(f"[AI Debug] Crop '{yolo_lbl}' vs Product '{prod_name}' = Score {best_score:.4f}")

            # 4. Determine Match Type
            # If excellent match -> Product
            # If weak match -> Generic Object
            if best_score > threshold:
                matches.append({
                    "label": best_prod['category'], 
                    "center": crop_metadata[i]['center'],
                    "confidence": best_score,
                    "box": crop_metadata[i]['box'],
                    "product": best_prod,
                    "type": "product_match"
                })
            else:
                matches.append({
                    "label": crop_metadata[i]['yolo_label'],
                    "center": crop_metadata[i]['center'],
                    "confidence": crop_metadata[i]['yolo_conf'],
                    "box": crop_metadata[i]['box'],
                    "product": None,
                    "type": "generic_detection"
                })
        
        # 5. Simple Deduplication (No filtering, just merging overlaps)
        # If we have 200 matches, just take the top 20 most confident ones
        # and do basic distance pruning
        
        final_matches = []
        # Sort by confidence
        matches = sorted(matches, key=lambda x: x['confidence'], reverse=True)
        
        for m in matches:
            is_new = True
            for existing in final_matches:
                dx = m['center']['x'] - existing['center']['x']
                dy = m['center']['y'] - existing['center']['y']
                dist = (dx**2 + dy**2)**0.5
                
                # Dynamic merging:
                # If SAME label (e.g. multiple "Table" detections on one big table), merge aggressively (20%)
                # If DIFFERENT label, only merge if basically identical (5%)
                merge_threshold = 0.20 if m['label'] == existing['label'] else 0.05
                
                if dist < merge_threshold:
                    is_new = False
                    break
            
            if is_new:
                final_matches.append(m)

        return final_matches[:15] # Return top 15 items 

    def detect_from_image(self, image_bytes, allowed_classes=None):
        """
        Advanced Detection: Slices image into Left/Right halves to preserve resolution
        and better detect small objects (chairs) in wide 360 images.
        """
        # Convert bytes to PIL Image
        original_image = Image.open(io.BytesIO(image_bytes))
        width, height = original_image.size
        
        # Define 2 Slices (Left and Right halves)
        # 360 images are 2:1 aspect ratio. Splitting makes them 1:1 (ideal for YOLO)
        mid_x = width // 2
        crops = [
            (0, 0, mid_x, height),      # Left Crop
            (mid_x, 0, width, height)   # Right Crop
        ]
        
        detected_objects = []

        for i, crop_coords in enumerate(crops):
            crop_x_offset, crop_y_offset, crop_w, crop_h = crop_coords
            
            # Crop the image
            crop_img = original_image.crop((crop_x_offset, crop_y_offset, crop_x_offset + crop_w, crop_y_offset + crop_h))
            
            # Run inference on the crop (Better resolution!)
            results = self.model.predict(crop_img, conf=0.10) # Low threshold for sensitivity
            
            for result in results:
                for box in result.boxes:
                    # Crop-relative coords
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    
                    # Convert to Full Image Coords
                    global_x1 = x1 + crop_x_offset
                    global_x2 = x2 + crop_x_offset
                    global_y1 = y1 # No Y offset
                    global_y2 = y2
                    
                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    class_name = self.model.names[cls_id]

                    if allowed_classes and class_name not in allowed_classes:
                        continue

                    # Normalized Center
                    center_x = ((global_x1 + global_x2) / 2) / width
                    center_y = ((global_y1 + global_y2) / 2) / height

                    detected_objects.append({
                        "label": class_name,
                        "confidence": conf,
                        "bbox": [global_x1, global_y1, global_x2, global_y2],
                        "center": {"x": center_x, "y": center_y}
                    })
        
        # Simple NMS to merge overlap at the split line?
        # For now, just return all. The user asked to REMOVE the custom distance calcs.
        return detected_objects
