/**
 * Audit Log Service - Compliance-grade audit trail for GRC
 *
 * Provides immutable audit logging for all entity operations
 * to meet regulatory requirements (ISO 27001, NIS 2, GDPR).
 *
 * @module auditLogService
 */

import { collection, doc, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';

/**
 * Supported audit actions
 */
export const AUDIT_ACTIONS = [
    'create',
    'update',
    'delete',
    'view',
    'export',
    'import',
    'login',
    'logout',
    'permission_change',
    'status_change',
    'share',
    'archive',
    'restore'
] as const;

export type AuditAction = typeof AUDIT_ACTIONS[number];

/**
 * Entity types that can be audited
 */
export const AUDITABLE_ENTITIES = [
    'risk',
    'control',
    'asset',
    'document',
    'audit',
    'finding',
    'incident',
    'supplier',
    'project',
    'user',
    'organization',
    'processing_activity',
    'business_process',
    'vulnerability',
    'playbook',
    'training_course',
    'training_assignment',
    'training_campaign',
    'certificate',
    'access_review',
    'access_review_campaign',
    'dormant_account'
] as const;

export type AuditableEntity = typeof AUDITABLE_ENTITIES[number];

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
    /** Organization context for tenant isolation */
    organizationId: string;
    /** User who performed the action */
    userId: string;
    /** User display name */
    userName: string;
    /** User email for compliance */
    userEmail: string;
    /** Action performed */
    action: AuditAction;
    /** Resource type (collection name) */
    resource: string;
    /** Entity type for filtering */
    entityType: AuditableEntity;
    /** ID of the affected entity */
    entityId: string;
    /** Entity name for display */
    entityName?: string;
    /** State before action (for update/delete) */
    before?: Record<string, unknown>;
    /** State after action (for create/update) */
    after?: Record<string, unknown>;
    /** List of changed field names */
    changes?: string[];
    /** Additional context details */
    details?: string;
    /** Metadata (IP, user agent, etc.) */
    metadata?: {
        ipAddress?: string;
        userAgent?: string;
        sessionId?: string;
        source?: 'web' | 'api' | 'mobile' | 'import';
    };
    /** Server-managed timestamp */
    timestamp?: ReturnType<typeof serverTimestamp>;
}

/**
 * Input for creating an audit log
 */
export interface CreateAuditLogInput {
    organizationId: string;
    userId: string;
    userName: string;
    userEmail: string;
    action: AuditAction;
    entityType: AuditableEntity;
    entityId: string;
    entityName?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    details?: string;
    metadata?: AuditLogEntry['metadata'];
}

/**
 * Fields to exclude from diff calculation (sensitive or technical)
 */
const EXCLUDED_DIFF_FIELDS = [
    'updatedAt',
    'createdAt',
    'updatedBy',
    'createdBy',
    'timestamp',
    '__v',
    '_id',
    'id',
    'organizationId'
];

/**
 * Calculate the diff between two object states
 */
function calculateChanges(
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown> | undefined
): string[] {
    if (!before && !after) return [];
    if (!before) return Object.keys(after || {}).filter(k => !EXCLUDED_DIFF_FIELDS.includes(k));
    if (!after) return Object.keys(before).filter(k => !EXCLUDED_DIFF_FIELDS.includes(k));

    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
        if (EXCLUDED_DIFF_FIELDS.includes(key)) continue;

        const beforeVal = before[key];
        const afterVal = after[key];

        // Deep comparison for objects/arrays
        if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
            changes.push(key);
        }
    }

    return changes;
}

/**
 * Sanitize data for storage (remove sensitive fields, limit size)
 */
function sanitizeForStorage(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!data) return undefined;

    const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'apiKey', 'privateKey'];
    const MAX_FIELD_LENGTH = 1000;

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
        // Skip sensitive fields
        if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))) {
            sanitized[key] = '[REDACTED]';
            continue;
        }

        // Truncate long strings
        if (typeof value === 'string' && value.length > MAX_FIELD_LENGTH) {
            sanitized[key] = value.substring(0, MAX_FIELD_LENGTH) + '...[truncated]';
            continue;
        }

        // Handle nested objects recursively (1 level deep)
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            sanitized[key] = sanitizeForStorage(value as Record<string, unknown>);
            continue;
        }

        sanitized[key] = value;
    }

    return sanitized;
}

/**
 * Map entity type to Firestore collection name
 */
