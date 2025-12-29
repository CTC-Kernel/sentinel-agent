import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Vulnerability } from '../types';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { ThreatFeedService } from '../services/ThreatFeedService';
import { logAction } from '../services/logger';

export const useVulnerabilities = () => {
    const { user, addToast } = useStore();
    const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
    const [loading, setLoading] = useState(true);
    const initialLoadRef = useRef(false);

    useEffect(() => {
        if (!user?.organizationId) return;

        // setLoading(true); // Can cause cascade render logic error in current React version

        const q = query(collection(db, 'vulnerabilities'), where('organizationId', '==', user.organizationId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vulnerability));
            setVulnerabilities(items);
            setLoading(false);
        }, (err) => {
            ErrorLogger.error(err as Error, 'useVulnerabilities.subscribe');
            addToast('Erreur lors du chargement des vulnérabilités', 'error');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.organizationId, addToast]);

    const seedCisaKev = useCallback(async () => {
        if (!user?.organizationId) return;
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
    }, [user, addToast]);

    // Auto-seed CISA KEV
    useEffect(() => {
        if (!loading && vulnerabilities.length === 0 && !initialLoadRef.current && user?.organizationId) {
            initialLoadRef.current = true;
            seedCisaKev();
        }
    }, [loading, vulnerabilities.length, user?.organizationId, seedCisaKev]);


    const addVulnerability = async (vuln: Partial<Vulnerability>) => {
        if (!user?.organizationId) return;
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
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _unused, ...safeUpdates } = updates;
            const dataToSave = sanitizeData({
                ...safeUpdates,
                updatedAt: serverTimestamp()
            });

            await updateDoc(doc(db, 'vulnerabilities', id), dataToSave);
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
