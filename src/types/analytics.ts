import { Asset } from './assets';
import { Risk } from './risks';
import { Project } from './projects';
import { Audit } from './audits';
import { Incident } from './incidents';
import { Supplier } from './business';
import { Control } from './controls';

export interface DailyStat {
    organizationId: string;
    date: string;
    risks: number;
    compliance: number;
    incidents: number;
    timestamp: string;
}

export interface StatsHistoryEntry {
    id: string;
    organizationId: string;
    date: string;
    timestamp: number;
    metrics: {
        totalRisks: number;
        criticalRisks: number;
        highRisks: number;
        openIncidents: number;
        complianceRate: number;
        totalAssets: number;
        activeProjects: number;
    };
}

export interface AIInsight {
    id: string;
    type: 'critical_path' | 'cluster' | 'anomaly' | 'recommendation';
    title: string;
    description: string;
    relatedIds: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export type DataNode =
    | { id: string; type: 'asset'; data: Asset }
    | { id: string; type: 'risk'; data: Risk }
    | { id: string; type: 'project'; data: Project }
    | { id: string; type: 'audit'; data: Audit }
    | { id: string; type: 'incident'; data: Incident }
    | { id: string; type: 'supplier'; data: Supplier }
    | { id: string; type: 'control'; data: Control };

export type VoxelNode = DataNode & {
    position: [number, number, number];
    color: string;
    size: number;
    connections: string[];
};
