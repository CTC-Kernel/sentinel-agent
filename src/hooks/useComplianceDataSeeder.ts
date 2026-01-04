import { useState } from 'react';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
    ISO_SEED_CONTROLS,
    NIS2_SEED_CONTROLS,
    DORA_SEED_CONTROLS,
    GDPR_SEED_CONTROLS,
    SOC2_SEED_CONTROLS,
    HDS_SEED_CONTROLS,
    PCI_DSS_SEED_CONTROLS,
    NIST_CSF_SEED_CONTROLS,
    ISO22301_SEED_CONTROLS
} from '../data/complianceData';
import { useStore } from '../store';
import { toast } from 'sonner';
import { Framework } from '../types';

export const useComplianceDataSeeder = () => {
    const { user } = useStore();
    const [seeding, setSeeding] = useState(false);

    const getSeedDataForFramework = (framework: Framework) => {
        switch (framework) {
            case 'ISO27001': return ISO_SEED_CONTROLS;
            case 'NIS2': return NIS2_SEED_CONTROLS;
            case 'DORA': return DORA_SEED_CONTROLS;
            case 'GDPR': return GDPR_SEED_CONTROLS;
            case 'SOC2': return SOC2_SEED_CONTROLS;
            case 'HDS': return HDS_SEED_CONTROLS;
            case 'PCI_DSS': return PCI_DSS_SEED_CONTROLS;
            case 'NIST_CSF': return NIST_CSF_SEED_CONTROLS;
            case 'ISO22301': return ISO22301_SEED_CONTROLS;
            default: return [];
        }
    };

    const seedControls = async (framework: Framework) => {
        if (!user?.organizationId) return;

        const seedData = getSeedDataForFramework(framework);
        if (seedData.length === 0) {
            toast.error(`Aucune donnée de démarrage disponible pour ${framework}`);
            return;
        }

        setSeeding(true);
        try {
            const batch = writeBatch(db);
            const controlsCol = collection(db, 'controls');
            let count = 0;

            for (const control of seedData) {
                const newDocRef = doc(controlsCol);
                batch.set(newDocRef, {
                    code: control.code,
                    name: control.name,
                    description: control.name, // Use name as description if missing
                    framework: framework,
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
            toast.success(`${count} contrôles ${framework} importés avec succès`);

        } catch {
            toast.error("Erreur lors de l'import des données");
        } finally {
            setSeeding(false);
        }
    };

    return {
        seedControls,
        seeding
    };
};
