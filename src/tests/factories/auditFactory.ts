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
 framework?: Audit['framework'];
}

export function createAudit(options: AuditFactoryOptions = {}): Audit {
 auditCounter++;
 const id = options.id || `audit-${auditCounter}`;

 return {
 id,
 organizationId: options.organizationId || 'org-test',
 name: `Test Audit ${auditCounter}`,
 auditor: 'Test Auditor',
 dateScheduled: new Date().toISOString(),
 findingsCount: 0,
 description: `Description for audit ${auditCounter}`,
 type: options.type || 'Interne',
 status: options.status || 'Planifié',
 framework: options.framework || 'ISO27001',
 scope: 'Full organization',
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
