import { useEffect, useRef, useCallback, useMemo } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Vulnerability } from '../types';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { ThreatFeedService } from '../services/ThreatFeedService';
import { logAction } from '../services/logger';
import { useFirestoreCollection } from './useFirestore';
import { hasPermission } from '../utils/permissions';

export const useVulnerabilities = () => {
    const { user, addToast, demoMode } = useStore();
    const initialLoadRef = useRef(false);

    // Use useFirestoreCollection for stable subscription
    const constraints = useMemo(() => {
        if (!user?.organizationId) return [];
        return [where('organizationId', '==', user.organizationId)];
    }, [user?.organizationId]);

    const { data: vulnerabilities, loading, error } = useFirestoreCollection<Vulnerability>(
        'vulnerabilities',
        constraints,
        {
            realtime: true,
            enabled: !!user?.organizationId
        }
    );

    useEffect(() => {
        if (error) {
            addToast('Erreur lors du chargement des vulnérabilités', 'error');
        }
    }, [error, addToast]);

    const seedCisaKev = useCallback(async () => {
        if (!user?.organizationId || demoMode) return;
        try {
            const kevVulns = await ThreatFeedService.fetchCisaKev();
            if (kevVulns.length > 0) {
                const batchPromises = kevVulns.slice(0, 20).map(v =>
                    addDoc(collection(db, 'vulnerabilities'), {
                        ...v,
                        organizationId: user.organizationId,
                        createdAt: serverTimestamp(),
                        severity: 'High', // Default for KEV
                        status: 'Open',
                        assetName: 'External Interest'
                    })
                );
                await Promise.all(batchPromises);
                logAction(user, 'AUTO_SEED', 'Vulnerabilities', `Seeded ${kevVulns.length} vulnerabilities from CISA KEV`);
                addToast("Flux CISA KEV synchronisé", "success");
            }
        } catch (error) {
            ErrorLogger.warn((error as Error).message, 'useVulnerabilities.seedCisaKev');
            // optional: toast
        }
    }, [user, addToast, demoMode]);

    // Auto-seed CISA KEV
    useEffect(() => {
        if (!loading && vulnerabilities.length === 0 && !initialLoadRef.current && user?.organizationId && !demoMode) {
            initialLoadRef.current = true;
            seedCisaKev();
        }
    }, [loading, vulnerabilities.length, user?.organizationId, seedCisaKev, demoMode]);

    const addVulnerability = async (vuln: Partial<Vulnerability>) => {
        if (!user?.organizationId) return;
        if (demoMode) {
            addToast("Action non disponible en mode démo", "info");
            return;
        }
        try {
            const dataToSave = sanitizeData({
                ...vuln,
                organizationId: user.organizationId,
                createdAt: serverTimestamp()
            });
            await addDoc(collection(db, 'vulnerabilities'), dataToSave);
            logAction(user, 'CREATE', 'Vulnerabilities', `Created Vulnerability ${vuln.cveId}`);
            addToast("Vulnérabilité créée", "success");
            return true;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useVulnerabilities.add');
            addToast("Erreur lors de la création", "error");
            throw error;
        }
    };

    const updateVulnerability = async (id: string, updates: Partial<Vulnerability>) => {
        if (demoMode) {
            addToast("Action non disponible en mode démo", "info");
            return;
        }

        // SECURITY: Check authorization
        if (!hasPermission(user, 'Vulnerability', 'update')) {
            ErrorLogger.warn('Unauthorized vulnerability update attempt', 'useVulnerabilities.update', {
                metadata: { attemptedBy: user?.uid, targetId: id }
            });
            addToast("Vous n'avez pas les droits pour modifier cette vulnérabilité", "error");
            return false;
        }

        // SECURITY: Verify vulnerability belongs to user's organization (IDOR protection)
        const targetVuln = vulnerabilities.find(v => v.id === id);
        if (!targetVuln || targetVuln.organizationId !== user?.organizationId) {
            ErrorLogger.warn('IDOR attempt: vulnerability modification across organizations', 'useVulnerabilities.update', {
                metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: targetVuln?.organizationId, callerOrg: user?.organizationId }
            });
            addToast("Vulnérabilité non trouvée", "error");
            return false;
        }

        try {
            const { id: _unused, ...safeUpdates } = updates;
            const dataToSave = sanitizeData({
                ...safeUpdates,
                updatedAt: serverTimestamp()
            });

            await updateDoc(doc(db, 'vulnerabilities', id), dataToSave);

            // Business Logic: If status changed to Resolved/Patch Applied, update ALL related Risks
            if (updates.status && (updates.status === 'Resolved' || updates.status === 'Patch Applied')) {
                const riskQuery = query(collection(db, 'risks'), where('relatedVulnerabilityId', '==', id));
                const riskSnap = await import('firebase/firestore').then(mod => mod.getDocs(riskQuery));

                if (!riskSnap.empty) {
                    // SECURITY FIX: Update ALL related risks, not just the first one
                    const updatePromises = riskSnap.docs.map(riskDoc =>
                        updateDoc(doc(db, 'risks', riskDoc.id), {
                            status: 'Traité',
                            updatedAt: serverTimestamp()
                        })
                    );
                    await Promise.all(updatePromises);
                    const count = riskSnap.docs.length;
                    addToast(`${count} risque${count > 1 ? 's' : ''} associé${count > 1 ? 's' : ''} marqué${count > 1 ? 's' : ''} comme Traité`, "success");
                }
            }

            logAction(user!, 'UPDATE', 'Vulnerabilities', `Updated Vulnerability ${updates.cveId}`);
            addToast("Vulnérabilité mise à jour", "success");
            return true;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useVulnerabilities.update');
            addToast("Erreur lors de la modification", "error");
            throw error;
        }
    };

    const deleteVulnerability = async (id: string) => {
        if (demoMode) {
            addToast("Action non disponible en mode démo", "info");
            return;
        }

        // SECURITY: Check authorization
        if (!hasPermission(user, 'Vulnerability', 'delete')) {
            ErrorLogger.warn('Unauthorized vulnerability deletion attempt', 'useVulnerabilities.delete', {
                metadata: { attemptedBy: user?.uid, targetId: id }
            });
            addToast("Vous n'avez pas les droits pour supprimer cette vulnérabilité", "error");
            return false;
        }

        // SECURITY: Verify vulnerability belongs to user's organization (IDOR protection)
        const targetVuln = vulnerabilities.find(v => v.id === id);
        if (!targetVuln || targetVuln.organizationId !== user?.organizationId) {
            ErrorLogger.warn('IDOR attempt: vulnerability deletion across organizations', 'useVulnerabilities.delete', {
                metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: targetVuln?.organizationId, callerOrg: user?.organizationId }
            });
            addToast("Vulnérabilité non trouvée", "error");
            return false;
        }

        try {
            await deleteDoc(doc(db, 'vulnerabilities', id));
            logAction(user!, 'DELETE', 'Vulnerabilities', `Deleted Vulnerability ID: ${id}`);
            addToast("Supprimé avec succès", "success");
            return true;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useVulnerabilities.delete');
            addToast("Erreur lors de la suppression", "error");
            throw error;
        }
    };

    const createRiskFromVuln = async (vuln: Vulnerability) => {
        if (!user?.organizationId || !vuln.id) return;
        if (demoMode) {
            addToast("Action non disponible en mode démo", "info");
            return;
        }
        try {
            const riskData = {
                organizationId: user.organizationId,
                assetId: vuln.assetId || '',
                threat: `Exploitation de ${vuln.cveId}`,
                vulnerability: vuln.description || vuln.title,
                probability: 3,
                impact: vuln.severity === 'Critical' ? 5 : vuln.severity === 'High' ? 4 : 3,
                score: (vuln.severity === 'Critical' ? 5 : 3) * 3,
                status: 'Ouvert',
                strategy: 'Atténuer',
                owner: user.email,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                framework: 'ISO27005',
                relatedVulnerabilityId: vuln.id
            };

            const riskRef = await addDoc(collection(db, 'risks'), riskData);

            // Bidirectional linking
            await updateDoc(doc(db, 'vulnerabilities', vuln.id), {
                relatedRiskId: riskRef.id,
                status: 'In Progress'
            });

            logAction(user, 'CREATE_RISK', 'Vulnerabilities', `Created Risk for Vuln ${vuln.cveId}`);
            addToast("Risque créé et lié avec succès", "success");
            return true;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useVulnerabilities.createRisk');
            addToast("Erreur création risque", "error");
            throw error;
        }
    };

    const importVulnerabilities = async (vulns: Partial<Vulnerability>[]) => {
        if (!user?.organizationId) return;
        if (demoMode) {
            addToast("Action non disponible en mode démo", "info");
            return;
        }
        try {
            const batchPromises = vulns.map(v =>
                addDoc(collection(db, 'vulnerabilities'), {
                    ...sanitizeData(v),
                    organizationId: user.organizationId,
                    createdAt: serverTimestamp(),
                    status: 'Open'
                })
            );
            await Promise.all(batchPromises);
            logAction(user, 'IMPORT', 'Vulnerabilities', `Imported ${vulns.length} vulnerabilities from scanner`);
            addToast(`${vulns.length} vulnérabilités importées`, "success");
            return true;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useVulnerabilities.import');
            addToast("Erreur lors de l'import", "error");
            throw error;
        }
    };

    return {
        vulnerabilities,
        loading,
        addVulnerability,
        updateVulnerability,
        deleteVulnerability,
        createRiskFromVuln,
        importVulnerabilities
    };
};
