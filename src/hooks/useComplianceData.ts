import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useComplianceActions } from './useComplianceActions';
import { Control, Risk, Finding, Framework, Document, UserProfile, Asset, Supplier, Project } from '../types';

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export const useComplianceData = (currentFramework?: Framework) => {
    const { user, demoMode } = useStore();
    const [controls, setControls] = useState<Control[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [findings, setFindings] = useState<Finding[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    const [loading, setLoading] = useState(true);

    const complianceActions = useComplianceActions(user);

    useEffect(() => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const isDemo = demoMode || window.localStorage.getItem('demoMode') === 'true';

        if (isDemo) {
            import('../services/mockDataService').then(module => {
                setControls(module.MockDataService.getCollection('controls') as unknown as Control[]);
                setRisks(module.MockDataService.getCollection('risks') as unknown as Risk[]);
                setDocuments(module.MockDataService.getCollection('documents') as unknown as Document[]);
                setUsersList(module.MockDataService.getCollection('users') as unknown as UserProfile[]);
                setAssets(module.MockDataService.getCollection('assets') as unknown as Asset[]);
                setSuppliers(module.MockDataService.getCollection('suppliers') as unknown as Supplier[]);
                setProjects(module.MockDataService.getCollection('projects') as unknown as Project[]);
                setFindings([]);
                setLoading(false);
            }).catch(err => {
                setLoading(false);
            });
            return;
        }

        // 1. Controls Listener
        const controlsQuery = query(
            collection(db, 'controls'),
            where('organizationId', '==', user.organizationId)
        );

        const unsubControls = onSnapshot(controlsQuery, (snapshot) => {
            const fetchedControls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Control));
            setControls(fetchedControls);
        });

        // 2. Risks Listener
        const risksQuery = query(collection(db, 'risks'), where('organizationId', '==', user.organizationId));
        const unsubRisks = onSnapshot(risksQuery, (snapshot) => {
            const fetchedRisks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Risk));
            setRisks(fetchedRisks);
        });

        // 3. Other Collections
        const docsQuery = query(collection(db, 'documents'), where('organizationId', '==', user.organizationId));
        const unsubDocs = onSnapshot(docsQuery, (s) => setDocuments(s.docs.map(d => ({ id: d.id, ...d.data() } as Document))));

        const usersQuery = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
        const unsubUsers = onSnapshot(usersQuery, (s) => setUsersList(s.docs.map(d => ({ id: d.id, ...d.data() } as unknown as UserProfile))));

        const assetsQuery = query(collection(db, 'assets'), where('organizationId', '==', user.organizationId));
        const unsubAssets = onSnapshot(assetsQuery, (s) => setAssets(s.docs.map(d => ({ id: d.id, ...d.data() } as Asset))));

        const suppQuery = query(collection(db, 'suppliers'), where('organizationId', '==', user.organizationId));
        const unsubSupp = onSnapshot(suppQuery, (s) => setSuppliers(s.docs.map(d => ({ id: d.id, ...d.data() } as Supplier))));

        const projQuery = query(collection(db, 'projects'), where('organizationId', '==', user.organizationId));
        const unsubProj = onSnapshot(projQuery, (s) => setProjects(s.docs.map(d => ({ id: d.id, ...d.data() } as Project))));

        // 4. Findings Listener (Simulated for now)
        setFindings([]);

        setLoading(false);

        return () => {
            unsubControls();
            unsubRisks();
            unsubDocs();
            unsubUsers();
            unsubAssets();
            unsubSupp();
            unsubProj();
        };
    }, [user?.organizationId, demoMode]);

    // Framework filtering
    const filteredControls = currentFramework
        ? controls.filter(c => c.framework === currentFramework)
        : controls;

    return {
        controls,
        filteredControls,
        risks,
        findings,
        loading,
        complianceActions,
        documents,
        usersList,
        assets,
        suppliers,
        projects
    };
};
