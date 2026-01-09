// Imports removed as types were moved to voxel.ts

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

// DataNode and VoxelNode moved to voxel.ts
// AIInsight moved to voxel.ts
