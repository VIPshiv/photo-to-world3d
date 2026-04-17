import requests
from fastapi import FastAPI, UploadFile, File, Form
import uvicorn
from src.detector import ObjectDetector
from typing import Optional, List
import io
import json
import os

app = FastAPI(title='Smart360 AI Worker')

print('Initializing AI Model (YOLOv8m + CLIP)...')
detector = ObjectDetector('yolov8m.pt')

# In-Memory Cache for Product Embeddings
# { "prod_id": Tensor(...) }
product_embeddings_cache = []

def refresh_product_embeddings():
    """Fetches all products from Backend, downloads images, and computes CLIP embeddings."""
    global product_embeddings_cache
    try:
        print("Refreshing Product Knowledge Base...")
        headers = {'x-mock-user-id': 'user-1'}
        res = requests.get(f'{os.environ.get("BACKEND_URL", "http://localhost:3001")}/products', headers=headers)
        if not res.ok: return
        
        products = res.json()
        new_cache = []
        
        for prod in products:
            # For Grounding DINO we just need the text (category/title)
            # If there's an image, we'll embed it for CLIP. If not, we just save the text info.
            embedding = None
            if prod.get('mainImageUrl'):
                img_url = f"{os.environ.get('BACKEND_URL', 'http://localhost:3001')}{prod['mainImageUrl']}"
                try:
                    img_res = requests.get(img_url, timeout=5)
                    if img_res.status_code == 200:
                        embedding = detector.get_image_embedding(img_res.content)
                        print(f" -> Visual Embedding Generated: {prod['title']}")
                except Exception as e:
                    print(f"Failed to fetch image for {prod['title']}: {e}")
            else:
                print(f" -> Text-Only Entry Loaded: {prod['title']}")
                
            new_cache.append({
                'id': prod['id'],
                'title': prod['title'], 
                'category': prod['category'],
                'embedding': embedding
            })
        
        product_embeddings_cache = new_cache
        print(f"Knowledge Base Ready: {len(new_cache)} total products loaded.")
    except Exception as e:
        print(f"Refresh failed: {e}")

@app.get('/')
def health_check():
    return {'status': 'running', 'service': 'ai-worker'}

@app.post('/refresh-db')
def trigger_refresh():
    refresh_product_embeddings()
    return {"status": "ok", "count": len(product_embeddings_cache)}

@app.post('/detect')
async def detect_objects(
    file: UploadFile = File(...), 
    classes: Optional[str] = Form(None),
    model_type: str = Form("yolo")
):
    print(f"Processing Scene: {file.filename} [Model: {model_type.upper()}]")
    
    # 1. Ensure we have the latest product vectors
    if not product_embeddings_cache:
        refresh_product_embeddings()

    contents = await file.read()
    
    try:
        if model_type.lower() == 'dino':
            print("Running Deep Text Search (Grounding DINO)...")
            results = detector.detect_with_dino(contents, product_embeddings_cache)
        elif len(product_embeddings_cache) > 0:
            # ADVANCED MODE: Visual Search (CLIP)
            print("Running Visual Match (CLIP)...")
            results = detector.detect_best_matches(contents, product_embeddings_cache)
        else:
            # FALLBACK: Basic YOLO
            print("No product images found. Falling back to basic YOLO detection.")
            allowed_list = [c.strip() for c in classes.split(',')] if classes else None
            results = detector.detect_from_image(contents, allowed_classes=allowed_list)

        return {
            'success': True, 
            'filename': file.filename, 
            'detected_objects': results
        }
    except Exception as e:
        print(f"Detection error: {e}")
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    # Initial load
    uvicorn.run(app, host='0.0.0.0', port=8000)
