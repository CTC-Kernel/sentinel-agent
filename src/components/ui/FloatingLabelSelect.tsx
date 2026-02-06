import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from './Icons';

type FloatingLabelSelectIconComponent = React.ElementType<{ className?: string }>;

interface FloatingLabelSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
 label: string;
 error?: string;
 icon?: FloatingLabelSelectIconComponent;
 options: { value: string; label: string }[];
}

export const FloatingLabelSelect = React.forwardRef<HTMLSelectElement, FloatingLabelSelectProps>(({
 label,
 error,
 icon: Icon,
 className = '',
 value,
 onFocus,
 onBlur,
 onChange,
 options,
 defaultValue,
 ...props
}, ref) => {
 const [isFocused, setIsFocused] = useState(false);
 const [hasContent, setHasContent] = useState(false);

 const hasValue = (value !== undefined && value !== '' && value !== null) || (defaultValue !== undefined && defaultValue !== '' && defaultValue !== null) || hasContent; // Removed strict option check to prevent overlap

 const autoId = React.useId();
 const fieldId = props.id || `floating-select-${autoId}`;
 const errorId = `${fieldId}-error`;
 const describedBy = [props['aria-describedby'], error ? errorId : null].filter(Boolean).join(' ') || undefined;

 const handleFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
 setIsFocused(true);
 onFocus?.(e);
 };

 const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
 setIsFocused(false);
 onBlur?.(e);
 };

 const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
 setHasContent(e.target.value !== '');
 onChange?.(e);
 };

 return (
 <div className={`relative ${className}`}>
 <div className={`
 relative flex items-center w-full rounded-3xl border transition-all duration-200 backdrop-blur-sm
 ${error
  ? 'border-destructive/60 bg-destructive/5'
  : isFocused
  ? 'border-primary bg-card/95 shadow-glow ring-2 ring-primary/60'
  : 'border-border/40 bg-card/50 hover:border-primary/40'
 }
 `}>
 {Icon && (
  <div className={`pl-4 ${error ? 'text-destructive' : isFocused ? 'text-primary' : 'text-muted-foreground'}`}>
  <Icon className="h-5 w-5" />
  </div>
 )}

 <select
  ref={ref}
  {...props}
  id={fieldId}
  value={value}
  onFocus={handleFocus}
  onBlur={handleBlur}
  onChange={handleChange}
  aria-label={label}
  aria-invalid={!!error}
  aria-describedby={describedBy}
  aria-required={props.required}
  className={`
  w-full px-4 py-3.5 bg-transparent outline-none font-medium text-foreground
  placeholder-transparent rounded-2xl appearance-none
  ${Icon ? 'pl-2' : ''}
  `}
 >
  <option value="" disabled></option>
  {options.map((option) => (
  <option key={option.value || 'unknown'} value={option.value}>
  {option.label}
  </option>
  ))}
 </select>

 <div className="absolute right-4 pointer-events-none text-muted-foreground">
  <ChevronDown className="h-5 w-5" />
 </div>

 <label
  htmlFor={fieldId}
  className={`
  absolute left-4 transition-all duration-200 pointer-events-none
  ${(isFocused || hasValue)
  ? '-top-2.5 text-xs font-bold uppercase tracking-widest bg-card/90 backdrop-blur-sm px-1.5 rounded-md'
  : 'top-3.5 text-sm font-medium'
  }
  ${error
  ? 'text-destructive'
  : isFocused
  ? 'text-primary dark:text-primary'
  : 'text-muted-foreground'
  }
  ${Icon && !(isFocused || hasValue) ? 'ml-7' : ''}
  `}
 >
  {label}
 </label>
 </div>


 <AnimatePresence>
 {error && (
  <motion.p
  initial={{ opacity: 0, y: -5, height: 0 }}
  animate={{ opacity: 1, y: 0, height: 'auto' }}
  exit={{ opacity: 0, y: -5, height: 0 }}
  transition={{ duration: 0.2 }}
  id={errorId}
  className="text-destructive text-xs mt-1.5 ml-1 font-medium overflow-hidden"
  >
  {error}
  </motion.p>
 )}
 </AnimatePresence>
 </div>
 );
});

FloatingLabelSelect.displayName = 'FloatingLabelSelect';
