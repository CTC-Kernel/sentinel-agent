import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../useAuth';
import { ErrorLogger } from '../../services/errorLogger';

export const useSettingsActions = () => {
  const { user } = useAuth();

  const saveCommunitySettings = async (settings: any) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'community');
      await setDoc(settingsRef, {
        ...settings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      ErrorLogger.error(error, 'useSettingsActions.saveCommunitySettings');
      throw error;
    }
  };

  return {
    saveCommunitySettings,
  };
};
