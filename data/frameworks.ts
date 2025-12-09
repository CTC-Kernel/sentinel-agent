export const FRAMEWORKS = [
    { id: 'ISO27001', label: 'ISO 27001 (Sécurité du SI)', type: 'Compliance' },
    { id: 'ISO22301', label: 'ISO 22301 (Continuité)', type: 'Compliance' },
    { id: 'ISO27005', label: 'ISO 27005 (Gestion des Risques)', type: 'Risk' },
    { id: 'NIS2', label: 'NIS 2 (Cybersécurité EU)', type: 'Compliance' },
    { id: 'DORA', label: 'DORA (Résilience Financière)', type: 'Compliance' },
    { id: 'GDPR', label: 'RGPD (Protection des Données)', type: 'Compliance' },
    { id: 'SOC2', label: 'SOC 2 (Services Trust)', type: 'Compliance' },
    { id: 'HDS', label: 'HDS (Données de Santé)', type: 'Compliance' },
    { id: 'PCI_DSS', label: 'PCI DSS (Paiements)', type: 'Compliance' },
    { id: 'NIST_CSF', label: 'NIST CSF (Cyber Framework)', type: 'Compliance' },
    { id: 'OWASP', label: 'OWASP Top 10 (AppSec)', type: 'Risk' },
    { id: 'EBIOS', label: 'EBIOS RM (Méthode ANSSI)', type: 'Risk' },
    { id: 'COBIT', label: 'COBIT (Gouvernance)', type: 'Governance' },
    { id: 'ITIL', label: 'ITIL (Gestion de Services)', type: 'Governance' }
] as const;

export type FrameworkId = typeof FRAMEWORKS[number]['id'];

export const FRAMEWORK_OPTIONS = FRAMEWORKS.map(f => ({ value: f.id, label: f.label }));
