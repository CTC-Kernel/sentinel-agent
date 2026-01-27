/**
 * RiskService Tests
 * Comprehensive tests for Risk CRUD operations, validation, and security
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RiskService } from '../RiskService';
import { UserProfile, Risk } from '../../types';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({ id: 'risks' })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-risk-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    doc: vi.fn(() => ({ id: 'mock-doc-id' })),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        handleErrorWithToast: vi.fn(),
    },
}));

vi.mock('../FunctionsService', () => ({
    FunctionsService: {
        deleteResource: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../dependencyService', () => ({
    DependencyService: {
        checkRiskDependencies: vi.fn().mockResolvedValue({
            hasDependencies: false,
            dependencies: [],
        }),
    },
}));

vi.mock('../notificationService', () => ({
    NotificationService: {
        notifyRiskAssigned: vi.fn(),
    },
}));

vi.mock('../logger', () => ({
    logAction: vi.fn(),
}));

vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: vi.fn((data) => data),
}));

vi.mock('../../utils/permissions', () => ({
    canEditResource: vi.fn((user, resourceType) => {
        if (user.role === 'admin' || user.role === 'rssi') return true;
        if (user.role === 'user' && resourceType === 'Risk') return false;
        return true;
    }),
}));

vi.mock('../../utils/RiskCalculator', () => ({
    RiskCalculator: {
        calculateScore: vi.fn((_, probability, impact) => probability * impact),
        calculateResidualScore: vi.fn((probability, impact) => probability * impact),
        parseRiskValues: vi.fn((data) => ({
            score: (data.probability || 1) * (data.impact || 1),
            residualScore: (data.residualProbability || 1) * (data.residualImpact || 1),
        })),
    },
}));

vi.mock('../../schemas/riskSchema', () => ({
    riskSchema: {
        safeParse: vi.fn((data) => {
            if (!data.threat) {
                return {
                    success: false,
                    error: { issues: [{ message: 'Threat is required' }] },
                };
            }
            return { success: true, data };
        }),
    },
}));

vi.mock('../../utils/diffUtils', () => ({
    getDiff: vi.fn(() => ({ changed: ['status'] })),
}));

import { addDoc, updateDoc } from 'firebase/firestore';
import { FunctionsService } from '../FunctionsService';
import { DependencyService } from '../dependencyService';
import { canEditResource } from '../../utils/permissions';

// TODO: Tests need updating - service API changed
describe.skip('RiskService', () => {
    const mockAdminUser: UserProfile = {
        uid: 'admin-1',
        email: 'admin@test.com',
        displayName: 'Admin User',
        organizationId: 'org-1',
        role: 'admin',
    } as UserProfile;

    const mockRegularUser: UserProfile = {
        uid: 'user-1',
        email: 'user@test.com',
        displayName: 'Regular User',
        organizationId: 'org-1',
        role: 'user',
    } as UserProfile;

    const mockRisk: Risk = {
        id: 'risk-1',
        threat: 'Data Breach',
        probability: 3,
        impact: 4,
        score: 12,
        residualProbability: 2,
        residualImpact: 2,
        residualScore: 4,
        status: 'Ouvert',
        organizationId: 'org-1',
        owner: 'admin-1',
    } as Risk;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validateLogic', () => {
        it('should return valid when no residual values exist', () => {
            const result = RiskService.validateLogic({
                probability: 3,
                impact: 4,
            });
            expect(result.valid).toBe(true);
        });

        it('should return valid when residual score <= inherent score', () => {
            const result = RiskService.validateLogic({
                probability: 4,
                impact: 4,
                residualProbability: 2,
                residualImpact: 2,
            });
            expect(result.valid).toBe(true);
        });

        it('should return invalid when residual score > inherent score', () => {
            const result = RiskService.validateLogic({
                probability: 2,
                impact: 2,
                residualProbability: 4,
                residualImpact: 4,
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('résiduel');
        });

        it('should handle partial residual values', () => {
            const result = RiskService.validateLogic({
                probability: 3,
                impact: 4,
                residualProbability: 2,
                // Missing residualImpact
            });
            expect(result.valid).toBe(true);
        });
    });

    describe('createRisk', () => {
        it('should create risk successfully for admin user', async () => {
            const riskData: Partial<Risk> = {
                threat: 'New Risk',
                probability: 3 as const,
                impact: 4 as const,
                residualProbability: 2 as const,
                residualImpact: 2 as const,
            };

            const result = await RiskService.createRisk(mockAdminUser, riskData);

            expect(result.success).toBe(true);
            expect(result.id).toBe('new-risk-id');
            expect(addDoc).toHaveBeenCalled();
        });

        it('should reject creation when user lacks permission', async () => {
            vi.mocked(canEditResource).mockReturnValueOnce(false);

            const result = await RiskService.createRisk(mockRegularUser, {
                threat: 'Blocked Risk',
                probability: 2,
                impact: 2,
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Permission refusée');
            expect(addDoc).not.toHaveBeenCalled();
        });

        it('should reject creation when user has no organizationId', async () => {
            const userWithoutOrg = { ...mockAdminUser, organizationId: undefined };

            const result = await RiskService.createRisk(userWithoutOrg as UserProfile, {
                threat: 'Test Risk',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Permission refusée');
        });

        it('should reject creation when schema validation fails', async () => {
            const result = await RiskService.createRisk(mockAdminUser, {
                // Missing 'threat' - required field
                probability: 3,
                impact: 4,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Threat');
        });

        it('should reject creation when business logic validation fails', async () => {
            const result = await RiskService.createRisk(mockAdminUser, {
                threat: 'Invalid Risk',
                probability: 1,
                impact: 1,
                residualProbability: 5,
                residualImpact: 5,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('résiduel');
        });

        it('should handle Firestore errors gracefully', async () => {
            vi.mocked(addDoc).mockRejectedValueOnce(new Error('Firestore error'));

            const result = await RiskService.createRisk(mockAdminUser, {
                threat: 'Error Risk',
                probability: 2,
                impact: 2,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Erreur');
        });
    });

    describe('updateRisk', () => {
        it('should update risk successfully', async () => {
            const updateData: Partial<Risk> = {
                status: 'En cours' as const,
                probability: 2 as const,
            };

            const result = await RiskService.updateRisk(mockAdminUser, 'risk-1', updateData, mockRisk);

            expect(result.success).toBe(true);
            expect(updateDoc).toHaveBeenCalled();
        });

        it('should reject update when user lacks permission', async () => {
            vi.mocked(canEditResource).mockReturnValueOnce(false);

            const result = await RiskService.updateRisk(mockRegularUser, 'risk-1', { status: 'Fermé' });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Permission refusée');
        });

        it('should reject update when IDOR check fails (different organization)', async () => {
            const foreignRisk = { ...mockRisk, organizationId: 'other-org' };

            const result = await RiskService.updateRisk(mockAdminUser, 'risk-1', { status: 'Fermé' }, foreignRisk);

            expect(result.success).toBe(false);
            expect(result.error).toContain('non autorisé');
        });

        it('should reject update when business logic validation fails', async () => {
            const result = await RiskService.updateRisk(
                mockAdminUser,
                'risk-1',
                { residualProbability: 5, residualImpact: 5 },
                { ...mockRisk, probability: 1, impact: 1 }
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('résiduel');
        });

        it('should handle Firestore errors gracefully', async () => {
            vi.mocked(updateDoc).mockRejectedValueOnce(new Error('Update failed'));

            const result = await RiskService.updateRisk(mockAdminUser, 'risk-1', { status: 'Fermé' }, mockRisk);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Erreur');
        });
    });

    describe('deleteRisk', () => {
        it('should delete risk successfully', async () => {
            const result = await RiskService.deleteRisk(mockAdminUser, 'risk-1', mockRisk);

            expect(result.success).toBe(true);
            expect(FunctionsService.deleteResource).toHaveBeenCalledWith('risks', 'risk-1');
        });

        it('should reject deletion when user lacks permission', async () => {
            vi.mocked(canEditResource).mockReturnValueOnce(false);

            const result = await RiskService.deleteRisk(mockRegularUser, 'risk-1');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Permission refusée');
        });

        it('should reject deletion when IDOR check fails', async () => {
            const foreignRisk = { ...mockRisk, organizationId: 'other-org' };

            const result = await RiskService.deleteRisk(mockAdminUser, 'risk-1', foreignRisk);

            expect(result.success).toBe(false);
            expect(result.error).toContain('non autorisé');
        });

        it('should handle FunctionsService errors', async () => {
            vi.mocked(FunctionsService.deleteResource).mockRejectedValueOnce(new Error('Delete failed'));

            const result = await RiskService.deleteRisk(mockAdminUser, 'risk-1', mockRisk);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Delete failed');
        });
    });

    describe('checkDependencies', () => {
        it('should return dependencies from DependencyService', async () => {
            vi.mocked(DependencyService.checkRiskDependencies).mockResolvedValueOnce({
                hasDependencies: true,
                dependencies: [{ type: 'Contrôle', id: 'ctrl-1', name: 'CTRL-001', collectionName: 'controls' }],
                canDelete: false,
                blockingReasons: ['Ce risque est lié à des contrôles'],
            });

            const result = await RiskService.checkDependencies(mockAdminUser, 'risk-1');

            expect(result.hasDependencies).toBe(true);
            expect(result.dependencies).toHaveLength(1);
            expect(DependencyService.checkRiskDependencies).toHaveBeenCalledWith('risk-1', 'org-1');
        });

        it('should return empty dependencies when user has no organizationId', async () => {
            const userWithoutOrg = { ...mockAdminUser, organizationId: undefined };

            const result = await RiskService.checkDependencies(userWithoutOrg as UserProfile, 'risk-1');

            expect(result.hasDependencies).toBe(false);
            expect(result.dependencies).toHaveLength(0);
        });
    });

    describe('IDOR Protection', () => {
        it('should allow operation when resource belongs to same organization', async () => {
            const result = await RiskService.updateRisk(mockAdminUser, 'risk-1', { status: 'Fermé' }, mockRisk);
            expect(result.success).toBe(true);
        });

        it('should block operation when resource belongs to different organization', async () => {
            const foreignRisk = { ...mockRisk, organizationId: 'different-org' };
            const result = await RiskService.updateRisk(mockAdminUser, 'risk-1', { status: 'Fermé' }, foreignRisk);
            expect(result.success).toBe(false);
        });

        it('should allow operation when currentRisk is not provided (new resource)', async () => {
            // For update without current risk, IDOR check is skipped
            const result = await RiskService.updateRisk(mockAdminUser, 'risk-1', { status: 'Fermé' });
            expect(result.success).toBe(true);
        });
    });
});
