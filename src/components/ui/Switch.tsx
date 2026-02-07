import React from 'react';
import { motion } from 'framer-motion';

interface SwitchProps {
 id?: string;
 ariaLabel?: string;
 checked: boolean;
 onChange: (checked: boolean) => void;
 disabled?: boolean;
 className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
 id,
 ariaLabel,
 checked,
 onChange,
 disabled = false,
 className = ''
}) => {
 return (
 <button
 id={id}
 type="button"
 role="switch"
 aria-checked={checked}
 aria-label={ariaLabel}
 disabled={disabled}
 onClick={() => !disabled && onChange(!checked)}
 className={`
 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
 ${checked ? 'bg-primary' : 'bg-muted'}
 ${disabled ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'cursor-pointer'}
 ${className}
 `}
 >
 <motion.span
 layout
 transition={{ type: "spring", stiffness: 700, damping: 30 }}
 className={`
  inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0
  ${checked ? 'translate-x-6' : 'translate-x-1'}
 `}
 />
 </button>
 );
};
