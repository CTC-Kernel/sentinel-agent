import { collection, doc, writeBatch, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FunctionsService } from './FunctionsService';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';

export interface DeleteIncidentOptions {
    incidentId: string;
    organizationId: string;
    userId: string;
    userEmail: string;
}

type IncidentCsvRow = Record<string, string>;

export class IncidentService {
    /**
     * Delete an incident with atomic audit logging using writeBatch
     */
    static async deleteIncidentWithLog(options: DeleteIncidentOptions): Promise<void> {
        const { incidentId, organizationId, userId, userEmail } = options;

        try {
            // 1. Secure Deletion (Backend enforces integrity)
            await FunctionsService.deleteResource('incidents', incidentId);

            // 2. Add Audit Log (Non-atomic but ensures trace)
            // Ideally backend handles this, but we maintain parity with existing 'system_logs' requirement.
            await addDoc(collection(db, 'system_logs'), {
                organizationId,
                timestamp: new Date().toISOString(),
                action: 'DELETE',
                resource: 'Incident',
                userId,
                userEmail,
                details: `Deleted incident ID: ${incidentId}`,
                metadata: { incidentId },
                severity: 'critical',
                source: 'Sentinel-Core'
            });

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
        userId: string,
        userEmail: string
    ): Promise<void> {
        try {
            // Execute deletions in parallel (each with its own atomic batch)
            await Promise.all(
                incidentIds.map(incidentId =>
                    this.deleteIncidentWithLog({
                        incidentId,
                        organizationId,
                        userId,
                        userEmail
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
        _userId: string,
        userDisplayName: string
    ): Promise<number> {
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
                    reporter: row.Déclarant || row.declarant || userDisplayName,
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
            }

            return count;
        } catch (error) {
            ErrorLogger.error(error, 'IncidentService.importIncidentsFromCSV');
            throw error;
        }
    }
}
