import React, { useMemo } from 'react';
import { ShieldAlert, Server, CheckCircle2 } from './ui/Icons';
import { useRelationshipsData } from '../hooks/relationships/useRelationshipsData';

interface RelationshipGraphProps {
    rootId: string;
    rootType: 'Asset' | 'Risk';
    width?: number;
    height?: number;
}

export const RelationshipGraph = React.memo<RelationshipGraphProps>(({ rootId, rootType, width = 800, height = 600 }) => {
    const { nodes, links, loading } = useRelationshipsData(rootId, rootType, width, height);
    const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

    if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full"></div></div>;

    return (
        <div className="w-full h-full overflow-hidden bg-card/40 backdrop-blur-sm rounded-3xl border border-border/60 relative shadow-inner">
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="cursor-grab active:cursor-grabbing">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--muted-foreground) / 0.55)" />
                    </marker>
                </defs>

                {/* Links */}
                {links.map((link) => {
                    const source = nodeMap.get(link.source);
                    const target = nodeMap.get(link.target);
                    if (!source || !target) return null;
                    return (
                        <line
                            key={`${link.source || 'unknown'}-${link.target}`}
                            x1={source.x}
                            y1={source.y}
                            x2={target.x}
                            y2={target.y}
                            stroke="hsl(var(--border))"
                            strokeWidth="2"
                            markerEnd="url(#arrowhead)"
                        />
                    );
                })}

                {/* Nodes */}
                {nodes.map((node) => (
                    <g key={node.id || 'unknown'} transform={`translate(${node.x},${node.y})`}>
                        <g className="transition-all duration-500 hover:scale-110 cursor-pointer">
                            <circle
                                r={node.type === rootType ? 30 : 20}
                                className={`${node.type === 'Asset' ? 'fill-blue-100 stroke-blue-500 dark:fill-blue-900/50 dark:stroke-blue-400' :
                                    node.type === 'Risk' ? 'fill-red-100 stroke-red-500 dark:fill-red-900/50 dark:stroke-red-400' :
                                        'fill-emerald-100 stroke-emerald-500 dark:fill-emerald-900/50 dark:stroke-emerald-400'
                                    } shadow-lg`}
                                strokeWidth="2"
                            />
                            <foreignObject x="-12" y="-12" width="24" height="24">
                                <div className="flex items-center justify-center h-full w-full text-foreground">
                                    {node.type === 'Asset' && <Server className="h-5 w-5" />}
                                    {node.type === 'Risk' && <ShieldAlert className="h-5 w-5" />}
                                    {node.type === 'Control' && <CheckCircle2 className="h-5 w-5" />}
                                </div>
                            </foreignObject>
                            <text
                                y={node.type === rootType ? 45 : 35}
                                textAnchor="middle"
                                className="text-[11px] font-bold fill-muted-foreground pointer-events-none uppercase tracking-wider"
                            >
                                {node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label}
                            </text>
                        </g>
                    </g>
                ))}
            </svg>

            <div className="absolute bottom-4 right-4 flex gap-4 text-xs font-bold text-muted-foreground bg-background/80 p-3 rounded-2xl backdrop-blur-xl border border-border/60 shadow-lg">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></div> Actif</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></div> Risque</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div> Contrôle</div>
            </div>
        </div>
    );
});
