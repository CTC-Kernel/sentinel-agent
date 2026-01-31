/**
 * ICT Provider Service
 * DORA Art. 28 - ICT Third-Party Provider Management
 * Story 35.1: ICT Provider Management
 */

import { db } from '../firebase';
import { FunctionsService } from './FunctionsService';
import {
    ICTProvider,
    ICTProviderFormData,
    ICTProviderFilters,
    ICTService,
    DORARegisterExport,
    DORAProviderReport,
    ConcentrationAnalysis
} from '../types/dora';
import {
    doc,
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    getDocs,
    getDoc,
    orderBy,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { sanitizeData } from '../utils/dataSanitizer';
import { ErrorLogger } from './errorLogger';
import { parseDate, formatDateISO } from '../utils/dateUtils';

export class ICTProviderService {
    private static COLLECTION = 'ict_providers';

    /**
     * Create a new ICT Provider
     */
    static async create(
        organizationId: string,
        data: ICTProviderFormData,
        userId: string
    ): Promise<string> {
        try {
            const providerData = {
                ...data,
                organizationId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: userId,
                status: data.status || 'active'
            };

            const docRef = await addDoc(
                collection(db, this.COLLECTION),
                sanitizeData(providerData)
            );

            return docRef.id;
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.create');
            throw error;
        }
    }

    /**
     * Update an existing ICT Provider
     */
    static async update(
        providerId: string,
        data: Partial<ICTProviderFormData>,
        userId: string,
        organizationId?: string
    ): Promise<void> {
        try {
            const providerRef = doc(db, this.COLLECTION, providerId);

            // Verify organization ownership if organizationId provided
            if (organizationId) {
                const docSnap = await getDoc(providerRef);
                if (!docSnap.exists() || docSnap.data().organizationId !== organizationId) {
                    throw new Error('ICT Provider not found or access denied');
                }
            }

            await updateDoc(providerRef, sanitizeData({
                ...data,
                updatedAt: serverTimestamp(),
                updatedBy: userId
            }));
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.update');
            throw error;
        }
    }

    /**
     * Get a single ICT Provider by ID
     */
    static async getById(providerId: string, organizationId?: string): Promise<ICTProvider | null> {
        try {
            const docRef = doc(db, this.COLLECTION, providerId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                return null;
            }

            const data = docSnap.data();

            // Verify organization ownership if organizationId provided
            if (organizationId && data.organizationId !== organizationId) {
                ErrorLogger.warn('IDOR attempt: ICT provider org mismatch', 'ICTProviderService.getById');
                return null;
            }

            return { id: docSnap.id, ...data } as ICTProvider;
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.getById');
            throw error;
        }
    }

    /**
     * Get all ICT Providers for an organization with optional filters
     */
    static async getAll(
        organizationId: string,
        filters?: ICTProviderFilters
    ): Promise<ICTProvider[]> {
        try {
            let q = query(
                collection(db, this.COLLECTION),
                where('organizationId', '==', organizationId),
                orderBy('name')
            );

            // Apply category filter
            if (filters?.category) {
                q = query(q, where('category', '==', filters.category));
            }

            // Apply status filter
            if (filters?.status) {
                q = query(q, where('status', '==', filters.status));
            }

            // Apply DORA compliance filter
            if (filters?.doraCompliant !== undefined) {
                q = query(q, where('compliance.doraCompliant', '==', filters.doraCompliant));
            }

            const snapshot = await getDocs(q);
            let providers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ICTProvider[];

            // Client-side filtering for complex conditions
            if (filters?.contractExpiringSoon) {
                const ninetyDaysFromNow = new Date();
                ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

                providers = providers.filter(provider => {
                    const endDate = parseDate(provider.contractInfo?.endDate);
                    return endDate && endDate <= ninetyDaysFromNow;
                });
            }

            if (filters?.searchTerm) {
                const term = filters.searchTerm.toLowerCase();
                providers = providers.filter(provider =>
                    provider.name.toLowerCase().includes(term) ||
                    provider.description?.toLowerCase().includes(term) ||
                    provider.services?.some(s => s.name.toLowerCase().includes(term))
                );
            }

            return providers;
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.getAll');
            throw error;
        }
    }

    /**
     * Delete an ICT Provider via Cloud Functions (for cascade handling)
     */
    static async delete(providerId: string): Promise<void> {
        try {
            await FunctionsService.deleteResource(this.COLLECTION, providerId);
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.delete');
            throw error;
        }
    }

    /**
     * Check dependencies for an ICT Provider
     */
    static async checkDependencies(
        providerId: string,
        organizationId: string
    ): Promise<{ risks: number; assets: number; controls: number; details: string }> {
        try {
            // Check linked risks
            const riskQuery = query(
                collection(db, 'risks'),
                where('organizationId', '==', organizationId),
                where('linkedICTProviderIds', 'array-contains', providerId)
            );

            // Check linked assets
            const assetQuery = query(
                collection(db, 'assets'),
                where('organizationId', '==', organizationId),
                where('linkedICTProviderIds', 'array-contains', providerId)
            );

            // Check linked controls
            const controlQuery = query(
                collection(db, 'controls'),
                where('organizationId', '==', organizationId),
                where('linkedICTProviderIds', 'array-contains', providerId)
            );

            const [risksSnap, assetsSnap, controlsSnap] = await Promise.all([
                getDocs(riskQuery),
                getDocs(assetQuery),
                getDocs(controlQuery)
            ]);

            let details = "";
            if (!risksSnap.empty) details += `\n- ${risksSnap.size} risque(s)`;
            if (!assetsSnap.empty) details += `\n- ${assetsSnap.size} actif(s)`;
            if (!controlsSnap.empty) details += `\n- ${controlsSnap.size} contrôle(s)`;

            return {
                risks: risksSnap.size,
                assets: assetsSnap.size,
                controls: controlsSnap.size,
                details
            };
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.checkDependencies');
            throw error;
        }
    }

    /**
     * Get providers with expiring contracts
     */
    static async getExpiringContracts(
        organizationId: string,
        daysAhead: number = 90
    ): Promise<ICTProvider[]> {
        try {
            const providers = await this.getAll(organizationId);
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysAhead);
            const now = new Date();

            return providers.filter(provider => {
                const endDate = parseDate(provider.contractInfo?.endDate);
                return endDate && endDate > now && endDate <= futureDate;
            }).sort((a, b) => {
                const dateA = parseDate(a.contractInfo?.endDate)?.getTime() || 0;
                const dateB = parseDate(b.contractInfo?.endDate)?.getTime() || 0;
                return dateA - dateB;
            });
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.getExpiringContracts');
            throw error;
        }
    }

    /**
     * Calculate concentration analysis for DORA reporting
     */
    static calculateConcentrationAnalysis(providers: ICTProvider[]): ConcentrationAnalysis {
        const critical = providers.filter(p => p.category === 'critical');
        const important = providers.filter(p => p.category === 'important');
        const standard = providers.filter(p => p.category === 'standard');

        const avgConcentration = providers.length > 0
            ? providers.reduce((sum, p) => sum + (p.riskAssessment?.concentration || 0), 0) / providers.length
            : 0;

        const highConcentration = providers
            .filter(p => (p.riskAssessment?.concentration || 0) > 70)
            .map(p => p.id);

        const nonEu = providers
            .filter(p => !p.compliance?.locationEU)
            .map(p => p.id);

        const now = new Date();
        const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

        const within30Days = providers.filter(p => {
            const endDate = parseDate(p.contractInfo?.endDate);
            return endDate && endDate > now && endDate <= thirtyDays;
        }).length;

        const within90Days = providers.filter(p => {
            const endDate = parseDate(p.contractInfo?.endDate);
            return endDate && endDate > now && endDate <= ninetyDays;
        }).length;

        return {
            totalProviders: providers.length,
            criticalProviders: critical.length,
            importantProviders: important.length,
            standardProviders: standard.length,
            averageConcentrationRisk: Math.round(avgConcentration),
            highConcentrationProviders: highConcentration,
            nonEuProviders: nonEu,
            expiringContracts: {
                within30Days,
                within90Days
            }
        };
    }

    /**
     * Generate DORA Register Export
     */
    static async generateDORAExport(
        organizationId: string,
        orgName: string,
        orgCountry: string = 'FR',
        lei?: string
    ): Promise<DORARegisterExport> {
        try {
            const providers = await this.getAll(organizationId);

            const providerReports: DORAProviderReport[] = providers
                .filter(p => p.status === 'active')
                .map(provider => ({
                    providerId: provider.id,
                    providerName: provider.name,
                    category: provider.category,
                    services: provider.services?.map(s => ({
                        name: s.name,
                        type: s.type,
                        criticality: s.criticality
                    })) || [],
                    contractEndDate: formatDateISO(provider.contractInfo?.endDate) || '',
                    exitStrategyExists: !!provider.contractInfo?.exitStrategy,
                    auditRightsGranted: provider.contractInfo?.auditRights || false,
                    euLocation: provider.compliance?.locationEU || false,
                    certifications: provider.compliance?.certifications || [],
                    concentrationRisk: provider.riskAssessment?.concentration || 0,
                    substitutability: provider.riskAssessment?.substitutability || 'medium'
                }));

            const concentrationAnalysis = this.calculateConcentrationAnalysis(providers);

            return {
                reportingEntity: {
                    name: orgName,
                    lei,
                    country: orgCountry
                },
                reportingDate: new Date().toISOString().split('T')[0],
                ictProviders: providerReports,
                concentrationAnalysis,
                generatedAt: new Date().toISOString(),
                version: '1.0'
            };
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.generateDORAExport');
            throw error;
        }
    }

    /**
     * Batch import ICT Providers from CSV data
     */
    static async importFromCSV(
        lines: Record<string, string>[],
        organizationId: string,
        userId: string
    ): Promise<{ imported: number; errors: string[] }> {
        try {
            const BATCH_SIZE = 500;
            let batch = writeBatch(db);
            let count = 0;
            let batchCount = 0;
            const errors: string[] = [];

            for (const [index, row] of lines.entries()) {
                const name = row['Nom'] || row['Name'] || row['name'];
                if (!name) {
                    errors.push(`Ligne ${index + 1}: Nom manquant`);
                    continue;
                }

                const categoryRaw = row['Categorie'] || row['Category'] || row['category'] || 'standard';
                const category = this.normalizeCategory(categoryRaw);

                const servicesRaw = row['Services'] || row['services'] || '';
                const services: ICTService[] = servicesRaw.split(',').filter(Boolean).map((s, i) => ({
                    id: `svc-${Date.now()}-${i}`,
                    name: s.trim(),
                    type: 'other' as const,
                    criticality: category,
                    businessFunctions: []
                }));

                const providerData: Partial<ICTProvider> = {
                    organizationId,
                    name: name.trim(),
                    category,
                    description: row['Description'] || row['description'] || '',
                    services: services.length > 0 ? services : [{
                        id: `svc-${Date.now()}-0`,
                        name: 'Service principal',
                        type: 'other',
                        criticality: category,
                        businessFunctions: []
                    }],
                    contractInfo: {
                        startDate: row['ContractStart'] || row['Date Debut'] || new Date().toISOString().split('T')[0],
                        endDate: row['ContractEnd'] || row['Date Fin'] || '',
                        exitStrategy: row['ExitStrategy'] || row['Strategie Sortie'] || '',
                        auditRights: ['true', 'yes', 'oui', '1'].includes((row['AuditRights'] || row['Droits Audit'] || '').toLowerCase())
                    },
                    compliance: {
                        doraCompliant: ['true', 'yes', 'oui', '1'].includes((row['DORACompliant'] || row['Conforme DORA'] || '').toLowerCase()),
                        certifications: (row['Certifications'] || '').split(',').map(c => c.trim()).filter(Boolean),
                        locationEU: ['true', 'yes', 'oui', '1', 'eu', 'europe'].includes((row['LocationEU'] || row['Localisation UE'] || 'true').toLowerCase())
                    },
                    riskAssessment: {
                        concentration: 0,
                        substitutability: 'medium',
                        lastAssessment: new Date().toISOString()
                    },
                    contactName: row['Contact'] || row['contact'] || '',
                    contactEmail: row['Email'] || row['email'] || '',
                    status: 'active',
                    createdAt: serverTimestamp() as unknown as string,
                    updatedAt: serverTimestamp() as unknown as string,
                    createdBy: userId
                };

                const newRef = doc(collection(db, this.COLLECTION));
                batch.set(newRef, sanitizeData(providerData));
                count++;
                batchCount++;

                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }

            return { imported: count, errors };
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.importFromCSV');
            throw error;
        }
    }

    /**
     * Get statistics for dashboard
     */
    static async getStats(organizationId: string): Promise<{
        total: number;
        critical: number;
        expiringSoon: number;
        nonCompliant: number;
    }> {
        try {
            const providers = await this.getAll(organizationId);

            const ninetyDays = new Date();
            ninetyDays.setDate(ninetyDays.getDate() + 90);
            const now = new Date();

            return {
                total: providers.length,
                critical: providers.filter(p => p.category === 'critical').length,
                expiringSoon: providers.filter(p => {
                    const endDate = parseDate(p.contractInfo?.endDate);
                    return endDate && endDate > now && endDate <= ninetyDays;
                }).length,
                nonCompliant: providers.filter(p => !p.compliance?.doraCompliant).length
            };
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.getStats');
            throw error;
        }
    }

    /**
     * Calculate overall risk score for a provider
     * Combines concentration, substitutability, and criticality
     * Story 35-2: ICT Risk Assessment
     */
    static calculateOverallRisk(provider: ICTProvider): number {
        const categoryWeight = { critical: 1.5, important: 1.2, standard: 1.0 };
        const substitutabilityImpact = { low: 20, medium: 10, high: 0 };

        const baseScore = provider.riskAssessment?.concentration || 0;
        const categoryMultiplier = categoryWeight[provider.category] || 1.0;
        const substitutabilityBonus = substitutabilityImpact[provider.riskAssessment?.substitutability || 'medium'];

        return Math.min(100, Math.round((baseScore * categoryMultiplier) + substitutabilityBonus));
    }

    /**
     * Get high-risk providers (concentration > 70 or overall risk > 70)
     * Story 35-2: ICT Risk Assessment
     */
    static async getHighRiskProviders(organizationId: string): Promise<ICTProvider[]> {
        try {
            const providers = await this.getAll(organizationId);
            return providers.filter(p => {
                const concentration = p.riskAssessment?.concentration || 0;
                const overallRisk = this.calculateOverallRisk(p);
                return concentration > 70 || overallRisk > 70;
            });
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.getHighRiskProviders');
            throw error;
        }
    }

    /**
     * Get providers with reassessment due (older than threshold days)
     * Story 35-2: ICT Risk Assessment
     */
    static async getReassessmentsDue(
        organizationId: string,
        thresholdDays: number = 365
    ): Promise<ICTProvider[]> {
        try {
            const providers = await this.getAll(organizationId);
            const thresholdDate = new Date();
            thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

            return providers.filter(p => {
                const lastAssessment = parseDate(p.riskAssessment?.lastAssessment);
                return !lastAssessment || lastAssessment < thresholdDate;
            });
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.getReassessmentsDue');
            throw error;
        }
    }

    /**
     * Get risk statistics for dashboard
     * Story 35-2: ICT Risk Assessment
     */
    static async getRiskStats(organizationId: string): Promise<{
        highRiskCount: number;
        mediumRiskCount: number;
        lowRiskCount: number;
        reassessmentsDueCount: number;
        averageConcentration: number;
    }> {
        try {
            const providers = await this.getAll(organizationId);
            const now = new Date();
            const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

            let highRisk = 0;
            let mediumRisk = 0;
            let lowRisk = 0;
            let reassessmentsDue = 0;
            let totalConcentration = 0;

            providers.forEach(p => {
                const overallRisk = this.calculateOverallRisk(p);
                if (overallRisk > 70) highRisk++;
                else if (overallRisk > 40) mediumRisk++;
                else lowRisk++;

                const lastAssessment = parseDate(p.riskAssessment?.lastAssessment);
                if (!lastAssessment || lastAssessment < oneYearAgo) reassessmentsDue++;

                totalConcentration += p.riskAssessment?.concentration || 0;
            });

            return {
                highRiskCount: highRisk,
                mediumRiskCount: mediumRisk,
                lowRiskCount: lowRisk,
                reassessmentsDueCount: reassessmentsDue,
                averageConcentration: providers.length > 0
                    ? Math.round(totalConcentration / providers.length)
                    : 0
            };
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderService.getRiskStats');
            throw error;
        }
    }

    // --- Private Helpers ---

    private static normalizeCategory(value: string): 'critical' | 'important' | 'standard' {
        const lower = value.toLowerCase().trim();
        if (['critical', 'critique', 'kritisch', 'critico'].includes(lower)) return 'critical';
        if (['important', 'importante', 'wichtig'].includes(lower)) return 'important';
        return 'standard';
    }
}
