"use client";

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Float, 
  MeshDistortMaterial, 
  Sphere,
  Environment,
  ContactShadows
} from '@react-three/drei';
import * as THREE from 'three';

const GlobeMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Subtle rotation for "living" feel
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group>
      {/* Outer Atmospheric Glow */}
      <Sphere args={[2.2, 64, 64]}>
        <meshBasicMaterial 
          color="#00F0FF" 
          transparent 
          opacity={0.05} 
          side={THREE.BackSide} 
        />
      </Sphere>

      {/* Main Ocean Sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <MeshDistortMaterial
          color="#142546"
          roughness={0.1}
          metalness={0.8}
          distort={0.1}
          speed={2}
          emissive="#3A86FF"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Inner Data Core (Glow) */}
      <Sphere args={[1.8, 32, 32]}>
        <meshBasicMaterial color="#00F0FF" transparent opacity={0.1} wireframe />
      </Sphere>
    </group>
  );
};

export function OceanGlobe() {
  return (
    <div className="w-full h-full relative cursor-grab active:cursor-grabbing">
      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={45} />
        <OrbitControls 
          enablePan={false} 
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 3}
        />
        
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#00F0FF" />
        <spotLight position={[-10, 20, 10]} angle={0.15} penumbra={1} intensity={2} color="#3A86FF" />

        <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
          <GlobeMesh />
        </Float>

        <Environment preset="city" />
        <ContactShadows 
          position={[0, -3, 0]} 
          opacity={0.4} 
          scale={10} 
          blur={2.5} 
          far={4} 
        />
      </Canvas>

      {/* Overlay UI */}
      <div className="absolute top-8 left-8 p-6 glass-card rounded-2xl max-w-xs pointer-events-none">
        <h2 className="text-xl font-display font-medium text-white mb-2">Fleet Deployment</h2>
        <div className="flex items-center gap-2 text-argo-cyan text-sm font-mono mb-4">
          <div className="w-2 h-2 rounded-full bg-argo-cyan animate-ping" />
          ARGO ACTIVE: 14,242 FLOATS
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Real-time visualization of global oceanic sensor network. Monitoring salinity, 
          temperature and oxygen profiles since 1999.
        </p>
      </div>
    </div>
  );
}
