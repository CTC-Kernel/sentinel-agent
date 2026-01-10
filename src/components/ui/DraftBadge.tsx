/**
 * DraftBadge - Visual indicator for draft status (Story 1.3)
 *
 * Displays a localized "Draft" / "Brouillon" badge for entities saved as drafts.
 *
 * @module DraftBadge
 */

import React from 'react';
import { Badge } from './Badge';
import { useLocale } from '../../hooks/useLocale';
import { FileEdit } from '../ui/Icons';

interface DraftBadgeProps {
  /** Size variant */
  size?: 'sm' | 'md';
  /** Badge visual variant */
  variant?: 'default' | 'outline' | 'soft' | 'glass';
  /** Show icon */
  showIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Override the label (useful for testing) */
  label?: string;
}

/**
 * Badge component to indicate draft status.
 * Automatically localizes label based on current locale.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DraftBadge />
 *
 * // With icon
 * <DraftBadge showIcon />
 *
 * // Different sizes
 * <DraftBadge size="md" />
 *
 * // In a list item
 * <div className="flex items-center gap-2">
 *   <span>{document.title}</span>
 *   {document.status === 'Brouillon' && <DraftBadge />}
 * </div>
 * ```
 */
export const DraftBadge: React.FC<DraftBadgeProps> = ({
  size = 'sm',
  variant = 'soft',
  showIcon = false,
  className = '',
  label,
}) => {
  const { locale } = useLocale();

  // Localized label
  const draftLabel = label ?? (locale === 'fr' ? 'Brouillon' : 'Draft');

  return (
    <Badge
      status="warning"
      variant={variant}
      size={size}
      className={className}
      icon={showIcon ? FileEdit : undefined}
    >
      {draftLabel}
    </Badge>
  );
};

/**
 * Check if an entity status indicates draft mode.
 * Handles various status conventions used in the codebase.
 *
 * @param status - The status value to check
 * @returns True if the status represents a draft
 */
export function isDraftStatus(status: string | undefined | null): boolean {
  if (!status) return false;

  const draftValues = [
    'draft',
    'Draft',
    'Brouillon',
    'brouillon',
  ];

  return draftValues.includes(status);
}

/**
 * Conditionally renders a DraftBadge based on status.
 *
 * @example
 * ```tsx
 * <div className="flex items-center gap-2">
 *   <span>{document.title}</span>
 *   <ConditionalDraftBadge status={document.status} />
 * </div>
 * ```
 */
export const ConditionalDraftBadge: React.FC<
  DraftBadgeProps & { status: string | undefined | null }
> = ({ status, ...badgeProps }) => {
  if (!isDraftStatus(status)) {
    return null;
  }

  return <DraftBadge {...badgeProps} />;
};

export default DraftBadge;
