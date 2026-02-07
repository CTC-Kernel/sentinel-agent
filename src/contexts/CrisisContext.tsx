import React, { createContext, useContext, useEffect, useState } from 'react';
import { useStore } from '../store';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from '../services/errorLogger';
import { hasPermission } from '../utils/permissions';

type CrisisScenario = 'cyber' | 'fire' | 'supply' | 'staff';

interface CrisisState {
 isCrisisActive: boolean;
 scenario: CrisisScenario;
 activationStep: number;
 startedAt: Date | null;
 activatedBy?: string;
}

interface CrisisContextType extends CrisisState {
 activateCrisis: (scenario: CrisisScenario) => Promise<void>;
 deactivateCrisis: () => Promise<void>;
 setActivationStep: (step: number) => void;
 loading: boolean;
}

const CrisisContext = createContext<CrisisContextType | undefined>(undefined);

export const CrisisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const { user } = useStore();
 const [state, setState] = useState<CrisisState>({
 isCrisisActive: false,
 scenario: 'cyber',
 activationStep: 0,
 startedAt: null
 });
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (!user?.organizationId) {
 const timer = setTimeout(() => setLoading(false), 0);
 return () => clearTimeout(timer);
 }

 const crisisDocRef = doc(db, 'organizations', user.organizationId, 'modules', 'crisis');

 const unsubscribe = onSnapshot(crisisDocRef, (docSnap) => {
 if (docSnap.exists()) {
 const data = docSnap.data();
 setState({
  isCrisisActive: data.isActive || false,
  scenario: data.scenario || 'cyber',
  activationStep: data.isActive ? 2 : 0, // Force step 2 if active remotely
  startedAt: data.startedAt?.toDate() || null,
  activatedBy: data.activatedBy
 });
 } else {
 setState(prev => ({ ...prev, isCrisisActive: false }));
 }
 setLoading(false);
 }, (_error) => {
 // Permission denied usually means no crisis doc or read failure
 setLoading(false);
 });

 return () => unsubscribe();
 }, [user?.organizationId]);

 const activateCrisis = async (scenario: CrisisScenario) => {
 if (!user?.organizationId) return;
 // RBAC: Only users with Incident manage permission can activate crisis
 if (!hasPermission(user, 'Incident', 'manage')) {
 ErrorLogger.warn('Unauthorized crisis activation attempt', 'CrisisContext.activate', {
 metadata: { userId: user.uid, role: user.role }
 });
 throw new Error('Permission refusee : activation de crise non autorisee');
 }
 try {
 await setDoc(doc(db, 'organizations', user.organizationId, 'modules', 'crisis'), {
 isActive: true,
 scenario,
 startedAt: serverTimestamp(),
 activatedBy: user.uid,
 updatedAt: serverTimestamp()
 }, { merge: true }); // SAFE: all fields are explicitly defined, no undefined values possible
 // State update will happen via onSnapshot
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'CrisisContext.activate');
 throw error;
 }
 };

 const deactivateCrisis = async () => {
 if (!user?.organizationId) return;
 // RBAC: Only users with Incident manage permission can deactivate crisis
 if (!hasPermission(user, 'Incident', 'manage')) {
 ErrorLogger.warn('Unauthorized crisis deactivation attempt', 'CrisisContext.deactivate', {
 metadata: { userId: user.uid, role: user.role }
 });
 throw new Error('Permission refusee : desactivation de crise non autorisee');
 }
 try {
 await setDoc(doc(db, 'organizations', user.organizationId, 'modules', 'crisis'), {
 isActive: false,
 endedAt: serverTimestamp(),
 deactivatedBy: user.uid,
 updatedAt: serverTimestamp()
 }, { merge: true }); // SAFE: merge keeps history, all fields explicit - sanitizeData() strips undefined
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'CrisisContext.deactivate');
 throw error;
 }
 };

 const setActivationStep = (step: number) => {
 setState(prev => ({ ...prev, activationStep: step }));
 };

 return (
 <CrisisContext.Provider value={{
 ...state,
 activateCrisis,
 deactivateCrisis,
 setActivationStep,
 loading
 }}>
 {children}
 </CrisisContext.Provider>
 );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCrisis = () => {
 const context = useContext(CrisisContext);
 if (!context) {
 throw new Error('useCrisis must be used within a CrisisProvider');
 }
 return context;
};
