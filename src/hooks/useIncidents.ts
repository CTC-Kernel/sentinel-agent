import { useState, useCallback } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { NotificationService } from '../services/notificationService';
import { hybridService } from '../services/hybridService';
import { logAction } from '../services/logger';
import { IncidentService } from '../services/incidentService';
import { Incident, Criticality } from '../types';
import { IncidentStatus, isValidIncidentTransition } from '../types/incidents';
import { IncidentFormData, incidentSchema } from '../schemas/incidentSchema';
import { sanitizeData } from '../utils/dataSanitizer';
import { SecurityEvent } from '../services/integrationService';
import { ImportService } from '../services/ImportService';
import { ATTACK_SCENARIOS } from '../constants/scenarios';

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
                dateReported: serverTimestamp()
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

    const updateIncident = useCallback(async (id: string, data: Partial<IncidentFormData>, currentIncident?: Incident) => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            // Validation (Partial)
            const validationResult = incidentSchema.partial().safeParse(data);
            if (!validationResult.success) {
                const errorMessage = validationResult.error.issues[0]?.message || t('common.invalidData');
                addToast(errorMessage, "error");
                return;
            }

            // Validate status transition if status is being changed
            if (data.status && currentIncident?.status && data.status !== currentIncident.status) {
                const isValid = isValidIncidentTransition(
                    currentIncident.status as IncidentStatus,
                    data.status as IncidentStatus
                );
                if (!isValid) {
                    addToast(
                        `Transition de statut invalide: ${currentIncident.status} → ${data.status}`,
                        "error"
                    );
                    setLoading(false);
                    return;
                }
            }

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
            // Use IncidentService for atomic deletion with audit logging
            await IncidentService.deleteIncidentWithLog({
                incidentId: id,
                organizationId: user.organizationId,
                userId: user.uid,
                userEmail: user.email || 'unknown'
            });
            addToast(t('incidents.toastDeleted'), "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidents.deleteIncident', 'DELETE_FAILED');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const deleteIncidentsBulk = useCallback(async (ids: string[]) => {
        if (!user?.organizationId || !user?.uid) return;
        setLoading(true);
        try {
            // Use IncidentService for atomic bulk deletion with audit logging
            await IncidentService.bulkDeleteIncidents(
                ids,
                user.organizationId,
                user.uid,
                user.email || 'unknown'
            );

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
                dateReported: serverTimestamp(),
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
            const scenario = ATTACK_SCENARIOS[Math.floor(Math.random() * ATTACK_SCENARIOS.length)];

            const attackData: Omit<Incident, 'id'> = {
                organizationId: user.organizationId,
                title: scenario.title,
                description: `${scenario.description}<ul><li><strong>Vecteur :</strong> ${scenario.details.vector}</li><li><strong>Cibles :</strong> ${scenario.details.targets}</li><li><strong>Action EDR :</strong> ${scenario.details.action}</li></ul>`,
                severity: scenario.severity,
                status: 'Contenu',
                category: scenario.category,
                reporter: 'Sentinel AI (Automated)',
                dateReported: serverTimestamp() as unknown as string,
                dateAnalysis: serverTimestamp() as unknown as string,
                dateContained: serverTimestamp() as unknown as string,
                financialImpact: 0,
                history: [
                    { date: new Date().toISOString(), user: 'Sentinel AI', action: 'DETECTION', details: `Signature match: ${scenario.category} behavior detected.` },
                    { date: new Date(Date.now() + 5000).toISOString(), user: 'Sentinel AI', action: 'CONTAINMENT', details: 'Automated response: Host isolation triggers.' }
                ],
                tags: scenario.tags,
                playbookId: 'playbook-standard'
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

    const importIncidents = useCallback(async (csvContent: string) => {
        if (!user?.organizationId || !user?.uid) return;
        setLoading(true);
        try {
            const lines = ImportService.parseCSV(csvContent);
            if (lines.length === 0) {
                addToast("Fichier vide ou invalide", "error");
                return;
            }

            const count = await IncidentService.importIncidentsFromCSV(
                lines,
                user.organizationId,
                user.uid,
                user.displayName || 'Utilisateur'
            );

            await logAction(user, 'IMPORT', 'Incident', `Import CSV de ${count} incidents`);
            addToast(t('incidents.toastImport', { count }), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidents.importIncidents');
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
        importIncidents,
        simulateAttack,
        loading
    };
};
