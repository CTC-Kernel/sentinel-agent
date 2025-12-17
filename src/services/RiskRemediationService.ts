
import { Control, Risk } from '../types';

export class RiskRemediationService {

    /**
     * Suggests controls that mitigate a specific risk based on text analysis.
     * @param risk The risk to analyze (threat, vulnerability, name)
     * @param controls List of available controls
     * @returns Array of Control IDs that are recommended
     */
    static suggestMitigationControls(risk: Partial<Risk>, controls: Control[]): string[] {
        if (!risk.threat && !risk.vulnerability) return [];

        const threat = (risk.threat || '').toLowerCase();
        const vuln = (risk.vulnerability || '').toLowerCase();
        const scenario = (risk.scenario || '').toLowerCase();

        // Keywords extraction (naive approach)
        const keywords = [...threat.split(' '), ...vuln.split(' '), ...scenario.split(' ')]
            .map(w => w.replace(/[.,()]/g, '').trim())
            .filter(w => w.length > 4)
            // Filter common stop words
            .filter(w => !['cette', 'aussi', 'pour', 'avec', 'sans', 'dans'].includes(w));

        const suggestedIds: string[] = [];

        controls.forEach(ctrl => {
            const ctrlName = ctrl.name.toLowerCase();
            const ctrlDesc = (ctrl.description || '').toLowerCase();

            let score = 0;

            // 1. Direct Ransomware Logic
            if (threat.includes('ransomware') || threat.includes('rançongiciel')) {
                if (ctrlName.includes('sauvegarde') || ctrlName.includes('backup')) score += 5;
                if (ctrlName.includes('restauration') || ctrlName.includes('recovery')) score += 5;
                if (ctrlName.includes('incident')) score += 2;
            }

            // 2. Access Control Logic
            if (threat.includes('accès') || threat.includes('intrus') || threat.includes('connexion')) {
                if (ctrlName.includes('accès') || ctrlName.includes('access')) score += 3;
                if (ctrlName.includes('mfa') || ctrlName.includes('double facteur')) score += 5;
                if (ctrlName.includes('log') || ctrlName.includes('journal')) score += 2;
            }

            // 3. Data Leak Logic
            if (threat.includes('fuite') || threat.includes('exfiltration') || threat.includes('données')) {
                if (ctrlName.includes('dlp') || ctrlName.includes('data loss')) score += 5;
                if (ctrlName.includes('chiffrement') || ctrlName.includes('encryption')) score += 4;
            }

            // 4. General Keyword Match
            keywords.forEach(k => {
                if (ctrlName.includes(k) || ctrlDesc.includes(k)) score += 1;
            });

            if (score >= 2) {
                suggestedIds.push(ctrl.id);
            }
        });

        return suggestedIds;
    }
}
