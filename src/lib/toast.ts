import { NotificationContextType, NotificationType } from '../contexts/NotificationContext';

let notificationContext: NotificationContextType | null = null;

// Helper to set the context when provider is mounted
export const setGlobalNotificationContext = (context: NotificationContextType | null) => {
 notificationContext = context;
};

export interface ToastAction {
 label: string;
 onClick: () => void;
}

/**
 * Enriched success messages for key achievements
 * Creates memorable "aha moments" by adding context to what was accomplished
 */
export const SUCCESS_MESSAGES = {
 // Entity creation
 ASSET_CREATED: { title: 'Actif ajouté', message: 'Votre nouvel actif est prêt à être évalué.' },
 RISK_CREATED: { title: 'Risque identifié', message: 'Vous pouvez maintenant définir les mesures de traitement.' },
 CONTROL_CREATED: { title: 'Contrôle ajouté', message: 'Ce contrôle contribue à votre score de conformité.' },
 DOCUMENT_CREATED: { title: 'Document enregistré', message: 'Il est maintenant accessible à votre équipe.' },
 PROJECT_CREATED: { title: 'Projet lancé', message: 'Votre nouveau projet est prêt à démarrer.' },
 AUDIT_CREATED: { title: 'Audit planifié', message: 'Les parties prenantes seront notifiées.' },

 // Progress achievements
 COMPLIANCE_IMPROVED: { title: 'Score amélioré', message: 'Votre conformité progresse.' },
 RISK_MITIGATED: { title: 'Risque traité', message: 'Votre exposition au risque diminue.' },
 TASK_COMPLETED: { title: 'Tâche terminée', message: 'Vous avancez bien.' },
 MILESTONE_REACHED: { title: 'Jalon atteint', message: 'Excellente progression.' },

 // Team collaboration
 MEMBER_INVITED: { title: 'Invitation envoyée', message: 'Votre collaborateur recevra un email.' },
 TEAM_UPDATED: { title: 'Équipe mise à jour', message: 'Les permissions sont actives.' },

 // Configuration
 SETTINGS_SAVED: { title: 'Paramètres enregistrés', message: 'Vos préférences sont appliquées.' },
 FRAMEWORK_ACTIVATED: { title: 'Référentiel activé', message: 'Les contrôles associés sont disponibles.' },

 // Export/Reports
 REPORT_GENERATED: { title: 'Rapport généré', message: 'Le téléchargement va démarrer.' },
 EXPORT_COMPLETE: { title: 'Export terminé', message: 'Vos données sont prêtes.' },
} as const;

export type SuccessMessageKey = keyof typeof SUCCESS_MESSAGES;

