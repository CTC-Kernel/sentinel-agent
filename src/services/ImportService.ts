import { z } from 'zod';
import { CsvParser } from '../utils/csvUtils';
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
     * Parse and validate Risks from CSV
     * @param csvContent Raw CSV string
     * @returns Parsed risks and error count
     */
    static parseRisks(csvContent: string): { data: ImportedRisk[]; errors: string[] } {
        const rawData = CsvParser.parseCSV(csvContent);
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
        const rawData = CsvParser.parseCSV(csvContent);
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
}
