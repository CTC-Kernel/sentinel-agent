import React from 'react';
import { Tooltip } from './Tooltip';
import { HelpCircle } from './Icons';

interface HelpTooltipProps {
 /** Help text to display */
 content: React.ReactNode;
 /** Position of the tooltip */
 position?: 'top' | 'bottom' | 'left' | 'right';
 /** Custom class for the icon */
 className?: string;
 /** Size of the help icon */
 size?: 'sm' | 'md' | 'lg';
}

/**
 * HelpTooltip - A help icon with tooltip for contextual guidance
 *
 * Use this component next to form labels or complex UI elements
 * to provide additional context without cluttering the interface.
 *
 * @example
 * ```tsx
 * <label className="flex items-center gap-1">
 * Score de risque
 * <HelpTooltip content="Le score est calculé en multipliant la probabilité par l'impact (1-25)" />
 * </label>
 * ```
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({
 content,
 position = 'top',
 className = '',
 size = 'sm'
}) => {
 // Icon sizes - visual size of the icon
 const iconSizeClasses = {
 sm: 'w-4 h-4', // 16px - increased from 14px
 md: 'w-5 h-5', // 20px - increased from 16px
 lg: 'w-6 h-6' // 24px - increased from 20px
 };

 // Touch target sizes - WCAG AAA requires minimum 44x44px for touch, 24x24px for pointer
 // We use padding to expand the touch target while keeping visual size smaller
 const touchTargetClasses = {
 sm: 'min-w-[24px] min-h-[24px] p-1', // 24px minimum touch target
 md: 'min-w-[32px] min-h-[32px] p-1.5', // 32px touch target
 lg: 'min-w-[44px] min-h-[44px] p-2' // 44px AAA compliant touch target
 };

 return (
 <Tooltip content={content} position={position}>
 <span
 className={`
  inline-flex items-center justify-center
  text-muted-foreground hover:text-primary
  transition-colors cursor-help
  rounded-full hover:bg-muted/50
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
  ${touchTargetClasses[size]}
  ${className}
 `}
 role="button"
 tabIndex={0}
 aria-label="Afficher l'aide"
 aria-describedby={undefined}
 >
 <HelpCircle
  className={iconSizeClasses[size]}
  aria-hidden="true"
 />
 </span>
 </Tooltip>
 );
};

/**
 * FieldHelp - Inline help text that appears below a form field
 * For longer explanations that should always be visible
 */
export const FieldHelp: React.FC<{
 children: React.ReactNode;
 className?: string;
}> = ({ children, className = '' }) => (
 <p
 className={`text-sm text-muted-foreground mt-1.5 leading-relaxed ${className}`}
 role="note"
 >
 {children}
 </p>
);

/**
 * LabelWithHelp - A label with integrated help tooltip
 * Convenient wrapper for form labels that need contextual help
 *
 * @example
 * ```tsx
 * <LabelWithHelp
 * label="Probabilité"
 * help="Évaluez la probabilité sur une échelle de 1 (rare) à 5 (quasi-certain)"
 * required
 * htmlFor="probability-input"
 * />
 * ```
 */
export const LabelWithHelp: React.FC<{
 label: string;
 help: string;
 required?: boolean;
 htmlFor?: string;
 className?: string;
}> = ({ label, help, required, htmlFor, className = '' }) => (
 <label
 htmlFor={htmlFor}
 className={`flex items-center gap-1.5 text-sm font-medium text-foreground ${className}`}
 >
 {label}
 {required && <span className="text-destructive">*</span>}
 <HelpTooltip content={help} />
 </label>
);

export default HelpTooltip;
