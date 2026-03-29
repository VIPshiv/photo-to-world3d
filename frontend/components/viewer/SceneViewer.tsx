'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

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

export default function SceneViewer({ imageUrl, hotspots }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Setup Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 0.1); // Inside the sphere

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.display = 'block'; // Prevent scrollbars
    containerRef.current.innerHTML = ''; // Clean up previous
    containerRef.current.appendChild(renderer.domElement);

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
    let long = 0, lat = 0;
    let savedX = 0, savedY = 0;

    // Raycaster for clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      savedX = e.clientX;
      savedY = e.clientY;
    };

    const onClick = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children);

      for (const intersect of intersects) {
        if (intersect.object.userData.id) {
            setSelectedHotspot(intersect.object.userData as Hotspot);
            break;
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - savedX;
      const deltaY = e.clientY - savedY;
      savedX = e.clientX;
      savedY = e.clientY;

      long = (long - deltaX * 0.1) % 360;
      lat = Math.max(-85, Math.min(85, lat + deltaY * 0.1));
      
      updateCamera();
    };

    const onMouseUp = () => { isDragging = false; };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('click', onClick);

    const updateCamera = () => {
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(long);
      
      const tx = 500 * Math.sin(phi) * Math.cos(theta);
      const ty = 500 * Math.cos(phi);
      const tz = 500 * Math.sin(phi) * Math.sin(theta);
      
      camera.lookAt(tx, ty, tz);
    };

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
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('click', onClick);
      
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
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      
      {selectedHotspot && (
        <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255,255,255,0.95)',
            padding: '20px',
            borderRadius: '12px',
            maxWidth: '320px',
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
            
            {selectedHotspot.product?.mainImageUrl && (
              <div style={{
                width: '100%',
                height: '200px',
                marginBottom: '15px',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#f5f5f5'
              }}>
                <img 
                  src={`http://localhost:3001${selectedHotspot.product.mainImageUrl}`}
                  alt={selectedHotspot.product.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
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
              <a 
                href={selectedHotspot.product.externalLink} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  marginTop: '15px',
                  backgroundColor: '#000',
                  color: '#fff',
                  textAlign: 'center',
                  padding: '10px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Explore &rarr;
              </a>
            )}
          </div>
      )}
    </div>
  );
}
