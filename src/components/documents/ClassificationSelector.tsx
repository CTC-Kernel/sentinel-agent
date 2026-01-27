/**
 * Story 24.2 - UI Sélecteur de Classification
 *
 * Dropdown component for selecting document classification level.
 */

import React from 'react';
import { ChevronDown, Check, AlertTriangle } from '../ui/Icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CLASSIFICATION_CONFIG, canAccessClassification, getClassificationLevels } from '@/services/vaultConfig';
import type { ClassificationLevel } from '@/types/vault';
import { useLocale } from '@/hooks/useLocale';
import { useStore } from '@/store';

interface ClassificationSelectorProps {
  value?: ClassificationLevel;
  onChange: (level: ClassificationLevel, justification?: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  showJustificationFor?: ClassificationLevel[];
}

export function ClassificationSelector({
  value = 'internal',
  onChange,
  disabled = false,
  required = false,
  className,
  showJustificationFor = ['confidential', 'secret'],
}: ClassificationSelectorProps) {
  const { t } = useLocale();
  const { user } = useStore();
  const userRole = user?.role || 'user';

  const [pendingLevel, setPendingLevel] = React.useState<ClassificationLevel | null>(null);
  const [justification, setJustification] = React.useState('');
  const [showDialog, setShowDialog] = React.useState(false);

  const levels = getClassificationLevels();
  const currentConfig = CLASSIFICATION_CONFIG[value];

  const handleSelect = (level: ClassificationLevel) => {
    // Check if user can set this classification
    if (!canAccessClassification(level, userRole)) {
      return;
    }

    // Check if justification is required
    if (showJustificationFor.includes(level)) {
      setPendingLevel(level);
      setJustification('');
      setShowDialog(true);
    } else {
      onChange(level);
    }
  };

  const handleConfirm = () => {
    if (pendingLevel) {
      onChange(pendingLevel, justification);
      setShowDialog(false);
      setPendingLevel(null);
      setJustification('');
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    setPendingLevel(null);
    setJustification('');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-2 justify-between min-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400',
            className
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">{currentConfig.icon}</span>
            <span>{currentConfig.label}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2">
            {t('classification.title', 'Classification')}
            {required && <Badge variant="outline" className="text-xs">Requis</Badge>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {levels.map((level) => {
            const config = CLASSIFICATION_CONFIG[level];
            const canAccess = canAccessClassification(level, userRole);

            return (
              <DropdownMenuItem
                key={level}
                onClick={() => handleSelect(level)}
                disabled={!canAccess}
                className={cn(
                  'gap-3 cursor-pointer',
                  !canAccess && 'opacity-60 cursor-not-allowed'
                )}
              >
                <span
                  className="text-lg w-6 text-center"
                  style={{ opacity: canAccess ? 1 : 0.5 }}
                >
                  {config.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {config.label}
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {config.description}
                  </div>
                </div>
                {value === level && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {t('classification.hint', 'La classification détermine qui peut accéder au document')}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Justification Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning-500" />
              {t('classification.justification.title', 'Justification requise')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'classification.justification.description',
                `La classification "${pendingLevel ? CLASSIFICATION_CONFIG[pendingLevel].label : ''}" nécessite une justification.`
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="justification">
                {t('classification.justification.label', 'Justification')}
              </Label>
              <Textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder={t(
                  'classification.justification.placeholder',
                  'Expliquez pourquoi ce niveau de classification est nécessaire...'
                )}
                rows={3}
              />
            </div>
            {pendingLevel && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <span className="text-xl">
                  {CLASSIFICATION_CONFIG[pendingLevel].icon}
                </span>
                <div>
                  <div className="font-medium">
                    {CLASSIFICATION_CONFIG[pendingLevel].label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {CLASSIFICATION_CONFIG[pendingLevel].description}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!justification.trim()}
            >
              {t('common.confirm', 'Confirmer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ClassificationSelector;
