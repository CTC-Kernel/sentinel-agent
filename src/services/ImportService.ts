import { z } from 'zod';
import { AssetFormData } from '../schemas/assetSchema';
import { Criticality } from '../types';

// Schema for Risk Import
const importedRiskSchema = z.object({
    threat: z.string().min(1, "La menace est requise"),
    vulnerability: z.string().optional().default(''),
    probability: z.preprocess((val) => parseNumber(val, 1, 5, 1), z.number().min(1).max(5)),
    impact: z.preprocess((val) => parseNumber(val, 1, 5, 1), z.number().min(1).max(5)),
    strategy: z.preprocess((val) => normalizeStrategy(val), z.enum(['Accepter', 'Atténuer', 'Eviter', 'Transférer'])),
    status: z.preprocess((val) => normalizeStatus(val), z.enum(['Ouvert', 'Fermé', 'En cours', 'Traité'])),
    framework: z.preprocess((val) => val === undefined || val === '' ? 'ISO27001' : val, z.enum(['ISO27001', 'ISO22301', 'ISO27005', 'NIS2', 'DORA', 'GDPR', 'SOC2', 'HDS', 'PCI_DSS', 'NIST_CSF', 'OWASP', 'EBIOS', 'COBIT', 'ITIL']).optional().default('ISO27001'))
});

export type ImportedRisk = z.infer<typeof importedRiskSchema>;

// Helper to safely parse numbers within range
const parseNumber = (val: unknown, min: number, max: number, fallback: number): number => {
    if (typeof val === 'number') return Math.min(Math.max(val, min), max);
    if (typeof val === 'string') {
        const parsed = parseInt(val, 10);
        if (isNaN(parsed)) return fallback;
        return Math.min(Math.max(parsed, min), max);
    }
    return fallback;
};

// Helper to normalize strategy
const normalizeStrategy = (val: unknown): string => {
    const s = String(val).toLowerCase().trim();
    if (s.includes('attenu') || s.includes('mitigat')) return 'Atténuer';
    if (s.includes('evit') || s.includes('avoid')) return 'Eviter';
    if (s.includes('accept')) return 'Accepter';
    if (s.includes('transfer')) return 'Transférer';
    return 'Atténuer';
};

// Helper to normalize status
const normalizeStatus = (val: unknown): string => {
    const s = String(val).toLowerCase().trim();
    if (s.includes('open') || s.includes('ouvert')) return 'Ouvert';
    if (s.includes('close') || s.includes('ferm')) return 'Fermé';
    if (s.includes('progress') || s.includes('cours')) return 'En cours';
    return 'Ouvert';
};

// Asset Resolvers
const resolveCriticality = (value?: string): Criticality => {
    const normalized = (value || '').toLowerCase();
    const mapping: Record<string, Criticality> = {
        'critique': Criticality.CRITICAL,
        'critical': Criticality.CRITICAL,
        'élevé': Criticality.HIGH,
        'eleve': Criticality.HIGH,
        'high': Criticality.HIGH,
        'moyen': Criticality.MEDIUM,
        'moyenne': Criticality.MEDIUM,
        'medium': Criticality.MEDIUM,
        'faible': Criticality.LOW,
        'low': Criticality.LOW,
        'public': Criticality.LOW
    };
    return mapping[normalized] ?? Criticality.MEDIUM;
};

const resolveAssetType = (value?: string): AssetFormData['type'] => {
    const normalized = (value || '').toLowerCase();
    const mapping: Record<string, AssetFormData['type']> = {
        'matériel': 'Matériel',
        'materiel': 'Matériel',
        'hardware': 'Matériel',
        'logiciel': 'Logiciel',
        'software': 'Logiciel',
        'données': 'Données',
        'donnees': 'Données',
        'data': 'Données',
        'service': 'Service',
        'humain': 'Humain',
        'human': 'Humain'
    };
    return mapping[normalized] ?? 'Logiciel';
};

const resolveLifecycleStatus = (value?: string): AssetFormData['lifecycleStatus'] => {
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    const mapping: Record<string, AssetFormData['lifecycleStatus']> = {
        'neuf': 'Neuf',
        'new': 'Neuf',
        'en service': 'En service',
        'active': 'En service',
        'activee': 'En service',
        'en réparation': 'En réparation',
        'en reparation': 'En réparation',
        'repair': 'En réparation',
        'fin de vie': 'Fin de vie',
        'endoflife': 'Fin de vie',
        'end_of_life': 'Fin de vie',
        'rebut': 'Rebut',
        'retired': 'Rebut'
    };
    return mapping[normalized] ?? 'En service';
};

