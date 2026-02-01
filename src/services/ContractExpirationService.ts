/**
 * Contract Expiration Service
 * Story 35-4: Contract Expiration Alerts
 *
 * Detects and classifies ICT provider contracts approaching expiration
 * for DORA Art. 28 compliance
 */

import { ICTProvider, ICTCriticality } from '../types/dora';
import { parseDate } from '../utils/dateUtils';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';

/**
 * Urgency levels for expiring contracts
 */
export type ExpirationUrgency = 'critical' | 'warning' | 'notice' | 'expired';

/**
 * Default expiration thresholds in days
 */
export interface ExpirationThresholds {
    critical: number;  // Default: 30 days
    warning: number;   // Default: 60 days
    notice: number;    // Default: 90 days
}

/**
 * Expiring contract information
 */
export interface ExpiringContract {
    providerId: string;
    providerName: string;
    category: ICTCriticality;
    endDate: string;
    daysRemaining: number;
    urgency: ExpirationUrgency;
    hasExitStrategy: boolean;
    hasAuditRights: boolean;
    contactEmail?: string;
}

/**
 * Grouped expiring contracts by urgency
 */
export interface ExpiringContractsGrouped {
    expired: ExpiringContract[];
    critical: ExpiringContract[];
    warning: ExpiringContract[];
    notice: ExpiringContract[];
    total: number;
}

/**
 * Alert configuration stored in organization settings
 */
export interface DORAAlertConfig {
    enabled: boolean;
    thresholds: ExpirationThresholds;
    notifyRoles: string[];
    emailDigestEnabled: boolean;
    lastChecked?: string;
}

const DEFAULT_THRESHOLDS: ExpirationThresholds = {
    critical: 30,
    warning: 60,
    notice: 90
};

const DEFAULT_ALERT_CONFIG: DORAAlertConfig = {
    enabled: true,
    thresholds: DEFAULT_THRESHOLDS,
    notifyRoles: ['admin', 'rssi'],
    emailDigestEnabled: true
};

/**
 * Contract Expiration Service
 */
export class ContractExpirationService {
    /**
     * Calculate days remaining until contract expiration
     */
    static calculateDaysRemaining(endDate: unknown): number | null {
        const date = parseDate(endDate);
        if (!date || isNaN(date.getTime())) return null;

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);

        const diffTime = date.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Classify urgency based on days remaining
     */
    static classifyUrgency(
        daysRemaining: number,
        thresholds: ExpirationThresholds = DEFAULT_THRESHOLDS
    ): ExpirationUrgency {
        if (daysRemaining <= 0) return 'expired';
        if (daysRemaining <= thresholds.critical) return 'critical';
        if (daysRemaining <= thresholds.warning) return 'warning';
        if (daysRemaining <= thresholds.notice) return 'notice';
        return 'notice'; // Beyond notice threshold but still included
    }

    /**
     * Check if a single provider's contract is expiring
     */
    static checkContractExpiration(
        provider: ICTProvider,
        thresholds: ExpirationThresholds = DEFAULT_THRESHOLDS
    ): ExpiringContract | null {
        const endDate = provider.contractInfo?.endDate;
        if (!endDate) return null;

        const daysRemaining = this.calculateDaysRemaining(endDate);
        if (daysRemaining === null) return null;

        // Only return if within notice threshold or expired
        if (daysRemaining > thresholds.notice) return null;

        return {
            providerId: provider.id,
            providerName: provider.name,
            category: provider.category,
            endDate: typeof endDate === 'string' ? endDate : new Date(endDate as number).toISOString(),
            daysRemaining,
            urgency: this.classifyUrgency(daysRemaining, thresholds),
            hasExitStrategy: !!provider.contractInfo?.exitStrategy,
            hasAuditRights: provider.contractInfo?.auditRights || false,
            contactEmail: provider.contactEmail
        };
    }

    /**
     * Get all expiring contracts for an organization, grouped by urgency
     */
    static async getExpiringContracts(
        organizationId: string,
        thresholds: ExpirationThresholds = DEFAULT_THRESHOLDS
    ): Promise<ExpiringContractsGrouped> {
        try {
            const q = query(
                collection(db, 'ict_providers'),
                where('organizationId', '==', organizationId),
                where('status', '==', 'active')
            );

            const snapshot = await getDocs(q);
            const providers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ICTProvider[];

            return this.groupExpiringContracts(providers, thresholds);
        } catch (error) {
            ErrorLogger.error(error, 'ContractExpirationService.getExpiringContracts');
            return {
                expired: [],
                critical: [],
                warning: [],
                notice: [],
                total: 0
            };
        }
    }

    /**
     * Group providers by expiration urgency
     */
    static groupExpiringContracts(
        providers: ICTProvider[],
        thresholds: ExpirationThresholds = DEFAULT_THRESHOLDS
    ): ExpiringContractsGrouped {
        const result: ExpiringContractsGrouped = {
            expired: [],
            critical: [],
            warning: [],
            notice: [],
            total: 0
        };

        for (const provider of providers) {
            const expiring = this.checkContractExpiration(provider, thresholds);
            if (expiring) {
                result[expiring.urgency].push(expiring);
                result.total++;
            }
        }

        // Sort each group by days remaining (most urgent first)
        result.expired.sort((a, b) => a.daysRemaining - b.daysRemaining);
        result.critical.sort((a, b) => a.daysRemaining - b.daysRemaining);
        result.warning.sort((a, b) => a.daysRemaining - b.daysRemaining);
        result.notice.sort((a, b) => a.daysRemaining - b.daysRemaining);

        return result;
    }

