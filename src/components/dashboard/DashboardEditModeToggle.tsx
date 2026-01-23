/**
 * DashboardEditModeToggle Component
 * Controls for entering/exiting dashboard edit mode and reset to defaults
 *
 * Story 2-6: Configurable Dashboard Widgets
 * Implements Task 4: Edit mode UI (AC: 1, 5)
 */

import { useState } from 'react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { Pencil, Check, RotateCcw, AlertTriangle } from '../ui/Icons';

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-confirm-title"
      onClick={onCancel}
    >
      <div
        className="bg-background rounded-xl shadow-2xl p-6 max-w-sm mx-4 border border-muted"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-warning/10 rounded-full">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
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
  );
}

/**
 * DashboardEditModeToggle - Edit mode controls for configurable dashboard
 *
 * @example
 * ```tsx
 * <DashboardEditModeToggle
 *   isEditing={isEditing}
 *   onEditModeChange={setIsEditing}
 *   onReset={handleReset}
 *   isCustomized={isCustomized}
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
        {/* Edit mode indicator */}
        {isEditing && (
          <span
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              'bg-primary/10 text-primary',
              'animate-pulse'
            )}
            aria-live="polite"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {t('dashboard.editMode')}
          </span>
        )}

        {/* Sync indicator */}
        {isSyncing && (
          <span
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
              'text-muted-foreground'
            )}
            aria-live="polite"
          >
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            {t('common.loading')}
          </span>
        )}

        {/* Reset button - only show in edit mode and if customized */}
        {isEditing && isCustomized && (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className={cn(
              'inline-flex items-center rounded-lg font-medium transition-all',
              'text-warning',
              'bg-warning/10',
              'hover:bg-warning/20',
              'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2',
              sizeClasses[size]
            )}
            aria-label={t('dashboard.resetToDefaults')}
          >
            <RotateCcw className={iconSize} aria-hidden="true" />
            <span className="hidden sm:inline">{t('dashboard.resetToDefaults')}</span>
          </button>
        )}

        {/* Main toggle button */}
        <button
          type="button"
          onClick={() => onEditModeChange(!isEditing)}
          className={cn(
            'inline-flex items-center rounded-lg font-medium transition-all',
            isEditing
              ? [
                  'text-white bg-success hover:bg-success',
                  'focus:ring-green-500',
                ]
              : [
                  'text-foreground',
                  'bg-muted',
                  'hover:bg-muted/80',
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
              <Check className={iconSize} aria-hidden="true" />
              <span>{t('dashboard.doneEditing')}</span>
            </>
          ) : (
            <>
              <Pencil className={iconSize} aria-hidden="true" />
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
