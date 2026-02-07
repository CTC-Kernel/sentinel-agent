/**
 * Document Test Factory
 * Creates mock Document objects for testing
 */

import { Document } from '../../types';

let documentCounter = 0;

export interface DocumentFactoryOptions {
 id?: string;
 organizationId?: string;
 title?: string;
 type?: Document['type'];
 status?: Document['status'];
 category?: string;
 version?: string;
 ownerId?: string;
}

export function createDocument(options: DocumentFactoryOptions = {}): Document {
 documentCounter++;
 const id = options.id || `doc-${documentCounter}`;

 return {
 id,
 organizationId: options.organizationId || 'org-test',
 title: options.title || `Test Document ${documentCounter}`,
 description: `Description for document ${documentCounter}`,
 type: options.type || 'Politique',
 status: options.status || 'Brouillon',
 version: options.version || '1.0',
 owner: 'Document Owner',
 ownerId: options.ownerId || 'user-1',
 url: `https://storage.example.com/docs/${id}.pdf`,
 relatedRiskIds: [],
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString(),
 };
}

export function createDocumentList(count: number, options: DocumentFactoryOptions = {}): Document[] {
 return Array.from({ length: count }, () => createDocument(options));
}

export function createApprovedDocument(options: DocumentFactoryOptions = {}): Document {
 return createDocument({
 ...options,
 status: 'Approuvé',
 });
}

export function createArchivedDocument(options: DocumentFactoryOptions = {}): Document {
 return createDocument({
 ...options,
 status: 'Archivé',
 });
}

export function resetDocumentCounter(): void {
 documentCounter = 0;
}
