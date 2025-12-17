
import { Control, Document, Risk } from '../types';

export interface EvidenceSuggestion {
    controlId: string;
    documentId: string;
    reason: string;
    confidence: number; // 0-1
}

export class ComplianceService {

    /**
     * Scans documents and suggests links to controls based on keywords and control codes.
     * @param controls List of controls
     * @param documents List of documents
     */
    static suggestEvidenceLinks(controls: Control[], documents: Document[]): EvidenceSuggestion[] {
        const suggestions: EvidenceSuggestion[] = [];

        controls.forEach(control => {
            // Keywords based on Control Name + Code (simplified)
            // Example: "5.1 Policies for information security" -> keywords: ["policy", "politique", "security"]
            const keywords = control.name.toLowerCase().split(' ')
                .filter(w => w.length > 4) // simple filter
                .map(w => w.replace(/[.,]/g, ''));

            // Add custom mapping for common controls
            if (control.code.includes('5.1')) keywords.push('p_ssi', 'pol_sec');
            if (control.code.includes('8.12')) keywords.push('dlp', 'fuite');
            if (control.code.includes('8.2')) keywords.push('access', 'acces');

            documents.forEach(doc => {
                // Skip if already linked
                if (control.evidenceIds?.includes(doc.id)) return;

                const title = doc.title.toLowerCase();
                // Check if ANY specific logic matches
                let match = false;
                let reason = '';

                // 1. Direct Code Match (e.g. document named "Preuve A.5.1.pdf")
                if (title.includes(control.code.toLowerCase())) {
                    match = true;
                    reason = `Le nom du document contient le code ${control.code}`;
                }
                // 2. Keyword Match
                else {
                    const matchCount = keywords.filter(k => title.includes(k)).length;
                    if (matchCount >= 2) { // Require at least 2 keyword matches for non-trivial names
                        match = true;
                        reason = `Mots-clés correspondants: ${keywords.filter(k => title.includes(k)).join(', ')}`;
                    }
                }

                if (match) {
                    suggestions.push({
                        controlId: control.id,
                        documentId: doc.id,
                        reason,
                        confidence: title.includes(control.code.toLowerCase()) ? 0.9 : 0.6
                    });
                }
            });
        });

        return suggestions;
    }

    /**
     * Auto-generates justification for SoA based on linked items.
     * @param control The control to analyze
     * @param linkedRisks Risks linked to this control (via mitigationControlIds)
     */
    static suggestSoAJustification(control: Control, linkedRisks: Risk[]): string {
        if (linkedRisks.length > 0) {
            const riskNames = linkedRisks.map(r => r.threat).join(', ');
            return `Applicable pour traiter les risques : ${riskNames}.`;
        }

        // Standard applicability based on keywords
        const n = control.name.toLowerCase();
        if (n.includes('policy') || n.includes('politique')) return 'Applicable : Documentaire (Politique interne).';
        if (n.includes('legal') || n.includes('légal')) return 'Applicable : Exigence légale et réglementaire.';
        if (n.includes('access') || n.includes('accès')) return 'Applicable : Mesure technique de contrôle d\'accès.';

        return 'Applicable : Bonnes pratiques de sécurité (Hygiène informatique).';
    }
}
