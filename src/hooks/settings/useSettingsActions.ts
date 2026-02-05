import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../useAuth';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';

export const useSettingsActions = () => {
 const { user } = useAuth();

 const saveCommunitySettings = async (settings: Record<string, unknown>) => {
 if (!user) throw new Error('User not authenticated');

 try {
 const settingsRef = doc(db, 'users', user.uid, 'settings', 'community');
 await setDoc(settingsRef, sanitizeData({
 ...settings,
 updatedAt: serverTimestamp()
 }), { merge: true });
 } catch (error) {
 ErrorLogger.error(error, 'useSettingsActions.saveCommunitySettings');
 throw error;
 }
 };

 return {
 saveCommunitySettings,
 };
};
