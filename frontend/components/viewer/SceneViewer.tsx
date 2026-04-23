'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { apiUrl } from '@/lib/api';

interface SceneProps {
  imageUrl: string; 
  hotspots: Hotspot[]; 
}

interface Hotspot {
  id: string;
  yaw: number;
  pitch: number;
  label: string;
  product?: {
    id: string;
    title: string;
    price: number | string;
    mainImageUrl?: string;
    description?: string;
    externalLink?: string;
  };
}

export default function SceneViewer({ imageUrl, hotspots, height = '100vh' }: SceneProps & { height?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Setup Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const container = containerRef.current;
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 0.1); // Inside the sphere

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.display = 'block'; // Prevent scrollbars
    container.innerHTML = ''; // Clean up previous
    container.appendChild(renderer.domElement);

    // 2. The "World" (Sphere)
    // Radius=500, with 60 segments for smoothness
    // scale(-1, 1, 1) flips it inside out so we see the image from inside!
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1); 

    const texture = new THREE.TextureLoader().load(imageUrl);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // 3. Add Hotspots
    hotspots.forEach(h => {
      // Convert Yaw/Pitch to 3D Vector (x, y, z)
      // This is the "Magic Math" to place items on the globe surface
      const radius = 450; // Slightly inside the 500 sphere
      const phi = THREE.MathUtils.degToRad(90 - h.pitch);
      const theta = THREE.MathUtils.degToRad(h.yaw);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      // Create a simple marker (red box for now)
      const markerGeo = new THREE.SphereGeometry(15, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xff4500 }); // Orange-Red
      const marker = new THREE.Mesh(markerGeo, markerMat);
      
      marker.position.set(x, y, z);
      
      // Add data to the user data for raycasting
      marker.userData = h;
      
      marker.lookAt(0, 0, 0); 
      scene.add(marker);
    });

    // 4. Manual Controls (Basic Mouse Drag) & Raycasting (Click)
    let isDragging = false;
    let pointerMoved = false;
    let long = 0, lat = 0;
    let savedX = 0, savedY = 0;
    const dragThreshold = 4;

    // Raycaster for clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const updateCamera = () => {
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(long);
      const tx = 500 * Math.sin(phi) * Math.cos(theta);
      const ty = 500 * Math.cos(phi);
      const tz = 500 * Math.sin(phi) * Math.sin(theta);
      camera.lookAt(tx, ty, tz);
    };

    const updateRendererSize = () => {
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const getPointerPosition = (event: MouseEvent | PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      };
    };

    const selectHotspotAtPointer = (event: MouseEvent | PointerEvent) => {
      const position = getPointerPosition(event);
      mouse.x = position.x;
      mouse.y = position.y;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, false);

      for (const intersect of intersects) {
        // Our markers will have a label. Wait, if it doesn't have an ID (e.g. preview mode), 
        // fallback to checking if it has a label so we don't accidentally select the huge background sphere.
        if (intersect.object.userData && (intersect.object.userData.id || intersect.object.userData.label)) {
          setSelectedHotspot(intersect.object.userData as Hotspot);
          break;
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDragging = true;
      pointerMoved = false;
      savedX = e.clientX;
      savedY = e.clientY;
      renderer.domElement.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - savedX;
      const deltaY = e.clientY - savedY;
      if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
        pointerMoved = true;
      }
      savedX = e.clientX;
      savedY = e.clientY;

      long = (long - deltaX * 0.12) % 360;
      lat = Math.max(-85, Math.min(85, lat + deltaY * 0.12));
      
      updateCamera();
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      try {
        renderer.domElement.releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore release failures
      }

      if (!pointerMoved) {
        selectHotspotAtPointer(e);
      }
    };

    const onPointerCancel = () => {
      isDragging = false;
      pointerMoved = false;
    };

    const onResize = () => {
      updateRendererSize();
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('resize', onResize);

    updateRendererSize();
    updateCamera();

    // Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('resize', onResize);
      
      // Dispose WebGL Context to prevent "Context Loss" errors
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      
      // Clean up DOM
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [imageUrl, hotspots]);

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden', touchAction: 'none' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      
      {selectedHotspot && (
        <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255,255,255,0.95)',
            padding: '18px',
            borderRadius: '14px',
            width: 'min(320px, calc(100vw - 32px))',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            zIndex: 10,
            backdropFilter: 'blur(10px)',
            color: '#333'
          }}>
            <button 
              onClick={() => setSelectedHotspot(null)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                border: 'none',
                background: 'transparent',
                fontSize: '20px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
            
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 'bold' }}>
              {selectedHotspot.product?.title || selectedHotspot.label}
            </h3>
            
            {selectedHotspot.product?.mainImageUrl ? (
              <div style={{
                width: '100%',
                height: 'clamp(140px, 28vh, 200px)',
                marginBottom: '15px',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#f5f5f5'
              }}>
                <img 
                  src={apiUrl(selectedHotspot.product.mainImageUrl)}
                  alt={selectedHotspot.product.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                     (e.currentTarget as HTMLImageElement).parentElement!.innerHTML = `<div style="padding:20px; color:red">Failed to load image</div>`;
                  }}
                />
              </div>
            ) : (
                <div style={{ color: 'red', fontSize: '12px' }}>
                  DEBUG: No mainImageUrl found! Keys: {Object.keys(selectedHotspot.product || {}).join(', ')}
                </div>
            )}
            
            {selectedHotspot.product?.price && (
              <p style={{ 
                fontSize: '20px', 
                color: '#007bff', 
                fontWeight: 'bold', 
                margin: '0 0 10px 0' 
              }}>
                ${Number(selectedHotspot.product.price).toFixed(2)}
              </p>
            )}

            {selectedHotspot.product?.description && (
              <p style={{ color: '#555', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
                {selectedHotspot.product.description}
              </p>
            )}
            
            {!selectedHotspot.product && (
              <p style={{ color: '#666', fontStyle: 'italic', fontSize: '14px' }}>
                Detected Object: {selectedHotspot.label}
              </p>
            )}

            {selectedHotspot.product?.externalLink && (
              <div style={{ marginTop: '15px' }}>
                <a 
                  href={selectedHotspot.product.externalLink.startsWith('http') ? selectedHotspot.product.externalLink : `https://${selectedHotspot.product.externalLink}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    backgroundColor: '#000',
                    color: '#fff',
                    textAlign: 'center',
                    padding: '12px 10px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#000'}
                >
                  Explore / View Options &rarr;
                </a>
              </div>
            )}
          </div>
      )}
    </div>
  );
}
