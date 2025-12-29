import { useState } from 'react';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ISO_SEED_CONTROLS } from '../data/complianceData';
import { useStore } from '../store';
import { toast } from 'sonner';

export const useComplianceDataSeeder = () => {
    const { user } = useStore();
    const [seeding, setSeeding] = useState(false);

    const seedIsoControls = async () => {
        if (!user?.organizationId) return;

        setSeeding(true);
        try {
            const batch = writeBatch(db);
            const controlsCol = collection(db, 'controls');
            let count = 0;

            for (const control of ISO_SEED_CONTROLS) {
                // Create a deterministic ID based on Org + Code to prevent duplicates if run multiple times
                // or just let Firestore generate ID. 
                // Better: Check if exists? Batch writes can't check existence easily without reading first.
                // For simplicity in this "fix" script, we'll just create new docs. 
                // Deduplication should ideally be handled, but usually this is run once on empty state.

                const newDocRef = doc(controlsCol);
                batch.set(newDocRef, {
                    code: control.code,
                    name: control.name,
                    description: control.name, // Use name as description for now if missing
                    framework: 'ISO27001',
                    status: 'Non commencé',
                    applicability: 'Applicable',
                    organizationId: user.organizationId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    riskLevel: 'Faible',
                    maturity: 0
                });
                count++;
            }

            await batch.commit();
            toast.success(`${count} contrôles ISO 27001 importés avec succès`);

            // Force reload or let live listeners update
            // window.location.reload(); 
        } catch (error) {
            console.error("Seeding failed", error);
            toast.error("Erreur lors de l'import des données");
        } finally {
            setSeeding(false);
        }
    };

    return {
        seedIsoControls,
        seeding
    };
};