export const toast = {
 success: (title: string, message?: string, action?: ToastAction) => {
 if (notificationContext) {
 const actualTitle = message ? title : 'Succès';
 const actualMessage = message ? message : title;
 return notificationContext.addNotification({ type: 'success', title: actualTitle, message: actualMessage, action });
 }
 return '';
 },
 error: (title: string, message?: string, action?: ToastAction) => {
 if (notificationContext) {
 const actualTitle = message ? title : 'Erreur';
 const actualMessage = message ? message : title;
 return notificationContext.addNotification({ type: 'error', title: actualTitle, message: actualMessage, action });
 }
 return '';
 },
 warning: (title: string, message?: string, action?: ToastAction) => {
 if (notificationContext) {
 const actualTitle = message ? title : 'Attention';
 const actualMessage = message ? message : title;
 return notificationContext.addNotification({ type: 'warning', title: actualTitle, message: actualMessage, action });
 }
 return '';
 },
 info: (title: string, message?: string, action?: { label: string; onClick: () => void }) => {
 if (notificationContext) {
 const actualTitle = message ? title : 'Information';
 const actualMessage = message ? message : title;
 return notificationContext.addNotification({
 type: 'info',
 title: actualTitle,
 message: actualMessage,
 action
 });
 }
 return '';
 },
 persistent: (type: NotificationType, title: string, message?: string, action?: { label: string; onClick: () => void }) => {
 if (notificationContext) {
 return notificationContext.addNotification({
 type,
 title,
 message,
 persistent: true,
 action
 });
 }
 return '';
 },
 dismiss: (id: string) => {
 if (notificationContext) {
 notificationContext.removeNotification(id);
 }
 },
 promise: <T>(promise: Promise<T>, data: { loading: string; success: string | ((data: T) => string); error: string | ((error: unknown) => string) }) => {
 const context = notificationContext;
 if (!context) return promise;
 const id = context.addNotification({ type: 'info', title: 'Chargement', message: data.loading, persistent: true });

 promise.then((res) => {
 context.removeNotification(id);
 const successMsg = typeof data.success === 'function' ? data.success(res) : data.success;
 context.addNotification({ type: 'success', title: 'Succès', message: successMsg });
 }).catch((err) => {
 context.removeNotification(id);
 const errorMsg = typeof data.error === 'function' ? data.error(err) : data.error;
 context.addNotification({ type: 'error', title: 'Erreur', message: errorMsg });
 });

 return promise;
 },

 /**
 * Celebrate an achievement with an enriched success message
 * Creates a memorable "aha moment" with contextual feedback
 *
 * @param key - The success message key from SUCCESS_MESSAGES
 * @param action - Optional action button
 * @param celebrate - Whether to trigger celebration effect (haptic feedback)
 *
 * @example
 * toast.celebrate('ASSET_CREATED');
 * toast.celebrate('COMPLIANCE_IMPROVED', { label: 'Voir le score', onClick: () => navigate('/compliance') });
 */
 celebrate: (key: SuccessMessageKey, action?: ToastAction, celebrate = true) => {
 if (notificationContext) {
 const msg = SUCCESS_MESSAGES[key];

 // Trigger haptic feedback for celebration on mobile
 if (celebrate && 'vibrate' in navigator) {
 navigator.vibrate([50, 30, 50]);
 }

 return notificationContext.addNotification({
 type: 'success',
 title: msg.title,
 message: msg.message,
 action
 });
 }
 return '';
 },

 /**
 * Show a toast with an undo action after a destructive operation
 * The toast stays visible longer (8 seconds) to give users time to undo
 *
 * @param itemName - Name of the deleted item for context
 * @param onUndo - Callback to restore the item
 * @param itemType - Optional type of item (default: 'élément')
 * @returns Object with cancel method to dismiss the toast programmatically
 *
 * @example
 * const { cancel } = toast.deleted('Serveur-01', async () => {
 * await restoreAsset(assetId);
 * }, 'actif');
 *
 * // If undo is successful, the item is restored and toast dismissed
 * // If timeout expires, the deletion is permanent
 */
 deleted: (itemName: string, onUndo: () => void | Promise<void>, itemType = 'élément') => {
 if (!notificationContext) return { cancel: () => { } };

 let undoClicked = false;
 const context = notificationContext;

 const toastId = context.addNotification({
 type: 'info',
 title: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} supprimé`,
 message: `"${itemName}" a été supprimé.`,
 duration: 8000, // Longer duration for undo opportunity
 action: {
 label: 'Annuler',
 onClick: async () => {
  undoClicked = true;
  context.removeNotification(toastId);

  try {
  await onUndo();
  context.addNotification({
  type: 'success',
  title: 'Restauré',
  message: `"${itemName}" a été restauré.`
  });
  } catch {
  context.addNotification({
  type: 'error',
  title: 'Échec',
  message: `Impossible de restaurer "${itemName}".`
  });
  }
 }
 }
 });

 return {
 cancel: () => {
 if (!undoClicked) {
  context.removeNotification(toastId);
 }
 },
 wasUndone: () => undoClicked
 };
 },

 /**
 * Show a toast with undo for bulk deletion
 *
 * @param count - Number of items deleted
 * @param onUndo - Callback to restore the items
 * @param itemType - Type of items (default: 'éléments')
 *
 * @example
 * toast.bulkDeleted(5, async () => {
 * await restoreAssets(assetIds);
 * }, 'actifs');
 */
 bulkDeleted: (count: number, onUndo: () => void | Promise<void>, itemType = 'éléments') => {
 if (!notificationContext) return { cancel: () => { } };

 let undoClicked = false;
 const context = notificationContext;

 const toastId = context.addNotification({
 type: 'info',
 title: `${count} ${itemType} supprimés`,
 message: `La suppression sera définitive dans quelques secondes.`,
 duration: 8000,
 action: {
 label: 'Annuler',
 onClick: async () => {
  undoClicked = true;
  context.removeNotification(toastId);

  try {
  await onUndo();
  context.addNotification({
  type: 'success',
  title: 'Restaurés',
  message: `${count} ${itemType} ont été restaurés.`
  });
  } catch {
  context.addNotification({
  type: 'error',
  title: 'Échec',
  message: `Impossible de restaurer les ${itemType}.`
  });
  }
 }
 }
 });

 return {
 cancel: () => {
 if (!undoClicked) {
  context.removeNotification(toastId);
 }
 },
 wasUndone: () => undoClicked
 };
 }
};
