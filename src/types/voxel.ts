import { Asset, Risk, Project, Audit, Incident, Supplier, Control } from './index';

export type LayerType = 'asset' | 'risk' | 'project' | 'audit' | 'incident' | 'supplier' | 'control';

export interface VoxelNode {
    id: string;
    type: LayerType;
    position: [number, number, number];
    color: string;
    size: number;
    data: DataNode['data'];
    connections: string[];
}

export type DataNode =
    | { id: string; type: 'asset'; data: Asset }
    | { id: string; type: 'risk'; data: Risk }
    | { id: string; type: 'project'; data: Project }
    | { id: string; type: 'audit'; data: Audit }
    | { id: string; type: 'incident'; data: Incident }
    | { id: string; type: 'supplier'; data: Supplier }
    | { id: string; type: 'control'; data: Control };

export interface AISuggestedLink {
    id: string;
    sourceId: string;
    targetId: string;
    type: 'risk_factor' | 'dependency' | 'impact' | 'mitigation';
    confidence: number;
    reasoning: string;
}

export interface AIInsight {
    id: string;
    type: 'critical_path' | 'cluster' | 'anomaly' | 'recommendation';
    title: string;
    description: string;
    relatedIds: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
}
