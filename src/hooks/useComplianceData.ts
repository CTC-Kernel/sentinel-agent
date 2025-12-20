import { useState, useEffect } from 'react';
import { orderBy, where } from 'firebase/firestore';
import { useFirestoreCollection } from './useFirestore';
import { useStore } from '../store';
import { usePlanLimits } from './usePlanLimits';
import { ComplianceService } from '../services/ComplianceService';
import { Control, Document, Risk, Finding, UserProfile, Asset, Supplier, Project, Audit } from '../types';
import { Framework } from '../types/compliance'; // Ensure this matches your type definition

export const useComplianceData = (currentFramework: Framework) => {
    const { organization } = useStore();
    const limits = usePlanLimits();
    const [seeding, setSeeding] = useState(false);

    // Main Controls Collection
    const { data: rawControls, loading: controlsLoading, refresh: refreshControls } = useFirestoreCollection<Control>(
        'controls',
        [where('framework', '==', currentFramework), orderBy('code', 'asc')],
        { logError: true, realtime: true, enabled: !!organization }
    );

    // Related Collections
    const { data: documents, loading: docsLoading } = useFirestoreCollection<Document>('documents', [orderBy('createdAt', 'desc')], { realtime: true, enabled: !!organization });
    const { data: risks, loading: risksLoading } = useFirestoreCollection<Risk>('risks', [], { realtime: true, enabled: !!organization });
    const { data: findings, loading: findingsLoading } = useFirestoreCollection<Finding>('findings', [], { realtime: true, enabled: !!organization });
    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>('users', [], { realtime: true });
    const { data: assets, loading: assetsLoading } = useFirestoreCollection<Asset>('assets', [], { realtime: true, enabled: !!organization });
    const { data: suppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>('suppliers', [orderBy('name', 'asc')], { realtime: true, enabled: !!organization });
    const { data: projects, loading: projectsLoading } = useFirestoreCollection<Project>('projects', [orderBy('updatedAt', 'desc')], { realtime: true, enabled: !!organization });
    const { data: audits, loading: auditsLoading } = useFirestoreCollection<Audit>('audits', [orderBy('updatedAt', 'desc')], { realtime: true, enabled: !!organization });

    const loading = controlsLoading || docsLoading || risksLoading || findingsLoading || usersLoading || assetsLoading || suppliersLoading || seeding || projectsLoading || auditsLoading;

    // Auto-seed controls if missing
    useEffect(() => {
        const seedData = async () => {
            if (!organization || controlsLoading || rawControls.length > 0 || seeding) return;

            setSeeding(true);
            try {
                // Check if we already have controls for this framework (double check to avoid race conditions)
                // Actually the hook 'rawControls' is real-time, so if it says 0, it means 0.
                // But we might want to check if we SHOULD seed (e.g. if user has rights).
                // Usually seeding is done automatically for the organization.

                await ComplianceService.seedFrameworkControls(currentFramework, organization.id);
                refreshControls();
            } catch (error) {
                console.error("Failed to seed controls", error);
            } finally {
                setSeeding(false);
            }
        };

        seedData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentFramework, organization, rawControls.length, controlsLoading]);

    return {
        controls: rawControls,
        documents,
        risks,
        findings,
        usersList,
        assets,
        suppliers,
        projects,
        audits,
        loading,
        refreshControls
    };
};
