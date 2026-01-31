/**
 * InlineEdit Component
 * Enables inline editing of text with click-to-edit functionality
 * Provides smooth transitions and auto-save capabilities
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Pencil, Loader2 } from './Icons';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

interface InlineEditProps {
    /** Current value */
    value: string;
    /** Called when value is saved */
    onSave: (value: string) => Promise<void> | void;
    /** Placeholder when empty */
    placeholder?: string;
    /** Input type */
    type?: 'text' | 'number' | 'email' | 'url';
    /** Multiline textarea */
    multiline?: boolean;
    /** Maximum length */
    maxLength?: number;
    /** Minimum length */
    minLength?: number;
    /** Validate before save */
    validate?: (value: string) => string | null;
    /** Render custom display */
    renderDisplay?: (value: string) => React.ReactNode;
    /** Additional class for the container */
    className?: string;
    /** Additional class for the display text */
    displayClassName?: string;
    /** Additional class for the input */
    inputClassName?: string;
    /** Disable editing */
    disabled?: boolean;
    /** Show edit icon on hover */
    showEditIcon?: boolean;
    /** Auto-save on blur (skip confirm buttons) */
    autoSave?: boolean;
    /** Save on Enter key */
    saveOnEnter?: boolean;
    /** Cancel on Escape key */
    cancelOnEscape?: boolean;
}

