
export enum Criticality {
    LOW = 'Faible',
    MEDIUM = 'Moyenne',
    HIGH = 'Élevée',
    CRITICAL = 'Critique'
}

export type ResourceType = 'Asset' | 'Risk' | 'Project' | 'Audit' | 'Document' | 'Control' | 'Incident' | 'Supplier' | 'BusinessProcess' | 'Vulnerability' | 'Threat' | 'SystemLog' | 'ProcessingActivity' | 'SupplierAssessment' | 'SupplierIncident' | 'User' | 'Settings' | 'CTCEngine' | 'AuditTrail' | 'Organization' | 'Backup' | 'Integration' | 'Partner';
export type ActionType = 'read' | 'create' | 'update' | 'delete' | 'manage';

export interface HealthIssue {
    id: string;
    type: 'warning' | 'danger';
    message: string;
    count: number;
    link: string;
}

export interface ActionItem {
    id: string;
    type: 'audit' | 'document' | 'project' | 'policy' | 'incident' | 'risk';
    title: string;
    date: string;
    status: string;
    link: string;
}

export type Framework = 'ISO27001' | 'ISO22301' | 'ISO27005' | 'NIS2' | 'DORA' | 'GDPR' | 'SOC2' | 'HDS' | 'PCI_DSS' | 'NIST_CSF' | 'OWASP' | 'EBIOS' | 'COBIT' | 'ITIL';

export interface AIAnalysisResult {
    type: string;
    response: Record<string, unknown>;
    timestamp: string;
}
