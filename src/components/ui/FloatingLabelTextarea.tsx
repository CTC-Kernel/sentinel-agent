import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface FloatingLabelTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
 label: string;
 error?: string;
}

export const FloatingLabelTextarea = React.forwardRef<HTMLTextAreaElement, FloatingLabelTextareaProps>(({
 label,
 error,
 className = '',
 value,
 onFocus,
 onBlur,
 onChange,
 ...props
}, ref) => {
 const [isFocused, setIsFocused] = useState(false);
 const [hasContent, setHasContent] = useState(false);
 const hasValue = (value !== undefined && value !== '') || hasContent;

 const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
 setIsFocused(true);
 onFocus?.(e);
 };

 const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
 setIsFocused(false);
 onBlur?.(e);
 };

 const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
 setHasContent(e.target.value !== '');
 onChange?.(e);
 };

 const autoId = React.useId();
 const fieldId = props.id || `floating-textarea-${autoId}`;
 const errorId = `${fieldId}-error`;
 const describedBy = [props['aria-describedby'], error ? errorId : null].filter(Boolean).join(' ') || undefined;

 return (
 <div className={`relative ${className}`}>
 <div className={`
 relative w-full rounded-2xl border transition-all duration-200 backdrop-blur-sm
 ${error
  ? 'border-destructive/60 bg-destructive/5'
  : isFocused
  ? 'border-primary ring-2 ring-primary/60 bg-card/95 shadow-glow'
  : 'border-border/40 bg-card/50 hover:border-primary/40'
 }
 `}>
 <textarea
  ref={ref}
  {...props}
  id={fieldId}
  value={value}
  onFocus={handleFocus}
  onBlur={handleBlur}
  onChange={handleChange}
  aria-invalid={!!error}
  aria-describedby={describedBy}
  className={`
  w-full px-4 py-3.5 bg-transparent outline-none font-medium text-foreground
  placeholder-transparent rounded-2xl resize-none
  `}
  placeholder={label}
 />

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

FloatingLabelTextarea.displayName = 'FloatingLabelTextarea';
