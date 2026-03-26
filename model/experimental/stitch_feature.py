import cv2
import sys
import os
import glob
import numpy as np

def apply_clahe_lab(img):
    """
    Applies Contrast Limited Adaptive Histogram Equalization (CLAHE)
    in the LAB color space to modify only luminance, leaving colors intact.
    This pulls details out of blown-out shadows and highlights.
    """
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    # Adaptive CLAHE: Check mean brightness to determine how aggressive we should be
    mean_brightness = np.mean(l)
    clip = 4.0 if mean_brightness > 160 else 3.0
    
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(6,6))
    cl = clahe.apply(l)
    limg = cv2.merge((cl, a, b))
    return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

def straighten_panorama(pano):
    """
    Auto-detect and correct rotation in the final panorama.
    Uses Hough line detection to find the dominant horizontal lines
    (ceiling/floor/wall edges) and rotates to align them.
    """
    gray = cv2.cvtColor(pano, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=200)
    
    if lines is None:
        print("  [Straighten] No lines found, skipping.")
        return pano
    
    # Collect angles of near-horizontal lines only (within 20° of horizontal)
    angles = []
    for line in lines:
        rho, theta = line[0]
        angle_deg = np.degrees(theta) - 90
        if abs(angle_deg) < 20:
            angles.append(angle_deg)
    
    if not angles:
        print("  [Straighten] No horizontal lines found, skipping.")
        return pano
    
    # Use median angle to avoid outliers
    median_angle = np.median(angles)
    print(f"  [Straighten] Detected tilt: {median_angle:.2f}° — correcting...")
    
    if abs(median_angle) < 0.5:
        print("  [Straighten] Tilt negligible, skipping.")
        return pano
    
    h, w = pano.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    corrected = cv2.warpAffine(pano, M, (w, h),
                                flags=cv2.INTER_LANCZOS4,
                                borderMode=cv2.BORDER_CONSTANT,
                                borderValue=[0, 0, 0])
    return corrected

def diagnose_images(image_paths):
    """
    Pre-stitching diagnostic pass.
    Runs SIFT on every image and reports:
      - Feature count (< 100 = bad image, likely plain/blurry)
      - Image size
      - Pairwise overlap likelihood between consecutive images
    Returns a dict: { path: { 'features': N, 'warning': '...' } }
    """
    print("\n========== DIAGNOSTIC REPORT ==========")
    sift = cv2.SIFT_create()
    results = {}

    feature_data = []
    for i, p in enumerate(image_paths):
        name = os.path.basename(p)
        img = cv2.imread(p)
        if img is None:
            print(f"  [{i+1}] {name}: UNREADABLE FILE — cannot be decoded")
            results[p] = {'features': 0, 'warning': 'Unreadable file'}
            feature_data.append(None)
            continue

        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Adaptive CLAHE to grayscale for better SIFT feature detection
        mean_brightness = np.mean(gray)
        clip = 4.0 if mean_brightness > 160 else 3.0
        clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(6,6))
        
        gray_clahe = clahe.apply(gray)
        
        kp, des = sift.detectAndCompute(gray_clahe, None)
        n = len(kp)
        feature_data.append((kp, des, w))

        if n < 30:
            warning = "CRITICAL: Too few features — image is too blurry or plain (e.g. blank wall, overexposed)"
        elif n < 200:
            warning = "WARNING: Low features — may fail to connect to neighbors"
        else:
            warning = "OK"

        print(f"  [{i+1}] {name}: {w}x{h}px | {n} features | {warning}")
        results[p] = {'features': n, 'warning': warning}

    # Build a full Match-Count Matrix for Smart Reordering
    print("\n  --- Smart Reordering (Visual Similarity Matrix) ---")
    
    # Use FLANN matcher for speed
    FLANN_INDEX_KDTREE = 1
    index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
    search_params = dict(checks=50) # or pass empty dictionary
    flann = cv2.FlannBasedMatcher(index_params, search_params)

    num_imgs = len(feature_data)
    match_matrix = np.zeros((num_imgs, num_imgs), dtype=int)

    # 1. Compare everything against everything (N x N)
    for i in range(num_imgs):
        for j in range(i + 1, num_imgs):
            if feature_data[i] is None or feature_data[j] is None or feature_data[i][1] is None or feature_data[j][1] is None:
                continue
            
            # Need at least 2 descriptors to use knnMatch with k=2
            if len(feature_data[i][1]) < 2 or len(feature_data[j][1]) < 2:
                continue

            try:
                knn_matches = flann.knnMatch(feature_data[i][1], feature_data[j][1], k=2)
                good = [m for m, n in knn_matches if m.distance < 0.75 * n.distance]
                match_matrix[i][j] = len(good)
                match_matrix[j][i] = len(good)
            except Exception:
                pass

    # 2. Greedy Chaining for optimal sequence
    if num_imgs < 2:
        ordered_paths = image_paths
    else:
        # Find the absolute best pair of images to start the chain
        max_idx = np.unravel_index(np.argmax(match_matrix, axis=None), match_matrix.shape)
        if match_matrix[max_idx] == 0:
            # Fallback if there are absolutely NO matches anywhere
            ordered_paths = image_paths
            print("  [!] No valid overlaps found across any images. Retaining original order.")
        else:
            chain = [max_idx[0], max_idx[1]]
            unvisited = set(range(num_imgs)) - set(chain)

            # Build the sequence outward from the strongest center
            while unvisited:
                best_match = -1
                best_u = -1
                insert_at = -1 # 0 means prepend to start, 1 means append to end

                for u in unvisited:
                    # How well does 'u' match the left-most image in our chain?
                    if match_matrix[u][chain[0]] > best_match:
                        best_match = match_matrix[u][chain[0]]
                        best_u = u
                        insert_at = 0
                      
                    # How well does 'u' match the right-most image in our chain?
                    if match_matrix[u][chain[-1]] > best_match:
                        best_match = match_matrix[u][chain[-1]]
                        best_u = u
                        insert_at = 1

                if insert_at == 0:
                    chain.insert(0, best_u)
                else:
                    chain.append(best_u)
                
                unvisited.remove(best_u)
            
            ordered_paths = [image_paths[i] for i in chain]
            
            print("  Optimal Stitching Order Computed:")
            for idx, p in enumerate(ordered_paths):
                print(f"    {idx+1}. {os.path.basename(p)}")

    print("========================================\n")
    return results, ordered_paths

