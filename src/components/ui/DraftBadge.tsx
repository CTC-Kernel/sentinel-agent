/**
 * DraftBadge - Visual indicator for draft status (Story 1.3)
 *
 * Displays a localized "Draft" / "Brouillon" badge for entities saved as drafts.
 *
 * @module DraftBadge
 */

import { Badge } from './Badge';
import { useLocale } from '../../hooks/useLocale';
import { getDraftLabel } from '../../utils/draftLabels';
import { Edit } from '../ui/Icons';
import { isDraftStatus } from '../../utils/draftUtils';

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
 * <span>{document.title}</span>
 * {document.status === 'Brouillon' && <DraftBadge />}
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

 // Localized label - reuse getDraftLabel for consistency
 const draftLabel = label ?? getDraftLabel(locale);

 return (
 <Badge
 status="warning"
 variant={variant}
 size={size}
 className={className}
 icon={showIcon ? Edit : undefined}
 >
 {draftLabel}
 </Badge>
 );
};



/**
 * Conditionally renders a DraftBadge based on status.
 *
 * @example
 * ```tsx
 * <div className="flex items-center gap-2">
 * <span>{document.title}</span>
 * <ConditionalDraftBadge status={document.status} />
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