    /**
     * Get expiration stats for dashboard
     */
    static getExpirationStats(grouped: ExpiringContractsGrouped): {
        expiredCount: number;
        criticalCount: number;
        warningCount: number;
        noticeCount: number;
        total: number;
        hasUrgent: boolean;
    } {
        return {
            expiredCount: grouped.expired.length,
            criticalCount: grouped.critical.length,
            warningCount: grouped.warning.length,
            noticeCount: grouped.notice.length,
            total: grouped.total,
            hasUrgent: grouped.expired.length > 0 || grouped.critical.length > 0
        };
    }

    /**
     * Get alert configuration for an organization
     */
    static async getAlertConfig(organizationId: string): Promise<DORAAlertConfig> {
        try {
            const configRef = doc(db, 'organizations', organizationId, 'settings', 'dora_alerts');
            const configSnap = await getDoc(configRef);

            if (configSnap.exists()) {
                return { ...DEFAULT_ALERT_CONFIG, ...configSnap.data() } as DORAAlertConfig;
            }

            return DEFAULT_ALERT_CONFIG;
        } catch (error) {
            ErrorLogger.error(error, 'ContractExpirationService.getAlertConfig');
            return DEFAULT_ALERT_CONFIG;
        }
    }

    /**
     * Save alert configuration for an organization
     */
    static async saveAlertConfig(
        organizationId: string,
        config: Partial<DORAAlertConfig>
    ): Promise<void> {
        try {
            const configRef = doc(db, 'organizations', organizationId, 'settings', 'dora_alerts');
            await setDoc(configRef, sanitizeData({
                ...DEFAULT_ALERT_CONFIG,
                ...config,
                updatedAt: serverTimestamp()
            }), { merge: true });
        } catch (error) {
            ErrorLogger.error(error, 'ContractExpirationService.saveAlertConfig');
            throw error;
        }
    }

    /**
     * Format expiration message for notifications
     */
    static formatExpirationMessage(contract: ExpiringContract, lang: 'fr' | 'en' = 'fr'): string {
        const messages = {
            fr: {
                expired: `Le contrat avec ${contract.providerName} a expiré`,
                critical: `Le contrat avec ${contract.providerName} expire dans ${contract.daysRemaining} jour(s)`,
                warning: `Le contrat avec ${contract.providerName} expire dans ${contract.daysRemaining} jours`,
                notice: `Le contrat avec ${contract.providerName} expire dans ${contract.daysRemaining} jours`
            },
            en: {
                expired: `Contract with ${contract.providerName} has expired`,
                critical: `Contract with ${contract.providerName} expires in ${contract.daysRemaining} day(s)`,
                warning: `Contract with ${contract.providerName} expires in ${contract.daysRemaining} days`,
                notice: `Contract with ${contract.providerName} expires in ${contract.daysRemaining} days`
            }
        };

        return messages[lang][contract.urgency];
    }

    /**
     * Get notification title based on urgency
     */
    static getNotificationTitle(urgency: ExpirationUrgency, count: number, lang: 'fr' | 'en' = 'fr'): string {
        const titles = {
            fr: {
                expired: `${count} contrat(s) expiré(s)`,
                critical: `${count} contrat(s) expire(nt) sous 30 jours`,
                warning: `${count} contrat(s) expire(nt) sous 60 jours`,
                notice: `${count} contrat(s) expire(nt) sous 90 jours`
            },
            en: {
                expired: `${count} contract(s) expired`,
                critical: `${count} contract(s) expiring within 30 days`,
                warning: `${count} contract(s) expiring within 60 days`,
                notice: `${count} contract(s) expiring within 90 days`
            }
        };

        return titles[lang][urgency];
    }

    /**
     * Get urgency badge color classes
     */
    static getUrgencyColor(urgency: ExpirationUrgency): {
        bg: string;
        text: string;
        border: string;
    } {
        const colors = {
            expired: {
                bg: 'bg-slate-100 dark:bg-slate-800',
                text: 'text-slate-700 dark:text-slate-300',
                border: 'border-slate-300 dark:border-slate-600'
            },
            critical: {
                bg: 'bg-red-50 dark:bg-red-900/20',
                text: 'text-red-700 dark:text-red-400',
                border: 'border-red-200 dark:border-red-800'
            },
            warning: {
                bg: 'bg-amber-50 dark:bg-amber-900/20',
                text: 'text-amber-700 dark:text-amber-400',
                border: 'border-amber-200 dark:border-amber-800'
            },
            notice: {
                bg: 'bg-yellow-50 dark:bg-yellow-900/20',
                text: 'text-yellow-700 dark:text-yellow-400',
                border: 'border-yellow-200 dark:border-yellow-800'
            }
        };

        return colors[urgency];
    }
}
