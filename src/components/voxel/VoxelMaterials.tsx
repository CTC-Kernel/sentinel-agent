
import React from 'react';
import { Edges } from '@react-three/drei';
import { DoubleSide } from 'three';

export const EdgesWithColor: React.FC<{ color: string }> = React.memo(({ color }) => (
    <Edges threshold={15} color={color} opacity={0.5} transparent />
));

export const GlassMaterial: React.FC<React.ComponentProps<'meshPhysicalMaterial'> & { isDimmed?: boolean; isHighlighted?: boolean }> = ({ color, emissive, isDimmed, isHighlighted, ...props }) => (
    <meshPhysicalMaterial
        color={isDimmed ? '#1e293b' : isHighlighted ? '#ffffff' : color}
        emissive={isDimmed ? '#000000' : isHighlighted ? color : emissive}
        emissiveIntensity={isDimmed ? 0 : isHighlighted ? 1.8 : 0.6}
        roughness={isDimmed ? 0.9 : 0.15}
        metalness={isDimmed ? 0.1 : 0.1}
        transmission={isDimmed ? 0 : 0.9}
        thickness={isDimmed ? 0 : 2}
        ior={1.5}
        clearcoat={isDimmed ? 0 : 1}
        clearcoatRoughness={0.1}
        transparent
        opacity={isDimmed ? 0.1 : 1}
        side={DoubleSide}
        {...props}
    />
);