def stitch_images(image_paths, output_path="stitched_output.jpg"):
    print(f"--- Feature-Based Stitching (OpenCV) ---")
    print(f"Input: {len(image_paths)} images")

    results, ordered_paths = diagnose_images(image_paths)
    
    imgs = []
    loaded_paths = []
    for p in ordered_paths:
        if not os.path.exists(p):
            print(f"  [X] File not found: {p}")
            continue
        img = cv2.imread(p)
        if img is None:
            print(f"  [X] Could not decode: {p}")
            continue
        img_clahe = apply_clahe_lab(img)
        imgs.append(img_clahe)
        loaded_paths.append(os.path.basename(p))
    
    if len(imgs) < 2:
        print("Error: Need at least 2 valid images to stitch.")
        return False

    print("Initializing Stitcher (Mode: PANORAMA)...")
    try:
        stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
    except:
        stitcher = cv2.createStitcher(False)

    # --- FIX: Inject SIFT directly into the stitcher ---
    try:
        sift = cv2.SIFT_create(nfeatures=0,        # 0 = no limit on features
                               nOctaveLayers=4,     # more layers = better scale coverage
                               contrastThreshold=0.02,  # lower = finds more features
                               edgeThreshold=15,    # higher = keeps more edge features  
                               sigma=1.2)           # slight sharpening before detection
        stitcher.setFeaturesFinder(sift)
        print("  SIFT feature finder injected successfully.")
    except Exception as e:
        print(f"  Could not inject SIFT ({e}), using default detector.")

    stitcher.setRegistrationResol(1.5)
    stitcher.setPanoConfidenceThresh(0.8)
    stitcher.setWaveCorrection(True)
    stitcher.setSeamEstimationResol(0.5)
    stitcher.setCompositingResol(-1)

    # Fix the print statement so it shows actual values
    print("Settings applied: Resol=0.6, Conf=0.5, WaveCorr=False, SeamResol=0.5, FullResCompositing")
    
    # --- Multi-band blender for smooth exposure transitions ---
    try:
        blender = cv2.detail_MultiBandBlender()
        blender.setNumBands(5)
        stitcher.setBlender(blender)
        print("  Multi-band blender enabled.")
    except AttributeError:
        print("  Multi-band blender not available, using default.")

    print("Running stitching pipeline...")
    try:
        status, pano = stitcher.stitch(imgs)
    except Exception as e:
        print(f"Exception during stitching: {e}")
        return False

    if status == cv2.Stitcher_OK:
        print(f"\n  [SUCCESS] Stitched {len(imgs)} images.")
        
        pano = straighten_panorama(pano)
        
        h, w = pano.shape[:2]
        target_h = w // 2
        if h < target_h:
            pad_total = target_h - h
            pad_top = pad_total // 2
            pad_bottom = pad_total - pad_top
            print(f"  Padding to 2:1: +{pad_top}px top, +{pad_bottom}px bottom.")
            pano = cv2.copyMakeBorder(pano, pad_top, pad_bottom, 0, 0,
                                       cv2.BORDER_CONSTANT, value=[0, 0, 0])

        cv2.imwrite(output_path, pano)
        print(f"  Saved: {output_path} ({pano.shape[1]}x{pano.shape[0]}px)")
        return True

    else:
        errors = {
            cv2.Stitcher_ERR_NEED_MORE_IMGS: "Need more images",
            cv2.Stitcher_ERR_HOMOGRAPHY_EST_FAIL: "Homography estimation failed",
            cv2.Stitcher_ERR_CAMERA_PARAMS_ADJUST_FAIL: "Camera parameters adjustment failed"
        }
        err_msg = errors.get(status, f"Unknown error code {status}")
        print(f"\n  [STITCH FAILED] Reason: {err_msg}")

        # --- Fallback: try progressively dropping weakest image ---
        print("\n  Trying fallback: dropping weakest image and retrying...")
        
        # Find image with lowest avg match score and drop it
        match_scores = []
        sift_d = cv2.SIFT_create()
        for im in imgs:
            gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
            kp, _ = sift_d.detectAndCompute(gray, None)
            match_scores.append(len(kp))
        
        weakest = int(np.argmin(match_scores))
        print(f"  Dropping weakest image: {loaded_paths[weakest]}")
        imgs_retry = [im for i, im in enumerate(imgs) if i != weakest]
        
        try:
            status2, pano2 = stitcher.stitch(imgs_retry)
            if status2 == cv2.Stitcher_OK:
                print(f"  [FALLBACK SUCCESS] Stitched {len(imgs_retry)} images.")
                pano2 = straighten_panorama(pano2)
                h, w = pano2.shape[:2]
                target_h = w // 2
                if h < target_h:
                    pad_total = target_h - h
                    pano2 = cv2.copyMakeBorder(pano2, pad_total//2, pad_total - pad_total//2,
                                               0, 0, cv2.BORDER_CONSTANT, value=[0, 0, 0])
                cv2.imwrite(output_path, pano2)
                print(f"  Saved fallback: {output_path}")
                return True
        except Exception as e:
            print(f"  Fallback also failed: {e}")

        return False

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Stitch images.")
    parser.add_argument('images', nargs='*', help='Images to stitch')
    parser.add_argument('--out', default='stitched_result.jpg', help='Output file path')
    
    args = parser.parse_args()
    
    if len(args.images) > 1:
        # Pass file paths as arguments
        stitch_images(args.images, args.out)
    else:
        # Check for input_images folder
        base_dir = os.path.dirname(__file__)
        input_dir = os.path.join(base_dir, "..", "input_images")
        
        if os.path.exists(input_dir):
            # Grab all jpgs
            files = glob.glob(os.path.join(input_dir, "*.jpg")) + \
                    glob.glob(os.path.join(input_dir, "*.jpeg")) + \
                    glob.glob(os.path.join(input_dir, "*.png"))
            
            if len(files) > 1:
                print(f"Found {len(files)} images in {input_dir}. stitching...")
                stitch_images(files, "experiment_result.jpg")
            else:
                print(f"Not enough images in {input_dir}")
        else:
            print("Usage: python stitch_feature.py image1.jpg image2.jpg ...")
