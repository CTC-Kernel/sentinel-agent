import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
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
            const batch = writeBatch(db);

            // 1. Delete Incident
            const incidentRef = doc(db, 'incidents', incidentId);
            batch.delete(incidentRef);

            // 2. Add Audit Log (Atomic) - Replicating System Log structure
            const logRef = doc(collection(db, 'system_logs'));
            const logData = {
                organizationId,
                timestamp: new Date().toISOString(),
                action: 'DELETE',
                resource: 'Incident',
                userId,
                userEmail,
                details: `Deleted incident ID: ${incidentId}`,
                metadata: { incidentId },
                severity: 'critical', // Deletion is always critical
                source: 'Sentinel-Core'
            };
            batch.set(logRef, logData);

            // 3. Commit atomically
            await batch.commit();
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
