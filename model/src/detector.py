from ultralytics import YOLO
import cv2
import numpy as np
from PIL import Image
import io
import torch
from transformers import CLIPProcessor, CLIPModel, AutoProcessor, AutoModelForZeroShotObjectDetection

class ObjectDetector:
    def __init__(self, model_path="yolov8n.pt"):
        print(f"Loading YOLO model: {model_path}...")
        self.model = YOLO(model_path)
        
        print("Loading CLIP model (openai/clip-vit-base-patch32)...")
        self.clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        self.clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

        print("Loading Grounding DINO model (IDEA-Research/grounding-dino-tiny)...")
        self.dino_processor = AutoProcessor.from_pretrained("IDEA-Research/grounding-dino-tiny")
        self.dino_model = AutoModelForZeroShotObjectDetection.from_pretrained("IDEA-Research/grounding-dino-tiny")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dino_model.to(self.device)

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
        # Use a more reasonable confidence to avoid excessive ghost boxes
        results = self.model.predict(scene_image, conf=0.15)
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
                if prod.get('embedding') is None:
                    continue
                
                # Align tensor shapes: crop_vec is (1,512), embedding is (1,512)
                score = (crop_vec.unsqueeze(0) @ prod['embedding'].T).item()
                if score > best_score:
                    best_score = score
                    best_prod = prod
            
            yolo_lbl = crop_metadata[i]['yolo_label']
            prod_name = best_prod['title'] if best_prod else "None"
            print(f"[AI Debug] Crop '{yolo_lbl}' vs Product '{prod_name}' = Score {best_score:.4f}")

            # 4. Determine Match Type
            # If the CLIP score is high enough OR the YOLO label strictly matches the product category
            # we classify it as a successful Match. We increased the base threshold because 0.25 is too low for CLIP open-domain.
            dynamic_threshold = 0.28
            
            # Bonus: If the YOLO label identically matches the Product's declared category (e.g. YOLO: 'chair', Category: 'chair')
            # we relax the threshold slightly because they agree.
            if best_prod and best_prod['category'].lower() in yolo_lbl.lower():
                dynamic_threshold = 0.24

            if best_score > dynamic_threshold:
                matches.append({
                    "label": best_prod['category'],
                    "center": crop_metadata[i]['center'],
                    "confidence": best_score,
                    "box": crop_metadata[i]['box'],
                    "product": best_prod,
                    "type": "product_match"
                })

        final_matches = []
        # Sort by confidence so we keep the best ones
        matches = sorted(matches, key=lambda x: x['confidence'], reverse=True)

        for m in matches:
            is_new = True
            for existing in final_matches:
                box_m = m['box']
                box_e = existing['box']
                
                # Calculate Intersection over Union (IoU)
                x1 = max(box_m[0], box_e[0])
                y1 = max(box_m[1], box_e[1])
                x2 = min(box_m[2], box_e[2])
                y2 = min(box_m[3], box_e[3])
                
                inter_area = max(0, x2 - x1) * max(0, y2 - y1)
                box_m_area = (box_m[2] - box_m[0]) * (box_m[3] - box_m[1])
                box_e_area = (box_e[2] - box_e[0]) * (box_e[3] - box_e[1])
                
                union_area = box_m_area + box_e_area - inter_area
                iou = inter_area / union_area if union_area > 0 else 0

                # Also calculate distance between centers
                dx = m['center']['x'] - existing['center']['x']
                dy = m['center']['y'] - existing['center']['y']
                dist = (dx**2 + dy**2)**0.5

                # 1. High IoU (Overlap) -> Probably same object.
                # If labels are different (e.g. 'table' vs 'chair'), require a higher overlap to merge.
                # Very aggressive merging for same label (even slightly overlapping boxes merge)
                iou_threshold = 0.15 if m['label'] == existing['label'] else 0.65
                
                # 2. Very close centers -> Same object.
                # Increase merge threshold for identical labels. A huge ping pong table can span 30% of the image
                merge_threshold = 0.35 if m['label'] == existing['label'] else 0.05

                # 3. Y-Axis Alignment Check (For big tables cut perfectly in half horizontally)
                # If the Y-centers are almost identical (within 5%), and they are the same label, merge!
                y_diff = abs(m['center']['y'] - existing['center']['y'])
                is_aligned = (y_diff < 0.05) and (m['label'] == existing['label'])
                
                if iou > iou_threshold or dist < merge_threshold or is_aligned:
                    is_new = False
                    break
            
            if is_new:
                final_matches.append(m)

        return final_matches[:15] # Return top 15 items 

    def detect_with_dino(self, scene_bytes, product_embeddings):
        """
        Uses Grounding DINO to find objects via open-vocabulary text search.
        Extracts product categories/titles into a single text prompt.
        """
        scene_image = Image.open(io.BytesIO(scene_bytes)).convert("RGB")
        img_width, img_height = scene_image.size

        # Create text prompt from our product inventory
        # e.g., "laptop . chair . curved monitor ."
        # DINO expects dot-separated items AND works best with lowercase
        text_queries = []
        for p in product_embeddings:
            # PRIORITIZE TITLE over category to avoid naming collisions!
            label = p.get('title')
            if label:
                clean_label = label.strip().lower()
                if clean_label not in text_queries:
                    text_queries.append(clean_label)
        
        if not text_queries:
            # Fallback if no valid products
            print("[DINO] No product text found for prompt!")
            return []
            
        text_prompt = " . ".join(text_queries) + " ."
        print(f"[DINO] Searching for: {text_prompt}")

        inputs = self.dino_processor(images=scene_image, text=text_prompt, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.dino_model(**inputs)

        # DINO post-processing
        # Lowering the box_threshold to make it more sensitive to objects like "ping pong table"
        results = self.dino_processor.post_process_grounded_object_detection(
            outputs,
            inputs.input_ids,
            box_threshold=0.25, # Lowered from 0.35 to catch more objects
            text_threshold=0.20, # Lowered from 0.25
            target_sizes=[scene_image.size[::-1]] # (height, width)
        )[0]

        matches = []
        scores = results["scores"].tolist()
        labels = results["labels"]
        boxes = results["boxes"].tolist()

        for score, label, box in zip(scores, labels, boxes):
            x1, y1, x2, y2 = box
            
            # Find the original product that best matches this label
            # DINO sometimes returns partial matches or lowercases it
            best_prod = None
            for p in product_embeddings:
                p_label = p.get('title')
                # If title perfectly matches, link it to the actual product!
                if p_label and (label in p_label.lower() or p_label.lower() in label):
                    best_prod = p
                    label = p_label # Update tooltip text to matching title
                    break
            
            center_x = ((x1 + x2) / 2) / img_width
            center_y = ((y1 + y2) / 2) / img_height

            matches.append({
                "label": label,
                "center": {"x": center_x, "y": center_y},
                "confidence": float(score),
                "box": [x1, y1, x2, y2],
                "product": best_prod,
                "type": "dino_detection"
            })
            
            print(f"[DINO Match] Found '{label}' at Conf: {score:.3f}")

        # Route through our universal deduplication logic!
        return self._reduce_duplicate_hotspots(matches)

    def _reduce_duplicate_hotspots(self, matches, iou_thresh=0.5):
        """
        NMS (Non-Maximum Suppression) helper to merge duplicated bounding boxes
        found across crops or overlapping inference areas.
        """
        if not matches:
            return []
            
        def compute_iou(boxA, boxB):
            # box: [x1, y1, x2, y2]
            xA = max(boxA[0], boxB[0])
            yA = max(boxA[1], boxB[1])
            xB = min(boxA[2], boxB[2])
            yB = min(boxA[3], boxB[3])

            interArea = max(0, xB - xA) * max(0, yB - yA)
            if interArea == 0:
                return 0.0

            boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
            boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

            return interArea / float(boxAArea + boxBArea - interArea)

        # Sort matches by highest confidence so we keep the strongest detection
        matches = sorted(matches, key=lambda m: m['confidence'], reverse=True)
        keep = []

        for m in matches:
            # Check if it significantly overlaps with any box we are already keeping.
            should_keep = True
            for k in keep:
                # Calculate IOU between m and k
                iou = compute_iou(m['box'], k['box'])
                if iou > iou_thresh:
                    # They overlap too much! Since we sorted by confidence,
                    # 'k' is strictly better/equal, so we discard 'm'.
                    should_keep = False
                    break
                    
            if should_keep:
                keep.append(m)

        return keep

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

                    if allowed_classes is not None and class_name not in allowed_classes:
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
        
        # Simple NMS to merge overlap at the split line and general overlaps
        # Aggressive merging for hotspots
        final_objects = []
        detected_objects = sorted(detected_objects, key=lambda x: x['confidence'], reverse=True)

        for obj in detected_objects:
            is_new = True
            for existing in final_objects:
                box_m = obj['bbox']
                box_e = existing['bbox']

                # Normalize bounding boxes for IoU calculations
                bx1_m, by1_m, bx2_m, by2_m = box_m[0]/width, box_m[1]/height, box_m[2]/width, box_m[3]/height
                bx1_e, by1_e, bx2_e, by2_e = box_e[0]/width, box_e[1]/height, box_e[2]/width, box_e[3]/height

                # Calculate Intersection over Union (IoU)
                x1 = max(bx1_m, bx1_e)
                y1 = max(by1_m, by1_e)
                x2 = min(bx2_m, bx2_e)
                y2 = min(by2_m, by2_e)
                
                inter_area = max(0, x2 - x1) * max(0, y2 - y1)
                box_m_area = (bx2_m - bx1_m) * (by2_m - by1_m)
                box_e_area = (bx2_e - bx1_e) * (by2_e - by1_e)
                
                union_area = box_m_area + box_e_area - inter_area
                iou = inter_area / union_area if union_area > 0 else 0

                # Also calculate distance between centers
                dx = obj['center']['x'] - existing['center']['x']
                dy = obj['center']['y'] - existing['center']['y']
                dist = (dx**2 + dy**2)**0.5

                # 1. High IoU (Overlap) -> Probably same object.
                # Very aggressive merging for same label
                iou_threshold = 0.15 if obj['label'] == existing['label'] else 0.65
                
                # 2. Very close centers -> Same object.
                merge_threshold = 0.35 if obj['label'] == existing['label'] else 0.05

                # 3. Y-Axis Alignment Check (For large objects split across slices)
                y_diff = abs(obj['center']['y'] - existing['center']['y'])
                is_aligned = (y_diff < 0.05) and (obj['label'] == existing['label'])

                if iou > iou_threshold or dist < merge_threshold or is_aligned:
                    is_new = False
                    break
            
            if is_new:
                final_objects.append(obj)

        return final_objects
