/**
 * DORA (Digital Operational Resilience Act) Types
 * ADR-008: ICT Provider Management for DORA Art. 28 compliance
 *
 * Reference: Regulation (EU) 2022/2554 - DORA
 * Deadline: Financial institutions must report to ESA by April 30, 2025
 */

import { FirestoreTimestampLike } from './common';

/**
 * ICT Provider criticality levels per DORA classification
 */
export const ICT_CRITICALITY_LEVELS = ['critical', 'important', 'standard'] as const;
export type ICTCriticality = typeof ICT_CRITICALITY_LEVELS[number];

/**
 * ICT Service types for categorization
 */
export const ICT_SERVICE_TYPES = [
    'cloud',
    'software',
    'infrastructure',
    'security',
    'telecom',
    'data_analytics',
    'payment',
    'other'
] as const;
export type ICTServiceType = typeof ICT_SERVICE_TYPES[number];

/**
 * Substitutability assessment levels
 */
export const SUBSTITUTABILITY_LEVELS = ['low', 'medium', 'high'] as const;
export type SubstitutabilityLevel = typeof SUBSTITUTABILITY_LEVELS[number];

/**
 * Common certifications for ICT providers
 */
export const ICT_CERTIFICATIONS = [
    'ISO 27001',
    'ISO 22301',
    'SOC 2 Type I',
    'SOC 2 Type II',
    'SOC 1',
    'PCI DSS',
    'HDS',
    'CSA STAR',
    'ISAE 3402',
    'C5',
    'SecNumCloud'
] as const;
export type ICTCertification = typeof ICT_CERTIFICATIONS[number];

/**
 * ICT Service - Individual service provided by an ICT provider
 */
export interface ICTService {
    id: string;
    name: string;
    type: ICTServiceType;
    criticality: ICTCriticality;
    description?: string;
    businessFunctions: string[]; // Which business functions depend on this service
    dataProcessed?: boolean; // Does this service process sensitive data?
}

/**
 * Contract information for ICT provider
 */
export interface ICTContractInfo {
    startDate: string | FirestoreTimestampLike;
    endDate: string | FirestoreTimestampLike;
    exitStrategy: string;
    auditRights: boolean;
    contractValue?: number;
    currency?: string;
    renewalType?: 'auto' | 'manual' | 'fixed';
    noticePeriodDays?: number;
}

/**
 * Risk assessment for ICT provider
 */
export interface ICTRiskAssessment {
    concentration: number; // 0-100 - How concentrated is the risk?
    substitutability: SubstitutabilityLevel;
    lastAssessment: string | FirestoreTimestampLike;
    assessedBy?: string;
    notes?: string;
}

/**
 * Compliance information for ICT provider
 */
export interface ICTComplianceInfo {
    doraCompliant: boolean;
    certifications: string[];
    locationEU: boolean;
    headquartersCountry?: string;
    dataProcessingLocations?: string[];
    subcontractors?: ICTSubcontractor[];
}

/**
 * Subcontractor information
 */
export interface ICTSubcontractor {
    id: string;
    name: string;
    service: string;
    locationEU: boolean;
}

/**
 * ICT Provider - Main entity for DORA register
 * DORA Art. 28 - Register of information on ICT third-party service providers
 */
export interface ICTProvider {
    id: string;
    organizationId: string;

    // Basic Information
    name: string;
    category: ICTCriticality;
    description?: string;

    // Services
    services: ICTService[];

    // Contract
    contractInfo: ICTContractInfo;

    // Risk Assessment
    riskAssessment: ICTRiskAssessment;

    // Compliance
    compliance: ICTComplianceInfo;

    // Contact Information
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    website?: string;

    // Relationships
    linkedAssetIds?: string[];
    linkedRiskIds?: string[];
    linkedControlIds?: string[];

    // Metadata
    status: 'active' | 'inactive' | 'pending' | 'terminated';
    createdAt: string | FirestoreTimestampLike;
    updatedAt: string | FirestoreTimestampLike;
    createdBy: string;
    updatedBy?: string;

    // DORA specific
    doraRegisterId?: string; // Internal reference ID for DORA register
    lastReportDate?: string | FirestoreTimestampLike;
}

/**
 * ICT Provider form data (for creating/editing)
 */
export type ICTProviderFormData = Omit<ICTProvider, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;

/**
 * ICT Provider filter options
 */
export interface ICTProviderFilters {
    category?: ICTCriticality;
    doraCompliant?: boolean;
    contractExpiringSoon?: boolean; // Within 90 days
    searchTerm?: string;
    status?: ICTProvider['status'];
}

/**
 * DORA Register Export format for ESA reporting
 */
export interface DORARegisterExport {
    reportingEntity: {
        name: string;
        lei?: string; // Legal Entity Identifier
        country: string;
    };
    reportingDate: string;
    ictProviders: DORAProviderReport[];
    concentrationAnalysis: ConcentrationAnalysis;
    generatedAt: string;
    version: string;
}

/**
 * Single provider report for DORA register
 */
export interface DORAProviderReport {
    providerId: string;
    providerName: string;
    category: ICTCriticality;
    services: {
        name: string;
        type: ICTServiceType;
        criticality: ICTCriticality;
    }[];
    contractEndDate: string;
    exitStrategyExists: boolean;
    auditRightsGranted: boolean;
    euLocation: boolean;
    certifications: string[];
    concentrationRisk: number;
    substitutability: SubstitutabilityLevel;
}

/**
 * Concentration analysis for DORA reporting
 */
export interface ConcentrationAnalysis {
    totalProviders: number;
    criticalProviders: number;
    importantProviders: number;
    standardProviders: number;
    averageConcentrationRisk: number;
    highConcentrationProviders: string[]; // Provider IDs with concentration > 70
    nonEuProviders: string[]; // Provider IDs with non-EU location
    expiringContracts: {
        within30Days: number;
        within90Days: number;
    };
}

/**
 * ICT Provider import row (for CSV import)
 */
export interface ICTProviderImportRow {
    name: string;
    category: string;
    services?: string;
    contractStartDate?: string;
    contractEndDate?: string;
    exitStrategy?: string;
    auditRights?: string;
    doraCompliant?: string;
    certifications?: string;
    locationEU?: string;
    contactName?: string;
    contactEmail?: string;
}

/**
 * Import validation result
 */
export interface ICTProviderImportValidation {
    isValid: boolean;
    row: number;
    errors: string[];
    warnings: string[];
    data?: Partial<ICTProviderFormData>;
}
