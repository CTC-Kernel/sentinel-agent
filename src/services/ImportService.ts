import { z } from 'zod';
import { CsvParser } from '../utils/csvUtils';

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

    private static normalizeKeys(row: Record<string, string>): Record<string, string> {
        const normalized: Record<string, string> = {};
        Object.keys(row).forEach(key => {
            normalized[key.toLowerCase().trim()] = row[key];
        });
        return normalized;
    }
}
