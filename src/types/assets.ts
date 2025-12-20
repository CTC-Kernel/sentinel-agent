import { Criticality, AIAnalysisResult } from './common';

export interface AssetHistory {
    date: string;
    userId: string;
    userName?: string;
    previousConfidentiality: Criticality;
    newConfidentiality: Criticality;
    previousIntegrity: Criticality;
    newIntegrity: Criticality;
    previousAvailability: Criticality;
    newAvailability: Criticality;
    reason?: string;
}

export interface Asset {
    id: string;
    organizationId: string;
    name: string;
    type: 'Matériel' | 'Logiciel' | 'Données' | 'Service' | 'Humain';
    owner: string;
    confidentiality: Criticality;
    integrity: Criticality;
    availability: Criticality;
    location: string;
    createdAt: string;
    purchaseDate?: string;
    purchasePrice?: number; // Valeur d'achat
    version?: string; // Software version
    currentValue?: number; // Valeur après amortissement
    warrantyEnd?: string;
    nextMaintenance?: string;
    lifecycleStatus?: 'Neuf' | 'En service' | 'En réparation' | 'Fin de vie' | 'Rebut';
    ownerId?: string;
    relatedProjectIds?: string[];
    scope?: ('NIS2' | 'DORA' | 'PCI_DSS' | 'HDS' | 'ISO27001' | 'SOC2')[];
    supplierId?: string;
    updatedAt?: string;
    // Specialized fields
    ipAddress?: string;
    hostname?: string;
    cpe?: string;
    macAddress?: string;
    licenseExpiry?: string;
    email?: string;
    role?: string;
    department?: string;
    hardwareType?: string;
    hardware?: Record<string, unknown>;
    notes?: string;
    history?: AssetHistory[];
    aiAnalysis?: AIAnalysisResult | null;
    // Specialized details
    dataDetails?: {
        format: 'Numérique' | 'Physique' | 'Hybride';
        retentionPeriod?: string;
        hasWorm?: boolean;
        isEncrypted?: boolean;
        dataCategory?: 'Client' | 'Employé' | 'Financier' | 'Propriété Intellectuelle' | 'Autre';
    };
    serviceDetails?: {
        providerUrl?: string;
        sla?: string;
        supportContact?: string;
        hostingLocation?: string;
    };
}

export interface MaintenanceRecord {
    id: string;
    date: string;
    type: 'Préventive' | 'Corrective' | 'Mise à jour' | 'Inspection';
    description: string;
    technician: string;
    cost?: number;
}
