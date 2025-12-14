import React, { useEffect, useState } from 'react';
import { Asset, Risk, Control } from '../types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from '../services/errorLogger';
import { ShieldAlert, Server, CheckCircle2 } from './ui/Icons';

interface RelationshipGraphProps {
    rootId: string;
    rootType: 'Asset' | 'Risk';
    width?: number;
    height?: number;
}

interface Node {
    id: string;
    type: 'Asset' | 'Risk' | 'Control';
    label: string;
    x: number;
    y: number;
    data?: Asset | Risk | Control;
}

interface Link {
    source: string;
    target: string;
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ rootId, rootType, width = 800, height = 600 }) => {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [links, setLinks] = useState<Link[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const newNodes: Node[] = [];
            const newLinks: Link[] = [];
            const cx = width / 2;
            const cy = height / 2;

            try {
                if (rootType === 'Asset') {
                    // 1. Fetch Root Asset
                    const assetSnap = await getDocs(query(collection(db, 'assets'), where('__name__', '==', rootId)));
                    if (assetSnap.empty) return;
                    const asset = { id: assetSnap.docs[0].id, ...assetSnap.docs[0].data() } as Asset;

                    newNodes.push({ id: asset.id, type: 'Asset', label: asset.name, x: cx, y: cy, data: asset });

                    // 2. Fetch Linked Risks
                    const risksSnap = await getDocs(query(collection(db, 'risks'), where('assetId', '==', rootId)));
                    const risks = risksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Risk));

                    risks.forEach((risk, i) => {
                        const angle = (i / risks.length) * 2 * Math.PI;
                        const r = 150;
                        const nx = cx + r * Math.cos(angle);
                        const ny = cy + r * Math.sin(angle);
                        newNodes.push({ id: risk.id, type: 'Risk', label: risk.threat, x: nx, y: ny, data: risk });
                        newLinks.push({ source: asset.id, target: risk.id });

                        // 3. Fetch Linked Controls for each Risk (if any)
                        // Note: This might be expensive if many risks. Limiting to direct links for now.
                        // If risk has mitigationControlIds, we can fetch them.
                    });

                } else if (rootType === 'Risk') {
                    // 1. Fetch Root Risk
                    const riskSnap = await getDocs(query(collection(db, 'risks'), where('__name__', '==', rootId)));
                    if (riskSnap.empty) return;
                    const risk = { id: riskSnap.docs[0].id, ...riskSnap.docs[0].data() } as Risk;

                    newNodes.push({ id: risk.id, type: 'Risk', label: risk.threat, x: cx, y: cy, data: risk });

                    // 2. Fetch Linked Asset
                    if (risk.assetId) {
                        const assetSnap = await getDocs(query(collection(db, 'assets'), where('__name__', '==', risk.assetId)));
                        if (!assetSnap.empty) {
                            const asset = assetSnap.docs[0].data() as Asset;
                            newNodes.push({ id: risk.assetId, type: 'Asset', label: asset.name, x: cx - 200, y: cy, data: asset });
                            newLinks.push({ source: risk.assetId, target: risk.id });
                        }
                    }

                    // 3. Fetch Linked Controls
                    if (risk.mitigationControlIds && risk.mitigationControlIds.length > 0) {
                        // Firestore 'in' query supports max 10 items.
                        const chunks = [];
                        for (let i = 0; i < risk.mitigationControlIds.length; i += 10) {
                            chunks.push(risk.mitigationControlIds.slice(i, i + 10));
                        }

                        for (const chunk of chunks) {
                            const controlsSnap = await getDocs(query(collection(db, 'controls'), where('__name__', 'in', chunk)));
                            const controls = controlsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Control));

                            controls.forEach((control, i) => {
                                const nx = cx + 200;
                                const ny = cy + (i - controls.length / 2) * 60;
                                newNodes.push({ id: control.id, type: 'Control', label: control.code, x: nx, y: ny, data: control });
                                newLinks.push({ source: risk.id, target: control.id });
                            });
                        }
                    }
                }

                setNodes(newNodes);
                setLinks(newLinks);
            } catch (e) {
                ErrorLogger.error(e, 'RelationshipGraph.fetchData');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [rootId, rootType, width, height]);

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
                {links.map((link, i) => {
                    const source = nodes.find(n => n.id === link.source);
                    const target = nodes.find(n => n.id === link.target);
                    if (!source || !target) return null;
                    return (
                        <line
                            key={i}
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
                    <g key={node.id} transform={`translate(${node.x},${node.y})`} className="transition-all duration-500 hover:scale-110 cursor-pointer">
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
                            className="text-[10px] font-bold fill-muted-foreground pointer-events-none uppercase tracking-wider"
                        >
                            {node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label}
                        </text>
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
};
