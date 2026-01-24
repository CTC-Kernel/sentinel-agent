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
 *   Score de risque
 *   <HelpTooltip content="Le score est calculé en multipliant la probabilité par l'impact (1-25)" />
 * </label>
 * ```
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({
    content,
    position = 'top',
    className = '',
    size = 'sm'
}) => {
    const sizeClasses = {
        sm: 'w-3.5 h-3.5',
        md: 'w-4 h-4',
        lg: 'w-5 h-5'
    };

    return (
        <Tooltip content={content} position={position}>
            <span
                className={`inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors cursor-help ${className}`}
                aria-label="Aide"
            >
                <HelpCircle className={sizeClasses[size]} />
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
    <p className={`text-xs text-muted-foreground mt-1.5 leading-relaxed ${className}`}>
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
 *   label="Probabilité"
 *   help="Évaluez la probabilité sur une échelle de 1 (rare) à 5 (quasi-certain)"
 *   required
 *   htmlFor="probability-input"
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
