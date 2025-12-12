import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { useFirestoreCollection } from './useFirestore';
import { Control, Document, Risk, Finding, UserProfile, Asset, Supplier, Project, Audit, BusinessProcess, Framework } from '../types';
import { where, writeBatch, doc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import {
    ISO_SEED_CONTROLS, ISO22301_SEED_CONTROLS, NIS2_SEED_CONTROLS, DORA_SEED_CONTROLS,
    GDPR_SEED_CONTROLS, SOC2_SEED_CONTROLS, HDS_SEED_CONTROLS, PCI_DSS_SEED_CONTROLS, NIST_CSF_SEED_CONTROLS
} from '../data/complianceData';

export const useComplianceData = (currentFramework: Framework) => {
    const { user } = useStore();
    const orgId = user?.organizationId;

    const orgConstraints = useMemo(() => {
        return orgId ? [where('organizationId', '==', orgId)] : [];
    }, [orgId]);

    const { data: rawControls, loading: controlsLoading, refresh: refreshControls } = useFirestoreCollection<Control>(
        'controls',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: documents, loading: docsLoading } = useFirestoreCollection<Document>(
        'documents',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: risks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: findings, loading: findingsLoading } = useFirestoreCollection<Finding>(
        'findings',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: assets, loading: assetsLoading } = useFirestoreCollection<Asset>(
        'assets',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: suppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>(
        'suppliers',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: projects, loading: projectsLoading } = useFirestoreCollection<Project>(
        'projects',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: audits, loading: auditsLoading } = useFirestoreCollection<Audit>(
        'audits',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const { data: processes, loading: processesLoading } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        orgConstraints,
        { logError: true, enabled: !!orgId, realtime: true }
    );

    const loading = controlsLoading || docsLoading || risksLoading || findingsLoading || usersLoading || assetsLoading || suppliersLoading || projectsLoading || auditsLoading || processesLoading;

    // Derived State and Seeding Logic
    const [controls, setControls] = useState<Control[]>([]);

    useEffect(() => {
        if (controlsLoading || !user?.organizationId) return;

        const seedData = async () => {
            const currentControls = rawControls.filter(c =>
                (c.framework === currentFramework) ||
                (!c.framework && currentFramework === 'ISO27001')
            );

            let seedControls: { code: string; name: string }[] = [];
            switch (currentFramework) {
                case 'ISO27001': seedControls = ISO_SEED_CONTROLS; break;
                case 'ISO22301': seedControls = ISO22301_SEED_CONTROLS; break;
                case 'NIS2': seedControls = NIS2_SEED_CONTROLS; break;
                case 'DORA': seedControls = DORA_SEED_CONTROLS; break;
                case 'GDPR': seedControls = GDPR_SEED_CONTROLS; break;
                case 'SOC2': seedControls = SOC2_SEED_CONTROLS; break;
                case 'HDS': seedControls = HDS_SEED_CONTROLS; break;
                case 'PCI_DSS': seedControls = PCI_DSS_SEED_CONTROLS; break;
                case 'NIST_CSF': seedControls = NIST_CSF_SEED_CONTROLS; break;
            }

            if (currentControls.length < seedControls.length && seedControls.length > 0) {
                const existingCodes = currentControls.map(d => d.code);
                const batch = writeBatch(db);
                let addedCount = 0;

                seedControls.forEach(c => {
                    if (!existingCodes.includes(c.code)) {
                        const docRef = doc(collection(db, 'controls'));
                        batch.set(docRef, {
                            organizationId: user.organizationId,
                            code: c.code,
                            name: c.name,
                            framework: currentFramework,
                            applicability: 'Applicable',
                            status: 'Non commencé',
                            lastUpdated: new Date().toISOString(),
                            evidenceIds: []
                        });
                        addedCount++;
                    }
                });

                if (addedCount > 0) {
                    await batch.commit();
                    refreshControls();
                    return;
                }
            }

            setControls(sortControls(currentControls));
        };

        seedData();
    }, [rawControls, currentFramework, user?.organizationId, controlsLoading, refreshControls]);

    const sortControls = (data: Control[]) => {
        return [...data].sort((a, b) => {
            const partsA = a.code.split('.').map(Number);
            const partsB = b.code.split('.').map(Number);
            if (partsA[1] !== partsB[1]) return (partsA[1] || 0) - (partsB[1] || 0);
            return (partsA[2] || 0) - (partsB[2] || 0);
        });
    }

    return {
        loading,
        controls, // The filtered and sorted controls for the current framework
        rawControls, // All controls if needed
        documents,
        risks,
        findings,
        usersList,
        assets,
        suppliers,
        projects,
        audits,
        processes,
        refreshControls
    };
};
