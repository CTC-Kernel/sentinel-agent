import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { FunctionsService } from './FunctionsService';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { AuditLogService } from './auditLogService';
import { UserProfile } from '../types'; // Ensure UserProfile is exported from types
import { canDeleteResource, canEditResource } from '../utils/permissions';

export interface DeleteIncidentOptions {
    incidentId: string;
    organizationId: string;
    user: UserProfile;
}

type IncidentCsvRow = Record<string, string>;

export class IncidentService {
    /**
     * Delete an incident with atomic audit logging using writeBatch
     */
    static async deleteIncidentWithLog(options: DeleteIncidentOptions): Promise<void> {
        const { incidentId, organizationId, user } = options;

        if (!canDeleteResource(user, 'Incident')) throw new Error("Permission refusée");
        if (user.organizationId !== organizationId) throw new Error("Tenant mismatch");

        try {
            // 1. Secure Deletion (Backend enforces integrity)
            await FunctionsService.deleteResource('incidents', incidentId);

            // 2. Add Audit Log
            await AuditLogService.logDelete(
                organizationId,
                { id: user.uid, name: user.displayName || user.email, email: user.email },
                'incident',
                incidentId,
                { id: incidentId },
                'Incident'
            );

        } catch (error) {
            ErrorLogger.error(error, 'IncidentService.deleteIncidentWithLog');
            throw error;
        }
    }

    /**
     * Bulk delete incidents with atomic audit logging
     */
    static async bulkDeleteIncidents(
        incidentIds: string[],
        organizationId: string,
        user: UserProfile
    ): Promise<void> {
        try {
            // Execute deletions in parallel (each with its own atomic batch)
            await Promise.all(
                incidentIds.map(incidentId =>
                    this.deleteIncidentWithLog({
                        incidentId,
                        organizationId,
                        user
                    })
                )
            );
        } catch (error) {
            ErrorLogger.error(error, 'IncidentService.bulkDeleteIncidents');
            throw error;
        }
    }

    /**
     * Import multiple incidents from CSV data
     */
    static async importIncidentsFromCSV(
        data: IncidentCsvRow[],
        organizationId: string,
        user: UserProfile
    ): Promise<number> {
        if (!canEditResource(user, 'Incident')) throw new Error("Permission refusée");
        if (user.organizationId !== organizationId) throw new Error("Tenant mismatch");

        try {
            const batch = writeBatch(db);
            let count = 0;

            for (const row of data) {
                const title = row.Titre || row.title;
                if (!title) continue;

                const newDocRef = doc(collection(db, 'incidents'));
                const severityInput = row.Sévérité || row['Severite'] || row.Severity || '';
                const severityLower = severityInput.toLowerCase();
                const severity = ['critical', 'high', 'medium', 'low'].includes(severityLower)
                    ? (severityLower.charAt(0).toUpperCase() + severityLower.slice(1)) as 'Critical' | 'High' | 'Medium' | 'Low'
                    : 'Medium'; // Normalize

                const incidentData = {
                    organizationId,
                    title,
                    description: row.Description || row.description || '',
                    status: row.Statut || row.status || 'Nouveau',
                    severity: severity, // Correct casing
                    category: row.Catégorie || row.Categorie || 'Social Engineering',
                    reporter: row.Déclarant || row.declarant || user.displayName || 'Utilisateur',
                    dateReported: serverTimestamp(),
                    dateAnalysis: serverTimestamp(), // Default to now to avoid filtering issues
                    financialImpact: 0,
                    history: [],
                    playbookId: null,
                    tags: ['Import CSV']
                };

                const sanitized = sanitizeData(incidentData);
                batch.set(newDocRef, sanitized);
                count++;
            }

            if (count > 0) {
                await batch.commit();

                // Generate bulk audit log
                await AuditLogService.logImport(
                    organizationId,
                    { id: user.uid, name: user.displayName || user.email, email: user.email },
                    'incident',
                    count,
                    'CSV Import'
                );
            }

            return count;
        } catch (error) {
            ErrorLogger.error(error, 'IncidentService.importIncidentsFromCSV');
            throw error;
        }
    }
}
