export const ASSET_TYPES = [
    'Matériel',
    'Logiciel',
    'Données',
    'Service',
    'Humain'
] as const;

export const ASSET_LIFECYCLE_STATUSES = [
    'Neuf',
    'En service',
    'En réparation',
    'Fin de vie',
    'Rebut'
] as const;

export const COMPLIANCE_SCOPES = [
    'NIS2',
    'DORA',
    'PCI_DSS',
    'HDS',
    'ISO27001',
    'SOC2'
] as const;