function getCollectionName(entityType: AuditableEntity): string {
    const mapping: Record<AuditableEntity, string> = {
        risk: 'risks',
        control: 'controls',
        asset: 'assets',
        document: 'documents',
        audit: 'audits',
        finding: 'findings',
        incident: 'incidents',
        supplier: 'suppliers',
        project: 'projects',
        user: 'users',
        organization: 'organizations',
        processing_activity: 'processing_activities',
        business_process: 'business_processes',
        vulnerability: 'vulnerabilities',
        playbook: 'incidentPlaybooks',
        training_course: 'training_catalog',
        training_assignment: 'training_assignments',
        training_campaign: 'training_campaigns',
        certificate: 'certificates',
        access_review: 'access_reviews',
        access_review_campaign: 'access_review_campaigns',
        dormant_account: 'dormant_accounts'
    };

    return mapping[entityType] || entityType;
}

export class AuditLogService {
    /**
     * Create a single audit log entry
     */
    static async log(input: CreateAuditLogInput): Promise<string> {
        try {
            const changes = calculateChanges(input.before, input.after);

            const entry: AuditLogEntry = {
                organizationId: input.organizationId,
                userId: input.userId,
                userName: input.userName,
                userEmail: input.userEmail,
                action: input.action,
                resource: getCollectionName(input.entityType),
                entityType: input.entityType,
                entityId: input.entityId,
                ...(input.entityName ? { entityName: input.entityName } : {}),
                ...(input.before ? { before: sanitizeForStorage(input.before) } : {}),
                ...(input.after ? { after: sanitizeForStorage(input.after) } : {}),
                ...(changes.length > 0 ? { changes } : {}),
                ...(input.details ? { details: input.details } : {}),
                ...(input.metadata ? { metadata: input.metadata } : {}),
                timestamp: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'system_logs'), entry);
            return docRef.id;
        } catch (error) {
            ErrorLogger.error(error, 'AuditLogService.log', {
                action: input.action,
                metadata: { entityType: input.entityType, entityId: input.entityId }
            });
            throw error;
        }
    }

    /**
     * Log entity creation
     */
    static async logCreate(
        organizationId: string,
        user: { id: string; name: string; email: string },
        entityType: AuditableEntity,
        entityId: string,
        entityData: Record<string, unknown>,
        entityName?: string
    ): Promise<string> {
        return this.log({
            organizationId,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action: 'create',
            entityType,
            entityId,
            entityName: entityName || (entityData.name as string) || (entityData.title as string),
            after: entityData
        });
    }

    /**
     * Log entity update
     */
    static async logUpdate(
        organizationId: string,
        user: { id: string; name: string; email: string },
        entityType: AuditableEntity,
        entityId: string,
        beforeData: Record<string, unknown>,
        afterData: Record<string, unknown>,
        entityName?: string
    ): Promise<string> {
        return this.log({
            organizationId,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action: 'update',
            entityType,
            entityId,
            entityName: entityName || (afterData.name as string) || (afterData.title as string),
            before: beforeData,
            after: afterData
        });
    }

    /**
     * Log entity deletion
     */
    static async logDelete(
        organizationId: string,
        user: { id: string; name: string; email: string },
        entityType: AuditableEntity,
        entityId: string,
        entityData: Record<string, unknown>,
        entityName?: string
    ): Promise<string> {
        return this.log({
            organizationId,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action: 'delete',
            entityType,
            entityId,
            entityName: entityName || (entityData.name as string) || (entityData.title as string),
            before: entityData
        });
    }

    /**
     * Log status change (specialized update)
     */
    static async logStatusChange(
        organizationId: string,
        user: { id: string; name: string; email: string },
        entityType: AuditableEntity,
        entityId: string,
        entityName: string,
        oldStatus: string,
        newStatus: string
    ): Promise<string> {
        return this.log({
            organizationId,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action: 'status_change',
            entityType,
            entityId,
            entityName,
            before: { status: oldStatus },
            after: { status: newStatus },
            details: `Statut: ${oldStatus} -> ${newStatus}`
        });
    }

    /**
     * Log data export (for compliance)
     */
    static async logExport(
        organizationId: string,
        user: { id: string; name: string; email: string },
        entityType: AuditableEntity,
        format: string,
        count: number,
        filters?: Record<string, unknown>
    ): Promise<string> {
        return this.log({
            organizationId,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action: 'export',
            entityType,
            entityId: 'bulk',
            details: `Export ${entityType}: ${count} enregistrement(s) au format ${format}`,
            metadata: {
                source: 'web'
            },
            after: {
                format,
                count,
                filters
            }
        });
    }

    /**
     * Log data import
     */
    static async logImport(
        organizationId: string,
        user: { id: string; name: string; email: string },
        entityType: AuditableEntity,
        count: number,
        source: string
    ): Promise<string> {
        return this.log({
            organizationId,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action: 'import',
            entityType,
            entityId: 'bulk',
            details: `Import ${entityType}: ${count} enregistrement(s) depuis ${source}`,
            after: {
                count,
                source
            }
        });
    }

    /**
     * Log user login
     */
    static async logLogin(
        organizationId: string,
        user: { id: string; name: string; email: string },
        metadata?: AuditLogEntry['metadata']
    ): Promise<string> {
        return this.log({
            organizationId,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action: 'login',
            entityType: 'user',
            entityId: user.id,
            details: 'Connexion utilisateur',
            metadata
        });
    }

    /**
     * Log user logout
     */
    static async logLogout(
        organizationId: string,
        user: { id: string; name: string; email: string }
    ): Promise<string> {
        return this.log({
            organizationId,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action: 'logout',
            entityType: 'user',
            entityId: user.id,
            details: 'Deconnexion utilisateur'
        });
    }

    /**
     * Log permission change
     */
    static async logPermissionChange(
        organizationId: string,
        admin: { id: string; name: string; email: string },
        targetUserId: string,
        targetUserName: string,
        oldRole: string,
        newRole: string
    ): Promise<string> {
        return this.log({
            organizationId,
            userId: admin.id,
            userName: admin.name,
            userEmail: admin.email,
            action: 'permission_change',
            entityType: 'user',
            entityId: targetUserId,
            entityName: targetUserName,
            before: { role: oldRole },
            after: { role: newRole },
            details: `Role: ${oldRole} -> ${newRole}`
        });
    }

    /**
     * Log entity sharing (audit portal, etc.)
     */
    static async logShare(
        organizationId: string,
        user: { id: string; name: string; email: string },
        entityType: AuditableEntity,
        entityId: string,
        entityName: string,
        shareDetails: { type: string; recipients?: string[] }
    ): Promise<string> {
        return this.log({
            organizationId,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action: 'share',
            entityType,
            entityId,
            entityName,
            details: `Partage ${shareDetails.type}${shareDetails.recipients ? ` vers: ${shareDetails.recipients.join(', ')}` : ''}`,
            after: shareDetails
        });
    }

    /**
     * Batch log multiple entries efficiently
     */
    static async logBatch(entries: CreateAuditLogInput[]): Promise<void> {
        if (entries.length === 0) return;

        try {
            const BATCH_SIZE = 500;

            for (let i = 0; i < entries.length; i += BATCH_SIZE) {
                const chunk = entries.slice(i, i + BATCH_SIZE);
                const batch = writeBatch(db);

                for (const input of chunk) {
                    const changes = calculateChanges(input.before, input.after);
                    const entry: AuditLogEntry = {
                        organizationId: input.organizationId,
                        userId: input.userId,
                        userName: input.userName,
                        userEmail: input.userEmail,
                        action: input.action,
                        resource: getCollectionName(input.entityType),
                        entityType: input.entityType,
                        entityId: input.entityId,
                        ...(input.entityName ? { entityName: input.entityName } : {}),
                        ...(input.before ? { before: sanitizeForStorage(input.before) } : {}),
                        ...(input.after ? { after: sanitizeForStorage(input.after) } : {}),
                        ...(changes.length > 0 ? { changes } : {}),
                        ...(input.details ? { details: input.details } : {}),
                        ...(input.metadata ? { metadata: input.metadata } : {}),
                        timestamp: serverTimestamp()
                    };

                    const docRef = doc(collection(db, 'system_logs'));
                    batch.set(docRef, entry);
                }

                await batch.commit();
            }
        } catch (error) {
            ErrorLogger.error(error, 'AuditLogService.logBatch');
            throw error;
        }
    }

    /**
     * Get human-readable action label (French)
     */
    static getActionLabel(action: AuditAction): string {
        const labels: Record<AuditAction, string> = {
            create: 'Creation',
            update: 'Modification',
            delete: 'Suppression',
            view: 'Consultation',
            export: 'Export',
            import: 'Import',
            login: 'Connexion',
            logout: 'Deconnexion',
            permission_change: 'Changement de permission',
            status_change: 'Changement de statut',
            share: 'Partage',
            archive: 'Archivage',
            restore: 'Restauration'
        };

        return labels[action] || action;
    }

    /**
     * Get human-readable entity type label (French)
     */
    static getEntityLabel(entityType: AuditableEntity): string {
        const labels: Record<AuditableEntity, string> = {
            risk: 'Risque',
            control: 'Controle',
            asset: 'Actif',
            document: 'Document',
            audit: 'Audit',
            finding: 'Constat',
            incident: 'Incident',
            supplier: 'Fournisseur',
            project: 'Projet',
            user: 'Utilisateur',
            organization: 'Organisation',
            processing_activity: 'Traitement',
            business_process: 'Processus',
            vulnerability: 'Vulnerabilite',
            playbook: 'Playbook',
            training_course: 'Formation',
            training_assignment: 'Assignation de formation',
            training_campaign: 'Campagne de formation',
            certificate: 'Certificat',
            access_review: 'Revue d\'accès',
            access_review_campaign: 'Campagne de revue d\'accès',
            dormant_account: 'Compte dormant'
        };

        return labels[entityType] || entityType;
    }
}
