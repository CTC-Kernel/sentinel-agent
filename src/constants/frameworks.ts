export const FRAMEWORKS = [
 'ISO27001',
 'ISO27005',
 'ISO22301',
 'NIS2',
 'DORA',
 'GDPR',
 'SOC2',
 'HDS',
 'PCI_DSS',
 'NIST_CSF',
 'OWASP',
 'EBIOS',
 'COBIT',
 'ITIL'
] as const;

export type Framework = typeof FRAMEWORKS[number];

export const FRAMEWORK_LABELS: Record<Framework, string> = {
 'ISO27001': 'ISO/IEC 27001',
 'ISO27005': 'ISO/IEC 27005',
 'ISO22301': 'ISO/IEC 22301',
 'NIS2': 'NIS 2',
 'DORA': 'DORA',
 'GDPR': 'GDPR / RGPD',
 'SOC2': 'SOC 2',
 'HDS': 'HDS',
 'PCI_DSS': 'PCI-DSS',
 'NIST_CSF': 'NIST CSF',
 'OWASP': 'OWASP',
 'EBIOS': 'EBIOS RM',
 'COBIT': 'COBIT',
 'ITIL': 'ITIL'
};