export class ImportService {
    /**
     * Parse CSV Content
     */
    static parseCSV(content: string): Record<string, string>[] {
        const lines = content.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const result: Record<string, string>[] = [];

        for (let i = 1; i < lines.length; i++) {
            const obj: Record<string, string> = {};
            // Basic CSV split - can be improved for complex cases if needed
            // Matches text in quotes OR standard text
            const currentline = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');

            headers.forEach((header, index) => {
                let val = currentline[index] ? currentline[index].trim() : '';
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.substring(1, val.length - 1).replace(/""/g, '"');
                }
                obj[header] = val;
            });
            result.push(obj);
        }
        return result;
    }

    private static escapeCSV(str: unknown): string {
        if (str === null || str === undefined) return '';
        const stringValue = String(str);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    }

    static downloadCSV(data: Record<string, unknown>[], filename: string) {
        if (data.length === 0) return;
        const headers = Object.keys(data[0]);

        const csvContent = [
            headers.join(','),
            ...data.map(row => {
                return headers.map(header => this.escapeCSV(row[header])).join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    /**
     * Parse and validate Risks from CSV
     * @param csvContent Raw CSV string
     * @returns Parsed risks and error count
     */
    static parseRisks(csvContent: string): { data: ImportedRisk[]; errors: string[] } {
        const rawData = ImportService.parseCSV(csvContent);
        const parsedRisks: ImportedRisk[] = [];
        const errors: string[] = [];

        rawData.forEach((row, index) => {
            // Normalize keys to support varied CSV headers (EN/FR)
            const normalizedRow = this.normalizeKeys(row);

            // Map to schema input
            // We use the normalized keys to feed the zod parser
            const result = importedRiskSchema.safeParse({
                threat: normalizedRow.threat || normalizedRow.menace || normalizedRow.title || normalizedRow.titre,
                vulnerability: normalizedRow.vulnerability || normalizedRow.vulnerabilite || normalizedRow.cause,
                probability: normalizedRow.probability || normalizedRow.probabilite || normalizedRow.likelihood,
                impact: normalizedRow.impact || normalizedRow.gravite || normalizedRow.severity,
                strategy: normalizedRow.strategy || normalizedRow.strategie,
                status: normalizedRow.status || normalizedRow.statut,
                framework: normalizedRow.framework || normalizedRow.reference
            });

            if (result.success) {
                // Ensure mandatory threat is present (Zod handles this but strictly empty strings might slip if not caught)
                if (result.data.threat) {
                    parsedRisks.push(result.data as ImportedRisk);
                }
            } else {
                errors.push(`Ligne ${index + 1}: ${result.error.issues.map(e => e.message).join(', ')} `);
            }
        });

        return { data: parsedRisks, errors };
    }

    /**
     * Parse and validate Assets from CSV
     * @param csvContent Raw CSV string
     * @param defaultOwner Default owner name if not found in CSV
     * @returns Parsed assets and error count
     */
    static parseAssets(csvContent: string, defaultOwner: string = 'Unknown'): { data: AssetFormData[]; errors: string[] } {
        const rawData = ImportService.parseCSV(csvContent);
        const parsedAssets: AssetFormData[] = [];
        const errors: string[] = [];

        rawData.forEach((row, index) => {
            const getVal = (keys: string[]) => {
                for (const k of keys) {
                    // Start checking against original keys, then check normalized keys
                    if (row[k] !== undefined && row[k] !== '') return row[k];
                    // Also check if any key in row matches case-insensitively if exact match fails
                    const lowerK = k.toLowerCase();
                    const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === lowerK);
                    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') return row[foundKey];
                }
                return undefined;
            };

            const name = getVal(['name', 'Name', 'Nom']);
            const type = getVal(['type', 'Type']);

            if (!name || !type) {
                errors.push(`Ligne ${index + 1}: 'Nom' et 'Type' sont requis.`);
                return;
            }

            const assetData: AssetFormData = {
                name,
                type: resolveAssetType(type),
                notes: getVal(['notes', 'description', 'Notes', 'Description']) || '',
                owner: getVal(['owner', 'Owner', 'Propriétaire']) || defaultOwner,
                confidentiality: resolveCriticality(getVal(['criticality', 'confidentiality', 'Criticality', 'Criticité', 'Confidentiality', 'Confidentialité'])),
                integrity: resolveCriticality(getVal(['integrity', 'Integrity', 'Intégrité'])),
                availability: resolveCriticality(getVal(['availability', 'Availability', 'Disponibilité'])),
                lifecycleStatus: resolveLifecycleStatus(getVal(['status', 'lifecycleStatus', 'Status', 'Statut', 'Lifecycle Status', 'Statut Cycle de Vie'])),
                location: getVal(['location', 'Location', 'Localisation']) || '',
                purchasePrice: getVal(['purchasePrice', 'Purchase Price', 'Prix Achat', 'Valeur']) ? Number(getVal(['purchasePrice', 'Purchase Price', 'Prix Achat', 'Valeur'])) : undefined,
                purchaseDate: getVal(['purchaseDate', 'Purchase Date', 'Date Achat']),
                warrantyEnd: getVal(['warrantyEnd', 'Warranty End', 'Fin Garantie'])
            };

            parsedAssets.push(assetData);
        });

        return { data: parsedAssets, errors };
    }

    private static normalizeKeys(row: Record<string, string>): Record<string, string> {
        const normalized: Record<string, string> = {};
        Object.keys(row).forEach(key => {
            normalized[key.toLowerCase().trim()] = row[key];
        });
        return normalized;
    }

    /**
     * Download CSV template for Assets
     */
    static downloadAssetTemplate(t: (key: string) => string) {


        const exampleRow = {
            [t('common.columns.name')]: "Server DB-01",
            [t('common.columns.type')]: "Matériel",
            [t('common.columns.owner')]: "Jean Dupont",
            [t('common.columns.confidentiality')]: "High",
            [t('common.columns.notes')]: "Main database server",
            [t('common.columns.availability')]: "High",
            [t('common.columns.integrity')]: "High",
            [t('common.columns.lifecycleStatus')]: "En service",
            [t('common.columns.location')]: "Data Center A",
            [t('common.columns.purchasePrice')]: "5000",
            [t('common.columns.purchaseDate')]: "2024-01-01",
            [t('common.columns.warrantyEnd')]: "2027-01-01"
        };

        ImportService.downloadCSV([exampleRow], `template_assets.csv`);
    }

    /**
     * Download CSV template for Risks
     */
    static downloadRiskTemplate() {

        const exampleRow = {
            menace: "Ransomware Attack",
            probabilite: "3",
            gravite: "4",
            strategie: "Atténuer",
            description: "Chiffrement des données par un malware",
            vulnerabilite: "Patching non à jour",
            statut: "Ouvert",
            proprietaire: "john.doe@example.com"
        };
        ImportService.downloadCSV([exampleRow], `template_risks.csv`);
    }

    /**
     * Download CSV template for Documents
     */
    static downloadDocumentTemplate() {
        const rows = [{
            'Titre': 'Politique de Sécurité',
            'Type': 'Politique',
            'Version': '1.0',
            'Statut': 'Publié',
            'Propriétaire': 'DSI',
            'Date de prochaine révision': '2025-01-01',
            'URL': 'https://example.com/doc'
        }];
        this.downloadCSV(rows, 'template_documents.csv');
    }

    /**
     * Export Documents to CSV
     */
    static exportDocuments(documents: Record<string, unknown>[]) {
        const objectRows = documents.map(doc => ({
            "Titre": doc.title,
            "Type": doc.type,
            "Version": doc.version,
            "Statut": doc.status,
            "Propriétaire": doc.owner,
            "Date de prochaine révision": doc.nextReviewDate,
            "URL": doc.url
        }));
        this.downloadCSV(objectRows, `documents_export_${new Date().toISOString().split('T')[0]}.csv`);
    }

    /**
     * Download CSV template for Audits
     */
    static downloadAuditTemplate() {
        const rows = [{
            'Nom': 'Audit Interne Q1',
            'Type': 'Interne',
            'Statut': 'Planifié',
            'Auditeur': 'Jean Dupont',
            'Date': new Date().toISOString().split('T')[0],
            'Description': 'Audit de conformité ISO'
        }];
        this.downloadCSV(rows, 'template_audits.csv');
    }

    /**
     * Download CSV template for Suppliers
     */
    static downloadSupplierTemplate() {
        const rows = [{
            'Nom': 'Fournisseur A',
            'Catégorie': 'SaaS',
            'Criticité': 'Élevée',
            'Statut': 'Actif',
            'Contact': 'contact@supplier.com',
            'Description': 'Description du fournisseur'
        }];
        this.downloadCSV(rows, 'template_fournisseurs.csv');
    }

    /**
     * Export Suppliers to CSV
     */
    static exportSuppliers(suppliers: Record<string, unknown>[]) {
        const objectRows = suppliers.map(s => ({
            "Nom": s.name,
            "Catégorie": s.category,
            "Criticité": s.criticality,
            "Score Sécurité": s.securityScore?.toString() || '0',
            "Contact": s.contactEmail,
            "Fin Contrat": s.contractEnd ? new Date(s.contractEnd as string).toLocaleDateString() : '',
            "Statut": s.status
        }));
        this.downloadCSV(objectRows, `suppliers_export_${new Date().toISOString().split('T')[0]}.csv`);
    }

    /**
     * Export DORA Register to CSV
     */
    static exportDORARegister(suppliers: Record<string, unknown>[]) {
        const objectRows = suppliers.filter(s => s.isICTProvider).map(s => ({
            "Nom Fournisseur": s.name,
            "Type Service": s.serviceType || 'N/A',
            "Prestataire TIC": s.isICTProvider ? 'OUI' : 'NON',
            "Fonction Critique": s.supportsCriticalFunction ? 'OUI' : 'NON',
            "Criticité DORA": s.doraCriticality || 'None',
            "Localisation Données": 'UE (Simulé)', // Placeholder
            "Date Contrat": s.contractEnd ? new Date(s.contractEnd as string).toLocaleDateString() : ''
        }));
        this.downloadCSV(objectRows, `dora_register_of_information_${new Date().toISOString().split('T')[0]}.csv`);
    }

    /**
     * Download CSV template for Business Processes (Continuity)
     */
    static downloadProcessTemplate() {
        const rows = [{
            'Nom': 'Processus Critique A',
            'Description': 'Description du processus',
            'Responsable': 'Admin',
            'Priorite': 'High',
            'RTO': '4h',
            'RPO': '1h'
        }];
        this.downloadCSV(rows, 'template_processes.csv');
    }

    /**
     * Download CSV template for Incidents
     */
    static downloadIncidentTemplate() {
        const rows = [{
            'Titre': 'Phishing confirmé',
            'Description': 'Email suspect reçu par la compta',
            'Statut': 'Nouveau',
            'Sévérité': 'High',
            'Catégorie': 'Social Engineering',
            'Déclarant': 'Jean Dupont'
        }];
        this.downloadCSV(rows, 'template_incidents.csv');
    }

    /**
     * Download CSV template for Projects
     */
    static downloadProjectTemplate() {
        const rows = [{
            'Nom': 'Projet de certification ISO27001',
            'Description': 'Mise en conformité du SI',
            'Statut': 'Nouveau',
            'Priorité': 'Elevee',
            'Responsable': 'Admin',
            'Echéance': '2025-12-31'
        }];
        this.downloadCSV(rows, 'template_projets.csv');
    }

    /**
     * Export Projects to CSV
     */
    static exportProjects(projects: Record<string, unknown>[], filename: string) {
        const objectRows = projects.map(p => ({
            "Nom": p.name,
            "Statut": p.status,
            "Progression": p.progress,
            "Manager": p.manager,
            "Manager ID": p.managerId,
            "Date d'échéance": p.dueDate,
            "Date de création": p.createdAt
        }));
        this.downloadCSV(objectRows, filename);
    }

    /**
     * Download CSV template for Users
     */
    static downloadUserTemplate(t: (key: string) => string) {
        const rows = [{
            [t('common.columns.email')]: 'jean.dupont@example.com',
            [t('common.columns.name')]: 'Jean Dupont',
            [t('common.columns.role')]: 'user',
            [t('common.columns.department')]: 'IT'
        }];
        this.downloadCSV(rows, 'template_users.csv');
    }

    /**
     * Export Users to CSV
     */
    static exportUsers(users: Record<string, unknown>[]) {
        const objectRows = users.map(user => ({
            "UID": user.uid,
            "Email": user.email || '',
            "Nom": user.displayName || '',
            "Rôle": user.role || 'user',
            "Organisation": user.organizationId || '',
            "Date de création": user.createdAt ? new Date(user.createdAt as string).toLocaleDateString() : '',
            "Dernière connexion": user.lastLogin ? new Date(user.lastLogin as string).toLocaleDateString() : ''
        }));

        ImportService.downloadCSV(objectRows, `utilisateurs_export_${new Date().toISOString().split('T')[0]}.csv`);
    }
}
