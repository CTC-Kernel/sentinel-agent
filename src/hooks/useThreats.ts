import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ThreatTemplate } from '../types';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { RISK_TEMPLATES } from '../data/riskTemplates';

export const useThreats = () => {
    const { user, addToast } = useStore();
    const [threats, setThreats] = useState<ThreatTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.organizationId) return;

        setLoading(true);
        const q = query(collection(db, 'threat_library'), where('organizationId', '==', user.organizationId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ThreatTemplate));
            setThreats(items);
            setLoading(false);
        }, (err) => {
            ErrorLogger.error(err as Error, 'useThreats.subscribe');
            addToast('Erreur lors du chargement des menaces', 'error');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.organizationId, addToast]);

    const addThreat = async (threat: Partial<ThreatTemplate>) => {
        if (!user?.organizationId) return;
        try {
            const dataToSave = sanitizeData({
                ...threat,
                organizationId: user.organizationId,
                source: threat.source || 'Custom',
                createdAt: new Date().toISOString()
            });
            await addDoc(collection(db, 'threat_library'), dataToSave);
            addToast("Menace créée", "success");
            return true;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useThreats.addThreat');
            addToast("Erreur lors de la création", "error");
            throw error;
        }
    };

    const updateThreat = async (id: string, updates: Partial<ThreatTemplate>) => {
        try {
            // Ensure ID is not in the update payload
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _unused, ...safeUpdates } = updates;
            await updateDoc(doc(db, 'threat_library', id), safeUpdates);
            addToast("Menace modifiée", "success");
            return true;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useThreats.updateThreat');
            addToast("Erreur lors de la modification", "error");
            throw error;
        }
    };

    const deleteThreat = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'threat_library', id));
            addToast("Menace supprimée", "success");
            return true;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useThreats.deleteThreat');
            addToast("Erreur lors de la suppression", "error");
            throw error;
        }
    };

    const seedStandardThreats = async () => {
        if (!user?.organizationId) return;
        try {
            const batch = writeBatch(db); // Note: RISK_TEMPLATES is small (<100), no chunk needed
            let count = 0;

            RISK_TEMPLATES.forEach(template => {
                const docRef = doc(collection(db, 'threat_library'));
                batch.set(docRef, sanitizeData({
                    ...template,
                    organizationId: user.organizationId,
                    source: 'Standard',
                    createdAt: new Date().toISOString()
                }));
                count++;
            });

            await batch.commit();
            addToast(`${count} menaces standard importées`, 'success');
            return count;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useThreats.seedStandardThreats');
            addToast("Erreur lors de l'import", "error");
            throw error;
        }
    };

    return {
        threats,
        loading,
        addThreat,
        updateThreat,
        deleteThreat,
        seedStandardThreats
    };
};
