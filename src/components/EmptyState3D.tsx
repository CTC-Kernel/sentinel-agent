
import React from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';

export const EmptyState3D: React.FC = () => {
 useThree();

 return (
 <group>
 <gridHelper args={[20, 20, 0x1e293b, 0x0f172a]} position={[0, -10, 0]} />
 <Html center position={[0, 0, 0]}>
 <div className="flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none">
  <div className="w-16 h-16 mb-4 rounded-full bg-muted/50 backdrop-blur border border-border flex items-center justify-center animate-pulse">
  <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
  </div>
  <h3 className="text-lg font-bold text-muted-foreground">Aucune donnée 3D</h3>
  <p className="text-sm text-muted-foreground max-w-xs mt-1">
  L'environnement Voxel est prêt, mais aucune donnée n'est disponible pour le moment.
  </p>
 </div>
 </Html>
 </group>
 );
};
