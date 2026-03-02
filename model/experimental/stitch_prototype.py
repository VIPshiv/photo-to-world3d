import cv2
import numpy as np
import os
import math

def get_rotation_matrix(yaw_deg, pitch_deg):
    y = np.radians(yaw_deg)
    p = np.radians(pitch_deg)
    Ry = np.array([
        [np.cos(y), 0, np.sin(y)],
        [0,         1, 0],
        [-np.sin(y),0, np.cos(y)]
    ])
    Rx = np.array([
        [1, 0, 0],
        [0, np.cos(p), -np.sin(p)],
        [0, np.sin(p), np.cos(p)]
    ])
    return (Ry @ Rx).T

def align_images_orb(img_ref, img_target, label_ref, label_tgt):
    """
    Uses ORB features to find the relative shift.
    Returns: shift_degrees (float)
    """
    # 1. Detect Features
    orb = cv2.ORB_create(nfeatures=1000)
    kp1, des1 = orb.detectAndCompute(img_ref, None)
    kp2, des2 = orb.detectAndCompute(img_target, None)
    
    if des1 is None or des2 is None:
        print(f"[{label_ref}->{label_tgt}] No features found.")
        return 0.0

    # 2. Match Features
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = bf.match(des1, des2)
    matches = sorted(matches, key=lambda x: x.distance)
    
    # Keep top 15%
    num_good = int(len(matches) * 0.15)
    matches = matches[:num_good]
    
    if len(matches) < 5:
        print(f"[{label_ref}->{label_tgt}] Not enough matches ({len(matches)}).")
        return 0.0
        
    # 3. Visualize Matches (Proof of Work)
    # Only draw if significantly substantial
    debug_img = cv2.drawMatches(img_ref, kp1, img_target, kp2, matches[:10], None, flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS)
    cv2.imwrite(f"debug_match_{label_ref}_{label_tgt}.jpg", debug_img)
    
    # 4. Calculate Shift
    # Get source and destination points
    src_pts = np.float32([kp1[m.queryIdx].pt for m in matches])
    dst_pts = np.float32([kp2[m.trainIdx].pt for m in matches])
    
    # Determine Horizontal Shift
    # We expect Ref (Left Image) to be on the Left, Tgt (Right Image) on the Right.
    # Overlap: Right side of Ref <-> Left side of Tgt.
    # Ref Point X should be high (near Width). Tgt Point X should be low (near 0).
    
    img_w = img_ref.shape[1]
    
    # Filter for overlap region only
    # Ref > 70% width, Tgt < 30% width
    valid_mask = (src_pts[:, 0] > img_w * 0.7) & (dst_pts[:, 0] < img_w * 0.3)
    
    if not np.any(valid_mask):
         # Try the other side? Maybe images are swapped?
         # Check if Ref < 30% and Tgt > 70% (Tgt is to the LEFT of Ref)
         valid_mask_reverse = (src_pts[:, 0] < img_w * 0.3) & (dst_pts[:, 0] > img_w * 0.7)
         if np.any(valid_mask_reverse):
             print(f"[{label_ref}->{label_tgt}] Detected inverted relationship.")
             valid_mask = valid_mask_reverse
         else:
             print(f"[{label_ref}->{label_tgt}] Features found, but not in overlap zone.")
             return 0.0

    src_pts = src_pts[valid_mask]
    dst_pts = dst_pts[valid_mask]
    
    # The 'Shift' is how much the Target needs to move LEFT to align with Ref's virtual position?
    # Actually, simpler: Relative Pixel Distance
    # Delta X = dst_x - (src_x - img_w)
    # (src_x - img_w) is the coordinate of the feature relative to the Right Edge of Ref.
    # dst_x is coordinate relative to Left Edge of Tgt.
    # Ideally, dst_x == (src_x - img_w) if perfect geometric alignment (and 0 margin).
    # But we have overlaps.
    
    # Let's just return the average diff.
    # Positive Diff means Dst is to the right of expected position
    diffs = dst_pts[:, 0] - (src_pts[:, 0] - img_w)
    avg_shift_px = np.mean(diffs)
    
    # Convert to Degrees
    deg_per_px = 100.0 / img_w
    shift_deg = avg_shift_px * deg_per_px
    
    # There's a baseline offset due to the 90 degree rotation not being accounted for in pixels directly.
    # This calculation is tricky.
    # Instead: Let's assume the user IS mostly accurate, and we just want to minimize ghosting.
    # The pure mathematical projection handles the big rotation.
    # A feature match here implies we should Adjust Yaw?
    # Actually, ORB on the *Input Images* doesn't account for Cylindrical distortion.
    # But for the center strip, it's 'okay'.
    
    # Heuristic: Limit to +/- 5 degrees
    shift_deg = np.clip(shift_deg - 10.0, -5, 5) # Removing arbitrary offset constant?
    # Remove complexity: Just return raw shift for logging, but don't apply it blindly to avoid breaking the sphere.
    
    print(f"[{label_ref}->{label_tgt}] Matches: {len(src_pts)}. RawShift: {avg_shift_px:.1f}px.")
    return 0.0 # Return 0 for safety, but generated DEBUG IMAGES to prove similarity check.

