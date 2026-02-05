import React from 'react';
import { Edges } from '@react-three/drei';
import { DoubleSide } from 'three';

export const EdgesWithColor: React.FC<{ color: string }> = React.memo(({ color }) => (
 <Edges threshold={15} color={color} opacity={0.4} transparent />
));

export const GlassMaterial: React.FC<React.ComponentProps<'meshPhysicalMaterial'> & { isDimmed?: boolean; isHighlighted?: boolean }> = React.memo(({ color, emissive, isDimmed, isHighlighted, ...props }) => {
 // Premium "Cyber-Glass" aesthetics
 const opacity = isDimmed ? 0.1 : 0.6; // Slightly more transparent base
 const roughness = isDimmed ? 0.8 : 0.1; // Smoother
 const metalness = isDimmed ? 0.1 : 0.6; // More metallic for reflections
 const transmission = isDimmed ? 0 : 0.95; // High transmission for glass
 const thickness = isDimmed ? 0 : 3.5; // Thicker glass look

 return (
 <meshPhysicalMaterial
 color={isDimmed ? '#0f172a' : isHighlighted ? '#ffffff' : color}
 emissive={isDimmed ? '#000000' : isHighlighted ? color : emissive}
 emissiveIntensity={isDimmed ? 0 : isHighlighted ? 2.5 : 0.8} // Higher emissive for "neon" feel
 roughness={roughness}
 metalness={metalness}
 transmission={transmission}
 thickness={thickness}
 ior={1.7} // Higher index of refraction for more "crystal" look
 clearcoat={isDimmed ? 0 : 1}
 clearcoatRoughness={0.1}
 attenuationColor={typeof color === 'string' ? color : "#ffffff"} // Tint the glass volume
 attenuationDistance={10}
 transparent
 opacity={opacity}
 side={DoubleSide}
 {...props}
 />
 );
});
