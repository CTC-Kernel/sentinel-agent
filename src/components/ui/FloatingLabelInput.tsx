import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type FloatingLabelIconComponent = React.ElementType<{ className?: string }>;

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
 label: string;
 error?: string;
 helperText?: string;
 icon?: FloatingLabelIconComponent;
 textarea?: boolean;
 rows?: number;
 showCharCount?: boolean;
}

export const FloatingLabelInput = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, FloatingLabelInputProps>(({
 label,
 error,
 helperText,
 icon: Icon,
 className = '',
 value,
 textarea,
 rows = 3,
 showCharCount,
 ...props
}, ref) => {
 const autoId = React.useId();
 const fieldId = props.id || `floating-input-${autoId}`;
 const errorId = `${fieldId}-error`;
 const helperId = `${fieldId}-helper`;
 const describedBy = [props['aria-describedby'], error ? errorId : null, helperText ? helperId : null].filter(Boolean).join(' ') || undefined;
 const charCount = typeof value === 'string' ? value.length : 0;

 return (
 <div className={`relative ${className}`}>
 <div className={`
 relative flex items-center w-full rounded-2xl transition-all duration-400 var(--ease-apple) group
 ${error
  ? 'border border-destructive bg-destructive/5'
  : 'glass-input shadow-sm group-focus-within:border-primary/50 group-focus-within:shadow-glow'
 }
 `}>
 {Icon && (
  <div className={`pl-4 transition-colors duration-300 var(--ease-apple) ${error ? 'text-destructive' : 'text-muted-foreground group-focus-within:text-primary'} ${textarea ? 'self-start mt-3.5' : ''}`}>
  <Icon className="h-5 w-5" />
  </div>
 )}

 {textarea ? (
  <textarea
  ref={ref as React.Ref<HTMLTextAreaElement>}
  {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>}
  id={fieldId}
  value={value}
  aria-invalid={!!error}
  aria-describedby={describedBy}
  aria-required={props.required}
  rows={rows}
  className={`
  peer w-full px-4 py-3.5 bg-transparent outline-none focus-visible:ring-0 font-medium text-foreground
  placeholder-transparent rounded-2xl resize-none
  ${Icon ? 'pl-2' : ''}
  `}
  placeholder=" "
  />
 ) : (
  <input value={value}
  ref={ref as React.Ref<HTMLInputElement>}
  {...props}
  id={fieldId}
  aria-invalid={!!error}
  aria-describedby={describedBy}
  aria-required={props.required}
  className={`
  peer w-full px-4 py-3.5 bg-transparent outline-none focus-visible:ring-0 font-medium text-foreground
  placeholder-transparent rounded-2xl
  ${Icon ? 'pl-2' : ''}
  `}
  placeholder=" "
  />
 )}

 <label
  htmlFor={fieldId}
  className={`
  absolute left-4 transition-all duration-300 var(--ease-apple) pointer-events-none
  -top-2.5 text-xs font-bold uppercase tracking-widest bg-card/90 backdrop-blur-sm px-1.5 rounded-md
  peer-focus:text-primary
  ${error
  ? 'text-destructive'
  : 'text-muted-foreground peer-focus:text-primary'
  }
  ${Icon ? 'ml-7' : ''}
  `}
 >
  {label}
  {props.required && (
  <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
  )}
 </label>
 </div>


 <div className="flex items-start justify-between mt-1.5 ml-1 min-h-[1.25rem]">
 <div className="flex-1">
  <AnimatePresence>
  {error && (
   <motion.p
   initial={{ opacity: 0, y: -5, height: 0 }}
   animate={{ opacity: 1, y: 0, height: 'auto' }}
   exit={{ opacity: 0, y: -5, height: 0 }}
   transition={{ duration: 0.2 }}
   id={errorId}
   role="alert"
   className="text-destructive text-xs font-medium overflow-hidden"
   >
   {error}
   </motion.p>
  )}
  </AnimatePresence>
  {!error && helperText && (
  <p id={helperId} className="text-muted-foreground text-xs">
   {helperText}
  </p>
  )}
 </div>
 {showCharCount && props.maxLength && (
  <span className={`text-xs tabular-nums ml-2 flex-shrink-0 ${charCount >= props.maxLength ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
  {charCount}/{props.maxLength}
  </span>
 )}
 </div>
 </div>
 );
});

FloatingLabelInput.displayName = 'FloatingLabelInput';

export const FloatingLabelTextarea = (props: FloatingLabelInputProps) => <FloatingLabelInput textarea {...props} />;
