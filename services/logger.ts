
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

export const logAction = async (
  user: { uid: string; email: string; organizationId?: string } | null,
  action: string,
  resource: string,
  details?: string
) => {
  if (!user || !user.organizationId) return;

  try {
    await addDoc(collection(db, 'system_logs'), {
      organizationId: user.organizationId,
      userId: user.uid,
      userEmail: user.email,
      action,
      resource,
      details: details || '',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du log", error);
  }
};
