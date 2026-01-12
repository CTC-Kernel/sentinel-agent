/**
 * Audit Test Factory
 * Creates mock Audit objects for testing
 */

import { Audit } from '../../types';

let auditCounter = 0;

export interface AuditFactoryOptions {
    id?: string;
    organizationId?: string;
    title?: string;
    type?: Audit['type'];
    status?: Audit['status'];
    framework?: string;
    startDate?: string;
    endDate?: string;
    leadAuditorId?: string;
}

export function createAudit(options: AuditFactoryOptions = {}): Audit {
    auditCounter++;
    const id = options.id || `audit-${auditCounter}`;
    const startDate = options.startDate || new Date().toISOString();

    return {
        id,
        organizationId: options.organizationId || 'org-test',
        title: options.title || `Test Audit ${auditCounter}`,
        description: `Description for audit ${auditCounter}`,
        type: options.type || 'Interne',
        status: options.status || 'Planifié',
        framework: options.framework || 'ISO27001',
        scope: 'Full organization',
        startDate,
        endDate: options.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        leadAuditor: 'Lead Auditor',
        leadAuditorId: options.leadAuditorId || 'user-1',
        auditorIds: [],
        findingIds: [],
        checklistIds: [],
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

export function createAuditList(count: number, options: AuditFactoryOptions = {}): Audit[] {
    return Array.from({ length: count }, () => createAudit(options));
}

export function createCompletedAudit(options: AuditFactoryOptions = {}): Audit {
    return createAudit({
        ...options,
        status: 'Terminé',
    });
}

export function createInProgressAudit(options: AuditFactoryOptions = {}): Audit {
    return createAudit({
        ...options,
        status: 'En cours',
    });
}

export function resetAuditCounter(): void {
    auditCounter = 0;
}
