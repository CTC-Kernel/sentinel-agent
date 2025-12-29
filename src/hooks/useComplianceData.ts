import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useComplianceActions } from './useComplianceActions';
import { Control, Risk, Finding, Framework, Document, UserProfile, Asset, Supplier, Project } from '../types';

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export const useComplianceData = (currentFramework?: Framework) => {
    const { user } = useStore();
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
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false);
            return;
        }

        setLoading(true);
        console.log('Fetching compliance data for Org:', user.organizationId);

        // 1. Controls Listener
        const controlsQuery = query(
            collection(db, 'controls'),
            where('organizationId', '==', user.organizationId)
        );

        const unsubControls = onSnapshot(controlsQuery, (snapshot) => {
            const fetchedControls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Control));
            console.log('Fetched Controls:', fetchedControls.length);
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
    }, [user?.organizationId]);

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
