import React, { useState } from 'react';
import { TreatmentAction, TreatmentActionStatus } from '../../types';
import { ListChecks, Calendar, User, Edit, Trash2, Plus, CheckCircle2, Clock, Circle } from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { TreatmentActionForm } from './TreatmentActionForm';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';

interface TreatmentActionsListProps {
 actions: TreatmentAction[];
 users: { uid: string; displayName: string }[];
 onAdd: (action: Omit<TreatmentAction, 'id' | 'createdAt'>) => void;
 onUpdate: (action: TreatmentAction) => void;
 onDelete: (actionId: string) => void;
 readOnly?: boolean;
 onDirtyChange?: (isDirty: boolean) => void;
}

const STATUS_CONFIG: Record<TreatmentActionStatus, { icon: typeof CheckCircle2; color: string; badgeStatus: 'success' | 'warning' | 'info' }> = {
 'À faire': { icon: Circle, color: 'text-muted-foreground', badgeStatus: 'info' },
 'En cours': { icon: Clock, color: 'text-warning-text', badgeStatus: 'warning' },
 'Terminé': { icon: CheckCircle2, color: 'text-success-text', badgeStatus: 'success' }
};

export const TreatmentActionsList: React.FC<TreatmentActionsListProps> = ({
 actions,
 users,
 onAdd,
 onUpdate,
 onDelete,
 readOnly = false,
 onDirtyChange
}) => {
 const { t, dateFnsLocale } = useLocale();
 const [isAdding, setIsAdding] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);

 const handleCloseAdd = () => {
 setIsAdding(false);
 onDirtyChange?.(false);
 };

 const handleCloseEdit = () => {
 setEditingId(null);
 onDirtyChange?.(false);
 };

 const getUserName = (userId?: string) => {
 if (!userId) return t('risks.treatment.not_assigned', { defaultValue: 'Non assigné' });
 const user = users.find(u => u.uid === userId);
 return user?.displayName || userId;
 };

 const getDeadlineStatus = (deadline?: string) => {
 if (!deadline) return null;
 try {
 const date = parseISO(deadline);
 if (isPast(date) && !isToday(date)) {
 return { label: t('risks.treatment.late', { defaultValue: 'En retard' }), color: 'text-red-600 bg-red-50 dark:bg-red-900/30 border-red-200' };
 }
 if (isToday(date)) {
 return { label: t('risks.treatment.today', { defaultValue: "Aujourd'hui" }), color: 'text-warning-text bg-warning-bg border-warning-border' };
 }
 return null;
 } catch {
 return null;
 }
 };

 const handleSaveNew = (actionData: Omit<TreatmentAction, 'id' | 'createdAt'> & { id?: string }) => {
 onAdd(actionData);
 handleCloseAdd();
 };

 const handleSaveEdit = (actionData: Omit<TreatmentAction, 'id' | 'createdAt'> & { id?: string }) => {
 if (!actionData.id) return;
 const existingAction = actions.find(a => a.id === actionData.id);
 if (!existingAction) return;

 onUpdate({
 ...existingAction,
 ...actionData,
 id: actionData.id
 } as TreatmentAction);
 handleCloseEdit();
 };

 const handleStatusChange = (action: TreatmentAction, newStatus: TreatmentActionStatus) => {
 onUpdate({
 ...action,
 status: newStatus,
 updatedAt: new Date().toISOString(),
 completedAt: newStatus === 'Terminé' ? new Date().toISOString() : action.completedAt
 });
 };

 // Calculate progress
 const totalActions = actions.length;
 const completedActions = actions.filter(a => a.status === 'Terminé').length;
 const progressPercentage = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

 return (
 <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-base font-bold text-foreground flex items-center gap-2">
  <ListChecks className="h-4 w-4 text-primary" />
  {t('risks.treatment.actions_title', { defaultValue: 'Actions de traitement' })} ({totalActions})
 </h3>
 {totalActions > 0 && (
  <div className="flex items-center gap-2">
  <span className="text-xs font-semibold text-muted-foreground"> {t('risks.treatment.progress', { defaultValue: 'Progression' })}:</span>
  <div className="flex items-center gap-1.5">
  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
  <div
   className="h-full rounded-full bg-success-text transition-all"
   style={{ width: `${progressPercentage}%` }}
  />
  </div>
  <span className="text-xs font-bold text-success-text">
  {completedActions}/{totalActions}
  </span>
  </div>
  </div>
 )}
 </div>

 {/* Actions List */}
 <div className="space-y-2">
 {actions.length === 0 && !isAdding ? (
  <p className="text-sm text-muted-foreground italic py-4 text-center">
  {t('risks.treatment.no_actions', { defaultValue: 'Aucune action de traitement définie.' })}
  </p>
 ) : (
  actions.map(action => {
  if (editingId === action.id) {
  return (
  <TreatmentActionForm
   key={action.id || 'unknown'}
   action={action}
   users={users}
   onSave={handleSaveEdit}
   onCancel={handleCloseEdit}
   onDirtyChange={onDirtyChange}
  />
  );
  }

  const StatusIcon = STATUS_CONFIG[action.status].icon;
  const deadlineStatus = action.status !== 'Terminé' ? getDeadlineStatus(action.deadline) : null;

  return (
  <div
  key={action.id || 'unknown'}
  className={`flex items-start gap-3 p-3 rounded-3xl border transition-colors ${action.status === 'Terminé'
   ? 'bg-success-bg/50 dark:bg-success-bg/10 border-success-border dark:border-success-border/30'
   : 'bg-card border-border/40 hover:shadow-sm'
   }`}
  >
  {/* Status Toggle */}
  {!readOnly && (
   <button
   type="button"
   onClick={() => {
   const nextStatus: TreatmentActionStatus =
   action.status === 'À faire' ? 'En cours' :
    action.status === 'En cours' ? 'Terminé' : 'À faire';
   handleStatusChange(action, nextStatus);
   }}
   className={`mt-0.5 flex-shrink-0 ${STATUS_CONFIG[action.status].color} hover:scale-110 transition-transform`}
   title={`${t('risks.treatment.statusLabel', { defaultValue: 'Statut' })}: ${action.status}`}
   >
   <StatusIcon className="h-5 w-5" />
   </button>
  )}

  {/* Content */}
  <div className="flex-1 min-w-0">
   <p className={`text-sm font-semibold ${action.status === 'Terminé'
   ? 'text-muted-foreground line-through'
   : 'text-foreground'
   }`}>
   {action.title}
   </p>
   {action.description && (
   <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
   {action.description}
   </p>
   )}
   <div className="flex flex-wrap items-center gap-2 mt-2">
   <Badge
   status={STATUS_CONFIG[action.status].badgeStatus}
   variant="soft"
   size="sm"
   >
   {action.status}
   </Badge>
   {action.ownerId && (
   <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
   <User className="h-3 w-3" />
   {getUserName(action.ownerId)}
   </span>
   )}
   {action.deadline && (
   <span className={`inline-flex items-center gap-1 text-xs ${deadlineStatus ? deadlineStatus.color + ' px-1.5 py-0.5 rounded-full border' : 'text-muted-foreground'
   }`}>
   <Calendar className="h-3 w-3" />
   {deadlineStatus ? deadlineStatus.label : format(parseISO(action.deadline), 'dd MMM yyyy', { locale: dateFnsLocale })}
   </span>
   )}
   </div>
  </div>

  {/* Actions */}
  {!readOnly && (
   <div className="flex items-center gap-1 flex-shrink-0">
   <Button
   variant="ghost"
   size="sm"
   onClick={() => setEditingId(action.id)}
   className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
   aria-label={t('risks.treatment.edit_action', { defaultValue: "Modifier l'action" })}
   >
   <Edit className="h-3.5 w-3.5" />
   </Button>
   <Button
   variant="ghost"
   size="sm"
   onClick={() => onDelete(action.id)}
   className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
   aria-label={t('risks.treatment.delete_action', { defaultValue: "Supprimer l'action" })}
   >
   <Trash2 className="h-3.5 w-3.5" />
   </Button>
   </div>
  )}
  </div>
  );
  })
 )}
 </div>

 {/* Add Action */}
 {isAdding ? (
 <TreatmentActionForm
  users={users}
  onSave={handleSaveNew}
  onCancel={handleCloseAdd}
  onDirtyChange={onDirtyChange}
 />
 ) : !readOnly && (
 <Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => setIsAdding(true)}
  className="w-full gap-1.5 border-dashed"
 >
  <Plus className="h-4 w-4" />
  {t('risks.treatment.add_action', { defaultValue: 'Ajouter une action' })}
 </Button>
 )}
 </div>
 );
};
