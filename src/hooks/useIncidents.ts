import { useState, useCallback } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { NotificationService } from '../services/notificationService';
import { hybridService } from '../services/hybridService';
import { logAction } from '../services/logger';
import { Incident, Criticality } from '../types';
import { IncidentFormData } from '../schemas/incidentSchema';
import { sanitizeData } from '../utils/dataSanitizer';
import { SecurityEvent } from '../services/integrationService';

export const useIncidents = () => {
    const { user, addToast, t } = useStore();
    const [loading, setLoading] = useState(false);

    const addIncident = useCallback(async (data: IncidentFormData) => {
        if (!user?.organizationId) return null;
        setLoading(true);
        try {
            const incidentData = sanitizeData({ ...data });
            const now = new Date().toISOString();

            if (incidentData.status === 'Analyse' && !incidentData.dateAnalysis) incidentData.dateAnalysis = now;
            if (incidentData.status === 'Contenu' && !incidentData.dateContained) incidentData.dateContained = now;
            if ((incidentData.status === 'Résolu' || incidentData.status === 'Fermé') && !incidentData.dateResolved) incidentData.dateResolved = now;

            const docRef = await addDoc(collection(db, 'incidents'), {
                ...incidentData,
                organizationId: user.organizationId,
                dateReported: new Date().toISOString()
            });

            await logAction(user, 'CREATE', 'Incident', `Nouvel Incident: ${incidentData.title} `);

            // Backend Audit Log (ISO 27001)
            await hybridService.logCriticalEvent({
                action: 'CREATE',
                resource: 'Incident',
                details: `Created incident: ${incidentData.title}`,
                metadata: { severity: incidentData.severity, category: incidentData.category }
            });

            await NotificationService.notifyNewIncident({
                id: docRef.id,
                ...incidentData,
                dateReported: new Date().toISOString(),
                organizationId: user.organizationId,
                reporter: user.displayName || 'Utilisateur'
            });

            addToast(t('incidents.toastDeclared'), "success");
            return docRef.id;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidents.addIncident', 'CREATE_FAILED');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const updateIncident = useCallback(async (id: string, data: IncidentFormData, currentIncident?: Incident) => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            const incidentData = sanitizeData({ ...data });
            const now = new Date().toISOString();

            if (incidentData.status === 'Analyse' && !incidentData.dateAnalysis) incidentData.dateAnalysis = now;
            if (incidentData.status === 'Contenu' && !incidentData.dateContained) incidentData.dateContained = now;
            if ((incidentData.status === 'Résolu' || incidentData.status === 'Fermé') && !incidentData.dateResolved) incidentData.dateResolved = now;

            await updateDoc(doc(db, 'incidents', id), incidentData);
            await logAction(user, 'UPDATE', 'Incident', `MAJ Incident: ${incidentData.title} `);

            // Backend Audit Log
            await hybridService.logCriticalEvent({
                action: 'UPDATE',
                resource: 'Incident',
                details: `Updated incident: ${incidentData.title}`,
                metadata: {
                    status: incidentData.status,
                    changes: Object.keys(incidentData).join(', ')
                }
            });

            addToast(t('incidents.toastUpdated'), "success");
            return { ...currentIncident, ...incidentData } as Incident;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidents.updateIncident', 'UPDATE_FAILED');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const deleteIncident = useCallback(async (id: string) => {
        if (!user?.organizationId || !user?.uid) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);

            // 1. Delete Incident
            const incidentRef = doc(db, 'incidents', id);
            batch.delete(incidentRef);

            // 2. Add Audit Log (Atomic) - Replicating System Log structure
            const logRef = doc(collection(db, 'system_logs'));
            const logData = {
                organizationId: user.organizationId,
                timestamp: new Date().toISOString(),
                action: 'DELETE',
                resource: 'Incident',
                userId: user.uid,
                userEmail: user.email || 'unknown',
                details: `Deleted incident ID: ${id}`,
                metadata: { incidentId: id },
                severity: 'critical', // Deletion is always critical
                source: 'Sentinel-Core'
            };
            batch.set(logRef, logData);

            // 3. Commit atomically
            await batch.commit();
            addToast(t('incidents.toastDeleted'), "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidents.deleteIncident', 'DELETE_FAILED');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const deleteIncidentsBulk = useCallback(async (ids: string[]) => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            // We reuse deleteIncident logic but strictly we should probably batch differently if many.
            // But reuse is safer for now to ensure Audit Log consistency.
            // However, deleteIncident uses batch internally for 1 item.
            // If we have many items, Promise.all with individual batches is fine for < 500 items.
            await Promise.all(ids.map(id => {
                // We convert the internal logic of deleteIncident to be callable or just call it.
                // Since deleteIncident sets loading state, calling it in parallel might cause state updates conflicts?
                // Actually setLoading useReducer or useState batching might be fine but ideally we don't spam state.
                // Let's implement specific batch logic here?
                // Or just call simple atomic deletions.

                // Let's create a Helper that doesn't set state, to reuse.
                const performDelete = async (id: string) => {
                    const batch = writeBatch(db);
                    const incidentRef = doc(db, 'incidents', id);
                    batch.delete(incidentRef);
                    const logRef = doc(collection(db, 'system_logs'));
                    batch.set(logRef, {
                        organizationId: user.organizationId,
                        timestamp: new Date().toISOString(),
                        action: 'DELETE',
                        resource: 'Incident',
                        userId: user.uid,
                        userEmail: user.email || 'unknown',
                        details: `Deleted incident ID: ${id}`,
                        metadata: { incidentId: id },
                        severity: 'critical',
                        source: 'Sentinel-Core'
                    });
                    return batch.commit();
                };
                return performDelete(id);
            }));

            addToast(t('incidents.toastBulkDeleted', { count: ids.length }), "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidents.deleteIncidentsBulk', 'DELETE_FAILED');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const importIncidentsFromEvents = useCallback(async (events: SecurityEvent[]) => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            const mapSeverity = (sev: string): Criticality => {
                switch (sev) {
                    case 'Low': return Criticality.LOW;
                    case 'Medium': return Criticality.MEDIUM;
                    case 'High': return Criticality.HIGH;
                    case 'Critical': return Criticality.CRITICAL;
                    default: return Criticality.MEDIUM;
                }
            };

            const batch = events.map(event => sanitizeData({
                organizationId: user.organizationId,
                title: event.title,
                description: event.description + `\n\n**Source**: ${event.source}\n**Raw Data**: ${JSON.stringify(event.rawData)}`,
                severity: mapSeverity(event.severity),
                dateReported: new Date().toISOString(),
                status: 'Analyse',
                type: 'SecurityAlert',
                reporter: 'Connecteur ' + event.source,
                category: 'Intrusion', // Default
                financialImpact: 0,
                history: []
            }));

            await Promise.all(batch.map(data => addDoc(collection(db, 'incidents'), data)));
            await logAction(user, 'IMPORT', 'Incident', `Import de ${events.length} incidents depuis ${events[0]?.source}`);

            addToast(t('incidents.toastImport', { count: events.length }), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidents.importIncidentsFromEvents');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const simulateAttack = useCallback(async () => {
        if (!user?.organizationId) return null;
        setLoading(true);
        try {
            const attackData: Omit<Incident, 'id'> = {
                organizationId: user.organizationId,
                title: "Détection Ransomware : LockBit 3.0",
                description: "<p><strong>Alerte Critique :</strong> L'agent EDR a détecté une activité de chiffrement massive sur le serveur de fichiers principal. Signature compatible avec <em>LockBit 3.0</em>.</p><ul><li><strong>Vecteur :</strong> Phishing suspecté (Email RH)</li><li><strong>Cibles :</strong> 245 fichiers chiffrés en 30 secondes</li><li><strong>Action EDR :</strong> Processus isolé, mais persistance détectée.</li></ul>",
                severity: Criticality.CRITICAL,
                status: 'Contenu',
                category: 'Ransomware',
                reporter: 'Sentinel AI (Automated)',
                dateReported: new Date().toISOString(),
                dateAnalysis: new Date().toISOString(),
                dateContained: new Date().toISOString(),
                financialImpact: 0,
                history: [
                    { date: new Date().toISOString(), user: 'Sentinel AI', action: 'DETECTION', details: 'Signature match: LockBit 3.0 behavior detected.' },
                    { date: new Date(Date.now() + 5000).toISOString(), user: 'Sentinel AI', action: 'CONTAINMENT', details: 'Automated response: Host isolation triggers.' }
                ],
                tags: ['Ransomware', 'Urgent', 'Automated'],
                playbookId: 'playbook-ransomware-standard'
            };

            const docRef = await addDoc(collection(db, 'incidents'), attackData);

            await hybridService.logCriticalEvent({
                action: 'SIMULATION',
                resource: 'Incident',
                details: `Simulated Attack generated: ${docRef.id}`,
                metadata: { type: 'Ransomware' }
            });

            await NotificationService.notifyNewIncident({
                id: docRef.id,
                ...attackData,
                reporter: 'SIMULATION'
            });

            addToast(t('incidents.toastSim'), "info");
            return { id: docRef.id, ...attackData } as Incident;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidents.simulateAttack');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    return {
        addIncident,
        updateIncident,
        deleteIncident,
        deleteIncidentsBulk,
        importIncidentsFromEvents,
        simulateAttack,
        loading
    };
};
