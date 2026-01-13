import { Framework } from './common';

export type PlanType = 'discovery' | 'professional' | 'enterprise';

export interface PlanLimits {
    maxUsers: number;
    maxProjects: number;
    maxAssets: number;
    maxStorageGB: number;
    maxFrameworks: number;
    features: {
        apiAccess: boolean;
        sso: boolean;
        whiteLabelReports: boolean;
        customTemplates: boolean;
        aiAssistant: boolean;
    };
}

export interface Subscription {
    planId: PlanType;
    status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
    currentPeriodEnd: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    cancelAtPeriodEnd: boolean;
    customLimits?: Partial<PlanLimits>;
}

export interface Organization {
    id: string;
    name: string;
    slug: string; // unique identifier for urls e.g. app.sentinel.com/org-slug
    domain?: string; // for auto-joining
    ownerId: string; // the user who created the org (billing contact)
    subscription: Subscription;
    logoUrl?: string;
    address?: string;
    vatNumber?: string;
    contactEmail?: string;
    createdAt: string;
    updatedAt: string;
    isActive?: boolean;
    storageUsed?: number; // in bytes
    settings?: {
        theme?: 'light' | 'dark' | 'system';
        language?: 'fr' | 'en';
        enableSecNumCloudStorage?: boolean;
        aiSettings?: {
            enabled: boolean;
            consentGiven: boolean;
            dataSanitization: boolean;
        };
    };
    enabledFrameworks?: Framework[];
}

export interface JoinRequest {
    id: string;
    userId: string;
    displayName: string;
    userEmail: string;
    organizationId: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectedBy?: string;
    rejectedAt?: string;
}