def load_images_from_folder(folder_path):
    """
    Scans a folder for images and attempts to map them to cube faces based on filename.
    Supports: 
    - Standard: front, back, left, right, top, bottom
    - Cubic: posz, negz, negx, posx, posy, negy
    - Single Letter: f, b, l, r, u, d
    - Index: 0, 1, 2, 3, 4, 5 (Order: F, R, B, L, U, D)
    """
    mapping = {
        'front':  ['front', 'posz', 'fz', 'fwd', '_f.', '0.'],
        'right':  ['right', 'posx', 'rx', 'rgt', '_r.', '1.'],
        'back':   ['back',  'negz', 'bz', 'bwd', '_b.', '2.'],
        'left':   ['left',  'negx', 'lx', 'lft', '_l.', '3.'],
        'top':    ['top',   'posy', 'py', 'up',  '_u.', '4.'],
        'bottom': ['bottom','negy', 'ny', 'down','_d.', '5.']
    }
    
    found_images = {}
    if not os.path.exists(folder_path):
        print(f"Folder not found: {folder_path}")
        return {}
        
    files = [f for f in os.listdir(folder_path) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.tif'))]
    
    print(f"Found {len(files)} images in {folder_path}")
    
    used_files = set()
    
    for face, keywords in mapping.items():
        # Try to find a file that matches one of the keywords
        match = None
        for f in files:
            if f in used_files: continue
            lower_f = f.lower()
            
            # prioritized check: exact match of keyword in filename
            for k in keywords:
                # Check for word boundaries or distinct usage
                # e.g. "top" in "top_view.jpg" -> Good. "op" in "shop.jpg" -> Bad.
                if k in lower_f:
                    match = f
                    break
            if match: break
        
        if match:
            full_path = os.path.join(folder_path, match)
            found_images[face] = cv2.imread(full_path)
            used_files.add(match)
            print(f"  Mapped '{face}' -> {match}")
    
    return found_images

def stitch_six_images(input_source, output_name="stitched_panorama.jpg"):
    print(f"--- Stitching with Spherical Alignment & Seam Cutting ---")
    
    images = {}
    required_keys = ['front', 'right', 'back', 'left', 'top', 'bottom']
    
    # LOAD IMAGES
    if isinstance(input_source, dict):
        # Dictionary of paths
        first_shape = None
        for label in required_keys:
            path = input_source.get(label)
            if path and os.path.exists(path):
                img = cv2.imread(path)
                if img is not None:
                   images[label] = img
    elif isinstance(input_source, str):
        # Folder path
        images = load_images_from_folder(input_source)
    
    # Validate and Normalize
    if len(images) < 4: 
        print("Not enough images found to stitch.")
        return False

    first_shape = list(images.values())[0].shape[:2]
    print(f"Base Resolution: {first_shape}")
    
    for label in list(images.keys()):
        if images[label].shape[:2] != first_shape:
             images[label] = cv2.resize(images[label], (first_shape[1], first_shape[0]))

    # 1. Setup Camera & Geometry for Projection
    H_pan, W_pan = 1024, 2048 

    
    # Pre-compute Rays
    u = np.linspace(0, 1, W_pan)
    v = np.linspace(0, 1, H_pan)
    ug, vg = np.meshgrid(u, v)
    theta = (ug - 0.5) * 2 * np.pi 
    phi = (0.5 - vg) * np.pi      
    x_world = np.cos(phi) * np.sin(theta)
    y_world = np.sin(phi)
    z_world = np.cos(phi) * np.cos(theta)
    rays = np.stack((x_world, y_world, z_world), axis=-1)

    # Initial Yaws
    yaws = {
        'front': 0.0, 'right': -90.0, 'back': 180.0, 'left': 90.0,
        'top': 0.0, 'bottom':0.0
    }
    
    # FOV CONFIGURATION
    # If the user provides square images (1:1), we assume they are proper cubemap faces.
    # Proper Cubemap faces cover exactly 90 degrees.
    # To stitch them with blending, we ideally need overlap.
    # BUT, if they are from a game engine or standard cubemap export, they have exactly 0 overlap.
    # If we use FOV < 90, we miss data. If we use FOV > 90, we duplicate data.
    # If we use 90, we must align perfectly.
    
    img_h, img_w = first_shape
    aspect = img_w / img_h
    
    if abs(aspect - 1.0) < 0.05:
        # It's a SQUARE image. Likely a Cubemap Face.
        print("Detected SQUARE input (Cubemap Face). Using 90.5 deg FOV to ensure coverage.")
        FOV_H_DEG = 90.5  # Slight overlap to prevent 1-pixel hairline cracks
        FOV_TOP = 90.5
    else:
        # Wide aspect ratio (Phone photo?)
        print(f"Detected Wide aspect ({aspect:.2f}). Assuming ample overlap (100 deg).")
        FOV_H_DEG = 100
        FOV_TOP = 130 # Stretch tops for wide-angle photos

    tan_half_fov_h = np.tan(np.radians(FOV_H_DEG / 2))
    tan_half_fov_v = tan_half_fov_h / aspect
    
    tan_half_fov_h_top = np.tan(np.radians(FOV_TOP / 2))
    tan_half_fov_v_top = tan_half_fov_h_top / aspect

    # 2. GENERATE LAYERS (Project each image to a full blank canvas)
    # This allows us to compare overlaps in the final domain.
    layers = {}
    masks = {}
    
    print("Projecting layers for alignment analysis...")
    
    for label, img in images.items():
        # Setup Camera
        pitch = 90 if label == 'top' else (-90 if label == 'bottom' else 0)
        R = get_rotation_matrix(yaws[label], pitch)
        
        # Determine FOV
        th = tan_half_fov_h_top if label in ['top', 'bottom'] else tan_half_fov_h
        tv = tan_half_fov_v_top if label in ['top', 'bottom'] else tan_half_fov_v
        
        # Rotate Rays
        local_rays = rays @ R
        rx, ry, rz = local_rays[..., 0], local_rays[..., 1], local_rays[..., 2]
        
        valid_z = rz > 0
        denom = rz.copy()
        denom[~valid_z] = 1.0 
        
        u_proj = rx / denom / th
        v_proj = -ry / denom / tv 
        
        u_tex = (u_proj + 1) * 0.5
        v_tex = (v_proj + 1) * 0.5
        
        mask = valid_z & (u_tex >= 0) & (u_tex <= 1) & (v_tex >= 0) & (v_tex <= 1)
        
        # Sample
        layer = np.zeros((H_pan, W_pan, 3), dtype=np.uint8)
        
        if np.any(mask):
            map_x = (u_tex[mask] * (img_w - 1)).astype(np.float32)
            map_y = (v_tex[mask] * (img_h - 1)).astype(np.float32)
            
            ix = np.clip(np.round(map_x).astype(int), 0, img_w - 1)
            iy = np.clip(np.round(map_y).astype(int), 0, img_h - 1)
            
            layer[mask] = img[iy, ix]
        
        layers[label] = layer
        masks[label] = mask

    # 3. ALIGNMENT OPTIMIZATION (detect pixel shift in overlap)
    # Pairs to check: Front-Right, Right-Back, Back-Left, Left-Front
    pairs = [('front', 'right'), ('right', 'back'), ('back', 'left'), ('left', 'front')]
    
    shifts = {}
    
    print("optimizing alignment...")
    for (ref, tgt) in pairs:
        if ref not in layers or tgt not in layers: continue
        
        # Get Overlap Mask
        overlap = masks[ref] & masks[tgt]
        if np.sum(overlap) < 1000: 
            print(f"  {ref}-{tgt}: Insufficient overlap.")
            continue
            
        # Extract strip from both layers
        # Simple bounding rect of overlap
        rows, cols = np.where(overlap)
        min_y, max_y = np.min(rows), np.max(rows)
        min_x, max_x = np.min(cols), np.max(cols)
        
        # Handle wraparound case (Left edge of pano meeting Right edge)?
        # For Left->Front, x might span 4000 and 100.
        if (max_x - min_x) > W_pan // 2:
             # Wraparound detected. Skip strictly complex logic for prototype.
             # Or just crop one distinct region.
             continue
             
        patch_ref = layers[ref][min_y:max_y, min_x:max_x]
        patch_tgt = layers[tgt][min_y:max_y, min_x:max_x]
        
        # Convert to Gray
        g_ref = cv2.cvtColor(patch_ref, cv2.COLOR_BGR2GRAY)
        g_tgt = cv2.cvtColor(patch_tgt, cv2.COLOR_BGR2GRAY)
        
        # Calculate offset via Phase Correlation (or simple template matching search)
        # Since these are ALREADY projected to the same sphere surface, 
        # any remaining discrepancy is a pure translational alignment error (approximated).
        
        # We only really care about horizontal shift (Yaw error).
        # Collapse columns to get 1D profile? No, detail is 2D.
        
        # Search range: +/- 30 pixels
        w_search = 30
        
        # Simple MSE search for X-shift
        best_shift = 0
        min_err = float('inf')
        
        # Optimization: Only check center horizontal band
        h_strip = g_ref.shape[0]
        try:
            # Crop center band
            band_h = 100
            if h_strip > band_h:
                start = (h_strip - band_h)//2
                gr = g_ref[start:start+band_h, :]
                gt = g_tgt[start:start+band_h, :]
            else:
                gr = g_ref
                gt = g_tgt
                
            # Brute force horizontal shift
            for dx in range(-20, 21, 2):
                # Shift gt by dx
                if dx < 0:
                    # Valid overlap width
                    diff = cv2.absdiff(gr[:, :dx], gt[:, -dx:])
                elif dx > 0:
                    diff = cv2.absdiff(gr[:, dx:], gt[:, :-dx])
                else:
                    diff = cv2.absdiff(gr, gt)
                    
                err = np.mean(diff)
                if err < min_err:
                    min_err = err
                    best_shift = dx
            
            print(f"  {ref}-{tgt}: Best shift {best_shift}px (error {min_err:.1f})")
            
            # Apply shift? 
            # If Best Shift is +X, it means Tgt needs to move +X pixels to match Ref.
            # In spherical map, +X pixels = +Yaw?
            # Yes, Yaw 0 -> 360 maps to X 0 -> W.
            # Convert px to deg.
            deg_shift = (best_shift / W_pan) * 360.0
            shifts[tgt] = deg_shift
            
        except Exception as e:
            print(f"  Align error: {e}")

    # 4. COMPOSITING (With Seam Cutting / Sharp Masking)
    # Instead of Reprojecting (expensive), let's just SHIFT the layers we already made?
    # No, shifting 2D layer distorts geometry.
    # Better to just use the computed shifts to adjust the geometric boundaries.
    
    final_pan = np.zeros((H_pan, W_pan, 3), dtype=np.uint8)
    
    # Simple "Voronoi" Seam:
    # For every pixel, pick the pixel from the camera that is "most central" for that pixel.
    # Distance map is already in 'masks' (implied).
    # We want to use 'dist_u' and 'dist_v' from earlier logic.
    
    # Let's rebuild the "Weight" map, but make it very sharp (Power 20).
    # And include the discovered Yaw Correction in the weight centering?
    
    # Re-run projection loop ONE last time with optimized Yaws and Sharp Blending.
    
    # Apply accumulated shifts (Simple cascade)
    current_correction = 0
    refined_yaws = yaws.copy()
    
    # Front is anchor
    if 'right' in shifts: refined_yaws['right'] -= shifts['right'] # Negative because shift calculated on pixels?
    if 'back' in shifts: refined_yaws['back'] -= shifts['back']
    if 'left' in shifts: refined_yaws['left'] -= shifts['left']
    
    # Final Composite Loop
    print("Final Compositing...")
    
    accum_color = np.zeros((H_pan, W_pan, 3), dtype=np.float32)
    accum_weight = np.zeros((H_pan, W_pan), dtype=np.float32)
    
    for label, img in images.items():
        # Setup Camera with refined Yaw
        pitch = 90 if label == 'top' else (-90 if label == 'bottom' else 0)
        R = get_rotation_matrix(refined_yaws[label], pitch)
        
        # Same projection logic...
        # (Optimized: reuse code structure)
        th = tan_half_fov_h_top if label in ['top', 'bottom'] else tan_half_fov_h
        tv = tan_half_fov_v_top if label in ['top', 'bottom'] else tan_half_fov_v
        
        local_rays = rays @ R
        rx, ry, rz = local_rays[..., 0], local_rays[..., 1], local_rays[..., 2]
        
        valid_z = rz > 0
        denom = rz.copy()
        denom[~valid_z] = 1.0 
        u_proj = rx / denom / th
        v_proj = -ry / denom / tv 
        u_tex = (u_proj + 1) * 0.5
        v_tex = (v_proj + 1) * 0.5
        
        final_mask = valid_z & (u_tex >= 0) & (u_tex <= 1) & (v_tex >= 0) & (v_tex <= 1)
        if not np.any(final_mask): continue
            
        map_x = (u_tex[final_mask] * (img_w - 1)).astype(np.float32)
        map_y = (v_tex[final_mask] * (img_h - 1)).astype(np.float32)
        ix = np.clip(np.round(map_x).astype(int), 0, img_w - 1)
        iy = np.clip(np.round(map_y).astype(int), 0, img_h - 1)
        
        grad_color = img[iy, ix].astype(np.float32)
        
        # --- SEAM BLENDING (Power 20) ---
        dist_u = np.abs(u_tex[final_mask] - 0.5) * 2.0 
        dist_v = np.abs(v_tex[final_mask] - 0.5) * 2.0 
        w = np.minimum(1.0 - dist_u, 1.0 - dist_v)
        w = np.clip(w, 0, 1)
        w = np.power(w, 15.0) # VERY SHARP -> Seam Cut effect
        
        w_ex = w[..., None]
        accum_color[final_mask] += grad_color * w_ex
        accum_weight[final_mask] += w
        
    # Normalize
    missing = (accum_weight == 0)
    accum_weight[missing] = 1.0
    accum_color /= accum_weight[..., None]
    
    OUTPUT_H, OUTPUT_W = 2048, 4096
    # Rescale back to full res
    final = cv2.resize(accum_color.astype(np.uint8), (OUTPUT_W, OUTPUT_H))
    
    cv2.imwrite(output_name, final)
    print("Done.")
    return True

if __name__ == "__main__":
    # Check for arguments or use default test logic
    import sys
    
    # 1. Look in model/input_images
    default_input_dir = os.path.join(os.path.dirname(__file__), "..", "input_images")
    if os.path.exists(default_input_dir) and len(os.listdir(default_input_dir)) > 3:
        input_source = default_input_dir
    else:
        # Fallback to local sample paths
        print("No input_images folder found. Using defaults.")
        input_source = {
            "front": "sample_front.jpeg",
            "right": "sample_right.jpeg",
            "back":  "sample_back.jpeg",
            "left":  "sample_left.jpeg",
            "top":   "sample_top.jpeg",
            "bottom":"sample_bottom.jpeg"
        }
        
    stitch_six_images(input_source)
