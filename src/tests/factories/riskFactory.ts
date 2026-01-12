/**
 * Risk Test Factory
 * Creates mock Risk objects for testing
 */

import { Risk } from '../../types';

let riskCounter = 0;

export interface RiskFactoryOptions {
    id?: string;
    organizationId?: string;
    threat?: string;
    vulnerability?: string;
    probability?: 1 | 2 | 3 | 4 | 5;
    impact?: 1 | 2 | 3 | 4 | 5;
    status?: Risk['status'];
    strategy?: Risk['strategy'];
    framework?: Risk['framework'];
    assetId?: string;
    ownerId?: string;
    mitigationControlIds?: string[];
}

export function createRisk(options: RiskFactoryOptions = {}): Risk {
    riskCounter++;
    const id = options.id || `risk-${riskCounter}`;
    const probability = options.probability || 3;
    const impact = options.impact || 3;

    return {
        id,
        organizationId: options.organizationId || 'org-test',
        threat: options.threat || `Test Threat ${riskCounter}`,
        vulnerability: options.vulnerability || `Test Vulnerability ${riskCounter}`,
        scenario: `Test scenario for risk ${riskCounter}`,
        probability,
        impact,
        residualProbability: Math.max(1, probability - 1) as 1 | 2 | 3 | 4 | 5,
        residualImpact: Math.max(1, impact - 1) as 1 | 2 | 3 | 4 | 5,
        score: probability * impact,
        residualScore: (probability - 1) * (impact - 1),
        status: options.status || 'Ouvert',
        strategy: options.strategy || 'Atténuer',
        framework: options.framework || 'ISO27005',
        assetId: options.assetId || 'asset-1',
        owner: 'Test Owner',
        ownerId: options.ownerId || 'user-1',
        mitigationControlIds: options.mitigationControlIds || [],
        affectedProcessIds: [],
        relatedSupplierIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

export function createRiskList(count: number, options: RiskFactoryOptions = {}): Risk[] {
    return Array.from({ length: count }, () => createRisk(options));
}

export function createCriticalRisk(options: RiskFactoryOptions = {}): Risk {
    return createRisk({
        ...options,
        probability: 5,
        impact: 5,
        status: 'Ouvert',
    });
}

export function createLowRisk(options: RiskFactoryOptions = {}): Risk {
    return createRisk({
        ...options,
        probability: 1,
        impact: 1,
        status: 'Fermé',
    });
}

export function resetRiskCounter(): void {
    riskCounter = 0;
}
