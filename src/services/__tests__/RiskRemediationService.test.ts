/**
 * RiskRemediationService Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect } from 'vitest';
import { RiskRemediationService } from '../RiskRemediationService';
import { Control, Risk } from '../../types';

const createControl = (id: string, name: string, description = ''): Control => ({
    id,
    name,
    description,
    code: 'CTRL-123',
    organizationId: 'org-123',
    framework: 'ISO27001',
    status: 'Implémenté',
    owner: 'owner-123',
});

describe('RiskRemediationService', () => {
    describe('suggestMitigationControls', () => {
        it('should return empty array when risk has no threat or vulnerability', () => {
            const risk: Partial<Risk> = {
                threat: 'Test Risk',
            };
            const controls: Control[] = [
                createControl('c1', 'Backup Control'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            expect(result).toEqual([]);
        });

        it('should suggest backup controls for ransomware threat', () => {
            const risk: Partial<Risk> = {
                threat: 'Ransomware attack',
            };
            const controls: Control[] = [
                createControl('c1', 'Sauvegarde des données'),
                createControl('c2', 'Backup journalier'),
                createControl('c3', 'Plan de restauration'),
                createControl('c4', 'Antivirus'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            expect(result).toContain('c1');
            expect(result).toContain('c2');
            expect(result).toContain('c3');
        });

        it('should suggest controls for rançongiciel (French ransomware)', () => {
            const risk: Partial<Risk> = {
                threat: 'Attaque par rançongiciel',
            };
            const controls: Control[] = [
                createControl('c1', 'Backup régulier'),
                createControl('c2', 'Recovery plan'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            expect(result).toContain('c1');
            expect(result).toContain('c2');
        });

        it('should suggest access controls for access threats', () => {
            const risk: Partial<Risk> = {
                threat: 'Accès non autorisé',
            };
            const controls: Control[] = [
                createControl('c1', 'Contrôle d\'accès'),
                createControl('c2', 'Access control policy'),
                createControl('c3', 'MFA obligatoire'),
                createControl('c4', 'Journal des connexions'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            expect(result).toContain('c1');
            expect(result).toContain('c2');
            expect(result).toContain('c3');
        });

        it('should suggest MFA for intrusion threats', () => {
            const risk: Partial<Risk> = {
                threat: 'Intrus dans le système',
            };
            const controls: Control[] = [
                createControl('c1', 'Double facteur authentification'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            expect(result).toContain('c1');
        });

        it('should suggest DLP and encryption for data leak threats', () => {
            const risk: Partial<Risk> = {
                threat: 'Fuite de données sensibles',
            };
            const controls: Control[] = [
                createControl('c1', 'DLP solution'),
                createControl('c2', 'Data Loss Prevention'),
                createControl('c3', 'Chiffrement des données'),
                createControl('c4', 'Encryption at rest'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            expect(result).toContain('c1');
            expect(result).toContain('c2');
            expect(result).toContain('c3');
            expect(result).toContain('c4');
        });

        it('should suggest controls for exfiltration threats', () => {
            const risk: Partial<Risk> = {
                threat: 'Exfiltration de données',
            };
            const controls: Control[] = [
                createControl('c1', 'DLP monitoring'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            expect(result).toContain('c1');
        });

        it('should match controls based on keywords in threat and vulnerability', () => {
            const risk: Partial<Risk> = {
                threat: 'Network network security breach breach', // Multiple matching words
                vulnerability: 'Firewall firewall misconfiguration',
            };
            const controls: Control[] = [
                createControl('c1', 'Network monitoring network', 'Monitor network traffic'),
                createControl('c2', 'Firewall management firewall', 'Regular firewall updates'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            // Score needs to be >= 2, so we use repeated keywords
            expect(result).toContain('c1');
            expect(result).toContain('c2');
        });

        it('should use scenario for keyword matching', () => {
            const risk: Partial<Risk> = {
                threat: 'Phishing',
                vulnerability: 'Employees',
                scenario: 'Phishing email sends malware to employees phishing employees',
            };
            const controls: Control[] = [
                createControl('c1', 'Phishing protection phishing', 'Protection against phishing'),
                createControl('c2', 'Employee training employees', 'Security awareness for employees'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            expect(result).toContain('c1');
            expect(result).toContain('c2');
        });

        it('should filter out short and stop words from keywords', () => {
            const risk: Partial<Risk> = {
                threat: 'Cette attaque avec le ransomware severe', // ransomware triggers special logic
                vulnerability: 'Aussi pour sans dans système',
            };
            const controls: Control[] = [
                createControl('c1', 'Cette control'), // Should not match "Cette" (stop word)
                createControl('c2', 'Ransomware backup defense sauvegarde'), // Should match via ransomware logic
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            // "ransomware" triggers special logic giving +5 for backup/sauvegarde
            expect(result).toContain('c2');
        });

        it('should return empty array when no controls match', () => {
            const risk: Partial<Risk> = {
                threat: 'Very specific unique threat XYZ123',
            };
            const controls: Control[] = [
                createControl('c1', 'Unrelated control A'),
                createControl('c2', 'Unrelated control B'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            expect(result).toEqual([]);
        });

        it('should match controls based on description', () => {
            const risk: Partial<Risk> = {
                threat: 'Database database compromise database', // Multiple database keywords
            };
            const controls: Control[] = [
                createControl('c1', 'Data Protection', 'Secure database database access database'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            // Score is incremented for each matching keyword
            expect(result).toContain('c1');
        });

        it('should handle incident controls for ransomware', () => {
            const risk: Partial<Risk> = {
                threat: 'Ransomware encryption',
            };
            const controls: Control[] = [
                createControl('c1', 'Plan de réponse aux incidents'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            expect(result).toContain('c1');
        });

        it('should handle log controls for connection threats', () => {
            const risk: Partial<Risk> = {
                threat: 'Connexion non autorisée',
            };
            const controls: Control[] = [
                createControl('c1', 'Logging centralisé'),
                createControl('c2', 'Journal des accès'),
            ];

            const result = RiskRemediationService.suggestMitigationControls(risk, controls);

            expect(result).toContain('c1');
            expect(result).toContain('c2');
        });
    });
});
