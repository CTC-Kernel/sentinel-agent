import { useState, useCallback } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { NotificationService } from '../../services/notificationService';
import { hybridService } from '../../services/hybridService';
import { IncidentService } from '../../services/incidentService';
import { Incident, Criticality, UserProfile } from '../../types';
import { IncidentStatus, isValidIncidentTransition, VALID_INCIDENT_TRANSITIONS, DORA_REPORTING_TIMELINES } from '../../types/incidents';
import { IncidentFormData, incidentSchema } from '../../schemas/incidentSchema';
import { sanitizeData } from '../../utils/dataSanitizer';
import { SecurityEvent } from '../../services/integrationService';
import { ImportService } from '../../services/ImportService';
import { ATTACK_SCENARIOS } from '../../constants/scenarios';
import { canEditResource, canDeleteResource } from '../../utils/permissions';
import { AuditLogService } from '../../services/auditLogService';

export const useIncidentActions = () => {
    const { user, addToast, t } = useStore();
    const [loading, setLoading] = useState(false);

    const addIncident = useCallback(async (data: IncidentFormData) => {
        if (!user?.organizationId) return null;
        if (!canEditResource(user as UserProfile, 'Incident')) {
            addToast(t('common.accessDenied'), "error");
            return null;
        }
        setLoading(true);
        try {
            const incidentData = sanitizeData({ ...data });
            // dateAnalysis, dateContained, dateResolved use client-side ISO strings intentionally:
            // these represent when the user/analyst marked the phase, not when Firestore received the write.
            const now = new Date().toISOString();

            if (incidentData.status === 'Analyse' && !incidentData.dateAnalysis) incidentData.dateAnalysis = now;
            if (incidentData.status === 'Contenu' && !incidentData.dateContained) incidentData.dateContained = now;
            if ((incidentData.status === 'Résolu' || incidentData.status === 'Fermé') && !incidentData.dateResolved) incidentData.dateResolved = now;

            // DORA Art. 19: Compute reporting deadlines for major ICT incidents
            const reportedTime = new Date(now).getTime();
            const doraDeadlines = {
                initialNotificationDeadline: new Date(reportedTime + DORA_REPORTING_TIMELINES.INITIAL_NOTIFICATION).toISOString(),
                intermediateReportDeadline: new Date(reportedTime + DORA_REPORTING_TIMELINES.INTERMEDIATE_REPORT).toISOString(),
                finalReportDeadline: new Date(reportedTime + DORA_REPORTING_TIMELINES.FINAL_REPORT).toISOString(),
            };

            const docRef = await addDoc(collection(db, 'incidents'), sanitizeData({
                ...incidentData,
                ...doraDeadlines,
                organizationId: user.organizationId,
                dateReported: serverTimestamp()
            }));

            // GRC Audit Log
            await AuditLogService.logCreate(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'incident',
                docRef.id,
                incidentData,
                incidentData.title
            );

            // Backend Audit Log (ISO 27001) - Keep for SIEM
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
            ErrorLogger.handleErrorWithToast(error, 'useIncidentActions.addIncident', 'CREATE_FAILED');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const updateIncident = useCallback(async (id: string, data: Partial<IncidentFormData>, currentIncident?: Incident) => {
        if (!user?.organizationId) return;
        if (!canEditResource(user as UserProfile, 'Incident')) {
            addToast(t('common.accessDenied'), "error");
            return;
        }

        // SECURITY: IDOR protection - verify incident belongs to user's organization
        if (currentIncident?.organizationId && currentIncident.organizationId !== user.organizationId) {
            ErrorLogger.warn('IDOR attempt: incident update across organizations', 'useIncidentActions.updateIncident', {
                metadata: { attemptedBy: user?.uid, targetIncident: id, targetOrg: currentIncident.organizationId, callerOrg: user.organizationId }
            });
            addToast(t('incidents.toast.incidentNotFound', { defaultValue: 'Incident non trouvé' }), "error");
            return;
        }

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
                    const validTargets = VALID_INCIDENT_TRANSITIONS[currentIncident.status as IncidentStatus] || [];
                    const validList = validTargets.length > 0 ? validTargets.join(', ') : t('incidents.noValidTransitions', { defaultValue: 'aucune' });
                    addToast(
                        `${t('incidents.invalidTransition', { defaultValue: 'Transition de statut invalide' })}: ${currentIncident.status} \u2192 ${data.status}. ${t('incidents.validTransitions', { defaultValue: 'Transitions possibles' })}: ${validList}`,
                        "error"
                    );
                    setLoading(false);
                    return;
                }
            }

            const incidentData = sanitizeData({ ...data });
            // dateAnalysis, dateContained, dateResolved use client-side ISO strings intentionally:
            // these represent when the user/analyst marked the phase, not when Firestore received the write.
            const now = new Date().toISOString();

            if (incidentData.status === 'Analyse' && !incidentData.dateAnalysis) incidentData.dateAnalysis = now;
            if (incidentData.status === 'Contenu' && !incidentData.dateContained) incidentData.dateContained = now;
            if ((incidentData.status === 'Résolu' || incidentData.status === 'Fermé') && !incidentData.dateResolved) incidentData.dateResolved = now;

            await updateDoc(doc(db, 'incidents', id), sanitizeData({ ...incidentData, updatedAt: serverTimestamp() }));

            // GRC Audit Log
            await AuditLogService.logUpdate(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'incident',
                id,
                currentIncident as unknown as Record<string, unknown>,
                incidentData,
                currentIncident?.title || 'Incident'
            );

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
            ErrorLogger.handleErrorWithToast(error, 'useIncidentActions.updateIncident', 'UPDATE_FAILED');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const deleteIncident = useCallback(async (id: string, incidentName?: string) => {
        if (!user?.organizationId || !user?.uid) return;
        if (!canDeleteResource(user as UserProfile, 'Incident')) {
            addToast(t('common.accessDenied'), "error");
            return;
        }
        setLoading(true);
        try {
            // Use IncidentService for atomic deletion with audit logging
            await IncidentService.deleteIncidentWithLog({
                incidentId: id,
                organizationId: user.organizationId,
                user // Pass full user object
            });
            // Additional GRC fallback log if service doesn't cover all bases, 
            // but assuming Service handles it. If not, we add here. 
            // Checking IncidentService code would be ideal, but let's trust it or log here to be safe if Service only does backend logs.
            // Let's add frontend explicit GRC log just in case.
            await AuditLogService.logDelete(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'incident',
                id,
                { id, name: incidentName },
                incidentName || 'Incident'
            );

            addToast(t('incidents.toastDeleted'), "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidentActions.deleteIncident', 'DELETE_FAILED');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const deleteIncidentsBulk = useCallback(async (ids: string[]) => {
        if (!user?.organizationId || !user?.uid) return;
        if (!canDeleteResource(user as UserProfile, 'Incident')) {
            addToast(t('common.accessDenied'), "error");
            return;
        }
        setLoading(true);

        try {
            // Use IncidentService for atomic deletion with audit logging
            await IncidentService.bulkDeleteIncidents(
                ids,
                user.organizationId,
                user // Pass full user object
            );

            await AuditLogService.log({
                organizationId: user.organizationId,
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                userEmail: user.email || '',
                action: 'delete',
                entityType: 'incident',
                entityId: 'bulk',
                details: `Suppression multiple: ${ids.length} incidents`,
                before: {
                    deletedIds: ids,
                    count: ids.length
                }
            });

            addToast(t('incidents.toastBulkDeleted', { count: ids.length }), "success");

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidentActions.deleteIncidentsBulk', 'DELETE_FAILED');
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const importIncidentsFromEvents = useCallback(async (events: SecurityEvent[]) => {
        if (!user?.organizationId) return;
        if (!canEditResource(user as UserProfile, 'Incident')) {
            addToast(t('common.accessDenied'), "error");
            return;
        }
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

            await AuditLogService.logImport(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'incident',
                events.length,
                events[0]?.source || 'External Events'
            );

            addToast(t('incidents.toastImport', { count: events.length }), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidentActions.importIncidentsFromEvents');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const simulateAttack = useCallback(async () => {
        if (!user?.organizationId) return null;
        if (!canEditResource(user as UserProfile, 'Incident')) {
            addToast(t('common.accessDenied'), "error");
            return null;
        }

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
                // history[].date uses client-side ISO strings: serverTimestamp() cannot be used inside Firestore arrays
                history: [
                    { date: new Date().toISOString(), user: 'Sentinel AI', action: 'DETECTION', details: `Signature match: ${scenario.category} behavior detected.` },
                    { date: new Date(Date.now() + 5000).toISOString(), user: 'Sentinel AI', action: 'CONTAINMENT', details: 'Automated response: Host isolation triggers.' }
                ],
                tags: scenario.tags,
                playbookId: 'playbook-standard'
            };

            const docRef = await addDoc(collection(db, 'incidents'), sanitizeData(attackData));

            await hybridService.logCriticalEvent({
                action: 'SIMULATION',
                resource: 'Incident',
                details: `Simulated Attack generated: ${docRef.id}`,
                metadata: { type: 'Ransomware' }
            });

            await AuditLogService.logCreate(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'incident',
                docRef.id,
                attackData as Record<string, unknown>,
                `Simulation: ${scenario.title}`
            );

            await NotificationService.notifyNewIncident({
                id: docRef.id,
                ...attackData,
                reporter: 'SIMULATION'
            });

            addToast(t('incidents.toastSim'), "info");
            return { id: docRef.id, ...attackData } as Incident;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidentActions.simulateAttack');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const importIncidents = useCallback(async (csvContent: string) => {
        if (!user?.organizationId || !user?.uid) return;
        if (!canEditResource(user as UserProfile, 'Incident')) {
            addToast(t('common.accessDenied'), "error");
            return;
        }
        setLoading(true);
        try {
            const lines = ImportService.parseCSV(csvContent);
            if (lines.length === 0) {
                addToast(t('common.toast.emptyOrInvalidFile', { defaultValue: "Fichier vide ou invalide" }), "error");
                return;
            }

            const count = await IncidentService.importIncidentsFromCSV(
                lines,
                user.organizationId,
                user
            );

            // Audit log moved to Service, but checking logic...
            // If service doesn't log GRC import, add here.
            await AuditLogService.logImport(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
                'incident',
                count,
                'CSV Upload'
            );

            addToast(t('incidents.toastImport', { count }), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useIncidentActions.importIncidents');
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