export const InlineEdit: React.FC<InlineEditProps> = ({
    value,
    onSave,
    placeholder,
    type = 'text',
    multiline = false,
    maxLength,
    minLength = 0,
    validate,
    renderDisplay,
    className,
    displayClassName,
    inputClassName,
    disabled = false,
    showEditIcon = true,
    autoSave = true,
    saveOnEnter = true,
    cancelOnEscape = true
}) => {
    const { t } = useTranslation();
    const resolvedPlaceholder = placeholder ?? t('common.clickToEdit', { defaultValue: 'Cliquez pour modifier...' });
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Update local value when prop changes
    useEffect(() => {
        if (!isEditing) {
            setEditValue(value);
        }
    }, [value, isEditing]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const startEditing = useCallback(() => {
        if (disabled) return;
        setIsEditing(true);
        setEditValue(value);
        setError(null);
    }, [disabled, value]);

    const cancelEditing = useCallback(() => {
        setIsEditing(false);
        setEditValue(value);
        setError(null);
    }, [value]);

    const saveValue = useCallback(async () => {
        const trimmedValue = editValue.trim();

        // Validation
        if (minLength > 0 && trimmedValue.length < minLength) {
            setError(t('validation.minLength', { defaultValue: `Minimum ${minLength} caractères requis`, count: minLength }));
            return;
        }

        if (validate) {
            const validationError = validate(trimmedValue);
            if (validationError) {
                setError(validationError);
                return;
            }
        }

        // Skip save if unchanged
        if (trimmedValue === value) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await onSave(trimmedValue);
            setIsEditing(false);

            // Haptic feedback on success
            if ('vibrate' in navigator) {
                navigator.vibrate(30);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.saveError', { defaultValue: 'Erreur lors de la sauvegarde' }));
        } finally {
            setIsSaving(false);
        }
    }, [editValue, value, minLength, validate, onSave, t]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && saveOnEnter && !multiline) {
            e.preventDefault();
            saveValue();
        }
        if (e.key === 'Escape' && cancelOnEscape) {
            e.preventDefault();
            cancelEditing();
        }
    }, [saveOnEnter, multiline, saveValue, cancelOnEscape, cancelEditing]);

    const handleBlur = useCallback((e: React.FocusEvent) => {
        // Don't save on blur if clicking the save/cancel buttons
        if (containerRef.current?.contains(e.relatedTarget as Node)) {
            return;
        }
        if (autoSave) {
            saveValue();
        }
    }, [autoSave, saveValue]);

    const InputComponent = multiline ? 'textarea' : 'input';

    return (
        <div
            ref={containerRef}
            className={cn('relative group', className)}
        >
            <AnimatePresence mode="popLayout">
                {isEditing ? (
                    <motion.div
                        key="edit"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-start gap-2"
                    >
                        <div className="flex-1 relative">
                            <InputComponent
                                ref={inputRef as React.RefObject<HTMLInputElement & HTMLTextAreaElement>}
                                type={multiline ? undefined : type}
                                value={editValue}
                                onChange={(e) => {
                                    setEditValue(e.target.value);
                                    setError(null);
                                }}
                                onKeyDown={handleKeyDown}
                                onBlur={handleBlur}
                                maxLength={maxLength}
                                disabled={isSaving}
                                className={cn(
                                    'w-full px-2 py-1 text-sm bg-white dark:bg-slate-800 border rounded-lg',
                                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                                    'transition-colors duration-200',
                                    error
                                        ? 'border-error-500 focus-visible:ring-error-500/50'
                                        : 'border-border/40 dark:border-slate-600',
                                    multiline && 'min-h-[80px] resize-y',
                                    inputClassName
                                )}
                                placeholder={resolvedPlaceholder}
                            />
                            {error && (
                                <motion.p
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-xs text-error-500 mt-1"
                                >
                                    {error}
                                </motion.p>
                            )}
                        </div>

                        {!autoSave && (
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={saveValue}
                                    disabled={isSaving}
                                    className="p-1.5 text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20 rounded-lg transition-colors disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                                    aria-label={t('common.save', { defaultValue: 'Sauvegarder' })}
                                >
                                    {isSaving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="h-4 w-4" />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={cancelEditing}
                                    disabled={isSaving}
                                    className="p-1.5 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                                    aria-label={t('common.cancel', { defaultValue: 'Annuler' })}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="display"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={startEditing}
                        className={cn(
                            'flex items-center gap-2 px-2 py-1 -mx-2 -my-1 rounded-lg cursor-pointer',
                            'transition-colors duration-200',
                            !disabled && 'hover:bg-slate-100 dark:hover:bg-slate-800',
                            disabled && 'cursor-default opacity-60'
                        )}
                        role="button"
                        tabIndex={disabled ? -1 : 0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                startEditing();
                            }
                        }}
                        aria-label={`${t('common.edit', { defaultValue: 'Modifier' })}: ${value || resolvedPlaceholder}`}
                    >
                        <span
                            className={cn(
                                'flex-1 text-sm',
                                value ? 'text-slate-900 dark:text-white' : 'text-muted-foreground italic',
                                displayClassName
                            )}
                        >
                            {renderDisplay ? renderDisplay(value) : (value || resolvedPlaceholder)}
                        </span>

                        {showEditIcon && !disabled && (
                            <motion.span
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </motion.span>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Saving indicator */}
            {isSaving && autoSave && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                    <Loader2 className="h-4 w-4 text-brand-500 animate-spin" />
                </motion.div>
            )}
        </div>
    );
};

/**
 * InlineEditNumber - Specialized for number editing
 */
interface InlineEditNumberProps extends Omit<InlineEditProps, 'type' | 'value' | 'onSave' | 'validate'> {
    value: number;
    onSave: (value: number) => Promise<void> | void;
    min?: number;
    max?: number;
    step?: number;
}

export const InlineEditNumber: React.FC<InlineEditNumberProps> = ({
    value,
    onSave,
    min,
    max,
    step: _step,
    ...props
}) => {
    const { t } = useTranslation();
    const validate = useCallback((val: string): string | null => {
        const num = parseFloat(val);
        if (isNaN(num)) return t('validation.invalidNumber', { defaultValue: 'Veuillez entrer un nombre valide' });
        if (min !== undefined && num < min) return `${t('validation.minimum', { defaultValue: 'Minimum' })}: ${min}`;
        if (max !== undefined && num > max) return `${t('validation.maximum', { defaultValue: 'Maximum' })}: ${max}`;
        return null;
    }, [min, max, t]);

    return (
        <InlineEdit
            {...props}
            type="number"
            value={String(value)}
            onSave={async (val) => {
                const num = parseFloat(val);
                await onSave(num);
            }}
            validate={validate}
        />
    );
};

export default InlineEdit;
