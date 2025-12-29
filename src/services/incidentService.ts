import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';

export interface DeleteIncidentOptions {
    incidentId: string;
    organizationId: string;
    userId: string;
    userEmail: string;
}

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
}
