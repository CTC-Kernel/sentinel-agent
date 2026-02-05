/**
 * DashboardEditModeToggle Component
 * Controls for entering/exiting dashboard edit mode and reset to defaults
 *
 * Story 2-6: Configurable Dashboard Widgets
 * Implements Task 4: Edit mode UI (AC: 1, 5)
 */

import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { Pencil, Check, RotateCcw } from '../ui/Icons';

export interface DashboardEditModeToggleProps {
 /** Current edit mode state */
 isEditing: boolean;
 /** Callback when edit mode changes */
 onEditModeChange: (isEditing: boolean) => void;
 /** Callback when reset is requested */
 onReset: () => void;
 /** Whether the layout is customized (different from defaults) */
 isCustomized?: boolean;
 /** Whether layout is syncing to server */
 isSyncing?: boolean;
 /** Additional CSS classes */
 className?: string;
 /** Size variant */
 size?: 'sm' | 'md';
}

/**
 * Reset confirmation dialog
 */
function ResetConfirmDialog({
 isOpen,
 onConfirm,
 onCancel,
}: {
 isOpen: boolean;
 onConfirm: () => void;
 onCancel: () => void;
}) {
 const { t } = useTranslation();

 useEffect(() => {
 if (isOpen) {
 const dialog = document.getElementById('reset-confirm-dialog');
 if (dialog) {
 const focusable = dialog.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
 if (focusable.length > 0) (focusable[0] as HTMLElement).focus();
 }
 }
 }, [isOpen]);

 if (!isOpen) return null;

 return (
 <div
 className="fixed inset-0 z-modal flex items-center justify-center bg-black/50"
 >
 <button
 className="absolute inset-0 w-full h-full bg-transparent border-0 cursor-pointer"
 onClick={onCancel}
 onKeyDown={(e) => {
 if (e.key === 'Escape') onCancel();
 }}
 aria-label="Fermer la boîte de dialogue"
 />
 <div
 className="relative bg-background rounded-3xl shadow-2xl p-6 max-w-sm mx-4 border border-muted pointer-events-none"
 >
 <div
 id="reset-confirm-dialog"
 className="pointer-events-auto"
 role="alertdialog"
 aria-modal="true"
 aria-labelledby="reset-confirm-title"
 >
 <div
 className="flex items-center gap-3 mb-4"
 >
 <h3
 id="reset-confirm-title"
 className="text-lg font-semibold text-foreground"
 >
 {t('dashboard.resetToDefaults')}
 </h3>
 </div>

 <p className="text-sm text-muted-foreground mb-6">
 {t('dashboard.resetConfirm')}
 </p>

 <div className="flex gap-3 justify-end">
 <button
 type="button"
 onClick={onCancel}
 className={cn(
 'px-4 py-2 rounded-lg text-sm font-medium',
 'text-foreground',
 'bg-muted',
 'hover:bg-muted/80',
 'transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2'
 )}
 >
 {t('common.cancel')}
 </button>
 <button
 type="button"
 onClick={onConfirm}
 className={cn(
 'px-4 py-2 rounded-lg text-sm font-medium',
 'text-white bg-warning hover:bg-warning/80',
 'transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2'
 )}
 >
 {t('dashboard.resetToDefaults')}
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}

/**
 * DashboardEditModeToggle - Edit mode controls for configurable dashboard
 *
 * @example
 * ```tsx
 * <DashboardEditModeToggle
 * isEditing={isEditing}
 * onEditModeChange={setIsEditing}
 * onReset={handleReset}
 * isCustomized={isCustomized}
 * />
 * ```
 */
export function DashboardEditModeToggle({
 isEditing,
 onEditModeChange,
 onReset,
 isCustomized = false,
 isSyncing = false,
 className,
 size = 'md',
}: DashboardEditModeToggleProps) {
 const { t } = useTranslation();
 const [showResetConfirm, setShowResetConfirm] = useState(false);

 const sizeClasses = {
 sm: 'text-xs px-3 py-1.5 gap-1.5',
 md: 'text-sm px-4 py-2 gap-2',
 };

 const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

 const handleReset = () => {
 onReset();
 setShowResetConfirm(false);
 onEditModeChange(false);
 };

 return (
 <>
 <div
 className={cn('flex items-center gap-2', className)}
 role="toolbar"
 aria-label={t('dashboard.editMode')}
 >
 {/* Reset button - only show in edit mode and if customized */}
 {isEditing && isCustomized && (
 <button
 type="button"
 onClick={() => setShowResetConfirm(true)}
 className={cn(
 'inline-flex items-center rounded-full font-medium transition-all duration-200',
 'text-muted-foreground hover:text-foreground hover:bg-muted',
 ' dark:hover:text-white dark:hover:bg-white/10',
 'focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2',
 sizeClasses[size]
 )}
 aria-label={t('dashboard.resetToDefaults')}
 >
 <RotateCcw className={cn(iconSize, "transition-transform group-hover:-rotate-180")} aria-hidden="true" />
 <span className="hidden sm:inline">{t('dashboard.resetToDefaults')}</span>
 </button>
 )}

 {/* Sync indicator */}
 {isEditing && isSyncing && (
 <span
 className={cn(
 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
 'bg-muted text-muted-foreground',
 'dark:bg-white/5 '
 )}
 aria-live="polite"
 >
 <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
 <span className="hidden sm:inline">{t('common.saving')}</span>
 </span>
 )}

 {/* Main toggle button */}
 <button
 type="button"
 onClick={() => onEditModeChange(!isEditing)}
 className={cn(
 'group inline-flex items-center gap-2 rounded-full font-semibold transition-all duration-200 border',
 isEditing
 ? [
 'border-blue-500/20 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
 'dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-400',
 'hover:bg-blue-500/20 dark:hover:bg-blue-400/20',
 'focus:ring-blue-500',
 ]
 : [
 'border-border bg-white text-foreground shadow-sm',
 'dark:border-white/10 dark:bg-white/5 /60',
 'hover:bg-muted/50 dark:hover:bg-white/10 hover:border-border dark:hover:border-white/20',
 'focus:ring-slate-500',
 ],
 'focus:outline-none focus:ring-2 focus:ring-offset-2',
 sizeClasses[size]
 )}
 aria-pressed={isEditing}
 aria-label={
 isEditing ? t('dashboard.doneEditing') : t('dashboard.customize')
 }
 >
 {isEditing ? (
 <>
 <Check className={iconSize} strokeWidth={2.5} aria-hidden="true" />
 <span>{t('dashboard.doneEditing')}</span>
 </>
 ) : (
 <>
 <Pencil className={cn(iconSize, "text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground transition-colors")} aria-hidden="true" />
 <span>{t('dashboard.customize')}</span>
 </>
 )}
 </button>
 </div>

 {/* Reset confirmation dialog */}
 <ResetConfirmDialog
 isOpen={showResetConfirm}
 onConfirm={handleReset}
 onCancel={() => setShowResetConfirm(false)}
 />
 </>
 );
}

export default DashboardEditModeToggle;
