/**
 * Story 31.2 - View Selector UI
 *
 * Enhanced dropdown component for switching between Voxel view presets.
 * Includes keyboard shortcuts, preset previews, and custom view management.
 */

import React, { useCallback } from 'react';
import { ChevronDown, Check, Plus, Link2, Settings2 } from '../ui/Icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useVoxelStore, useCurrentPreset } from '@/stores/voxelStore';
import { VIEW_PRESETS, getAvailablePresets, type ExtendedViewPresetConfig } from '@/stores/viewPresets';
import type { ViewPreset } from '@/types/voxel';

interface ViewSelectorProps {
  className?: string;
  /** Callback when "Copy Link" is clicked */
  onCopyLink?: () => void;
  /** Callback when "Save Custom View" is clicked */
  onSaveCustomView?: () => void;
  /** Callback when "Manage Views" is clicked */
  onManageViews?: () => void;
}

const KEYBOARD_SHORTCUTS: Record<ViewPreset, string> = {
  executive: '1',
  rssi: '2',
  auditor: '3',
  soc: '4',
  compliance: '5',
  custom: '0',
};

/**
 * Mini preview thumbnail for a preset showing active layers
 */
function PresetThumbnail({ config }: { config: ExtendedViewPresetConfig }) {
  const layerColors: Record<string, string> = {
    asset: 'bg-blue-500',
    risk: 'bg-red-500',
    control: 'bg-green-500',
    incident: 'bg-orange-500',
    supplier: 'bg-purple-500',
    project: 'bg-cyan-500',
    audit: 'bg-amber-500',
  };

  return (
    <div className="flex gap-0.5 mt-1">
      {config.layers.slice(0, 5).map((layer, i) => (
        <div
          key={`${layer}-${i}`}
          className={cn('w-1.5 h-1.5 rounded-full', layerColors[layer] || 'bg-slate-400')}
          title={layer}
        />
      ))}
      {config.layers.length > 5 && (
        <span className="text-[11px] text-muted-foreground">+{config.layers.length - 5}</span>
      )}
    </div>
  );
}

export function ViewSelector({
  className,
  onCopyLink,
  onSaveCustomView,
  onManageViews,
}: ViewSelectorProps) {
  // const { locale } = useLocale();
  const currentPreset = useCurrentPreset();
  const applyPreset = useVoxelStore((s) => s.applyPreset);
  const presets = getAvailablePresets();

  const currentConfig = VIEW_PRESETS[currentPreset];

  // Translation helper with fallback
  const t = useCallback((_key: string, fallback: string) => {
    // Simple translation lookup - in real app would use i18n
    return fallback;
  }, []);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if no modifier keys and not in input
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const preset = Object.entries(KEYBOARD_SHORTCUTS).find(
        ([_, key]) => key === e.key
      )?.[0] as ViewPreset | undefined;

      if (preset && VIEW_PRESETS[preset]) {
        e.preventDefault();
        applyPreset(preset);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [applyPreset]);

  // Handle copy link action
  const handleCopyLink = useCallback(() => {
    onCopyLink?.();
  }, [onCopyLink]);

  // Handle save custom view action
  const handleSaveCustomView = useCallback(() => {
    onSaveCustomView?.();
  }, [onSaveCustomView]);

  // Handle manage views action
  const handleManageViews = useCallback(() => {
    onManageViews?.();
  }, [onManageViews]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400',
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
          'h-9 px-3 gap-2',
          className
        )}
      >
        <span className="text-lg">{currentConfig.icon}</span>
        <span className="hidden sm:inline">
          {t(`voxel.presets.${currentPreset}`, currentConfig.description)}
        </span>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>
          {t('voxel.viewSelector.title', 'Vues predefinies')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {presets.map(({ key, config }) => (
            <DropdownMenuItem
              key={key}
              onClick={() => applyPreset(key)}
              className="gap-3 cursor-pointer py-2"
            >
              <span className="text-lg w-6 text-center">{config.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {t(`voxel.presets.${key}.name`, key.charAt(0).toUpperCase() + key.slice(1))}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {config.description}
                </div>
                <PresetThumbnail config={config} />
              </div>
              <div className="flex items-center gap-2">
                <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
                  {KEYBOARD_SHORTCUTS[key]}
                </kbd>
                {currentPreset === key && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        {/* Actions Section */}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {onSaveCustomView && (
            <DropdownMenuItem onClick={handleSaveCustomView} className="gap-2 cursor-pointer">
              <Plus className="h-4 w-4" />
              <span>{t('voxel.viewSelector.saveCustom', 'Enregistrer la vue actuelle')}</span>
            </DropdownMenuItem>
          )}
          {onCopyLink && (
            <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
              <Link2 className="h-4 w-4" />
              <span>{t('voxel.viewSelector.copyLink', 'Copier le lien')}</span>
            </DropdownMenuItem>
          )}
          {onManageViews && (
            <DropdownMenuItem onClick={handleManageViews} className="gap-2 cursor-pointer">
              <Settings2 className="h-4 w-4" />
              <span>{t('voxel.viewSelector.manage', 'Gerer les vues')}</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          {t('voxel.viewSelector.hint', 'Utilisez les touches 1-5 pour changer de vue')}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ViewSelector;
