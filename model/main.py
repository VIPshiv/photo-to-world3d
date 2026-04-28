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
        headers = {'x-mock-user-id': 'user-1'} # Just for passing the basic auth check
        res = requests.get(f'{os.environ.get("BACKEND_URL", "http://localhost:3001")}/products/all', headers=headers)
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
                'storeId': prod.get('storeId'),
                'sceneId': prod.get('sceneId'),
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
    model_type: str = Form("yolo"),
    storeId: Optional[str] = Form(None),
    sceneId: Optional[str] = Form(None)
):
    print(f"Processing Scene: {file.filename} [Model: {model_type.upper()}] [Store: {storeId}] [Scene: {sceneId}]")
    
    active_cache = []
    
    # 1. Use the EXACT products provided by Backend in 'classes' JSON string
    if classes is not None and classes.strip() not in ['', '__EMPTY__']:
        try:
            products_from_backend = json.loads(classes)
            if isinstance(products_from_backend, list):
                print(f"Loaded {len(products_from_backend)} specific products from backend payload.")
                for prod in products_from_backend:
                    embedding = None
                    if prod.get('mainImageUrl'):
                        img_url = f"{os.environ.get('BACKEND_URL', 'http://localhost:3001')}{prod['mainImageUrl']}"
                        try:
                            img_res = requests.get(img_url, timeout=5)
                            if img_res.status_code == 200:
                                embedding = detector.get_image_embedding(img_res.content)
                        except Exception as e:
                            print(f"Failed to fetch image: {e}")
                    
                    active_cache.append({
                        'id': prod.get('id'),
                        'storeId': storeId,
                        'sceneId': sceneId,
                        'title': prod.get('title'),
                        'category': prod.get('category'),
                        'embedding': embedding
                    })
        except json.JSONDecodeError:
            print("Failed to parse classes JSON, falling back to legacy allowed_list.")
            # Fallback for old comma-separated YOLO classes behavior
            pass

    print(f"Matched {len(active_cache)} products for Store={storeId}, Scene={sceneId}")

    contents = await file.read()
    
    try:
        if model_type.lower() == 'dino':
            print("Running Deep Text Search (Grounding DINO)...")
            results = detector.detect_with_dino(contents, active_cache)
        elif len(active_cache) > 0:
            # ADVANCED MODE: Visual Search (CLIP)
            print("Running Visual Match (CLIP)...")
            results = detector.detect_best_matches(contents, active_cache)
        else:
            # FALLBACK: Basic YOLO
            print("Running Basic YOLO detection.")
            allowed_list = []
            if len(active_cache) > 0:
                allowed_list = list(set([p.get('category') or p.get('title') for p in active_cache]))
            elif classes is not None and not classes.startswith('['):
                if classes == '__EMPTY__':
                    allowed_list = []
                else:
                    allowed_list = [c.strip() for c in classes.split(',')] if classes.strip() else []
            else:
                allowed_list = None
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
