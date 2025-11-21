
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

export const logAction = async (
  user: { uid: string; email: string } | null,
  action: string,
  resource: string,
  details?: string
) => {
  if (!user) return; // Ne pas logger si pas d'utilisateur (ou guest sans ID stable)

  try {
    await addDoc(collection(db, 'system_logs'), {
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
