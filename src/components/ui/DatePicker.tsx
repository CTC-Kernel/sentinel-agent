import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon } from './Icons';
import { Calendar } from './Calendar';
import { useLocale } from '@/hooks/useLocale';

interface DatePickerProps {
 label: string;
 value?: string | Date;
 onChange: (date: string | undefined) => void;
 error?: string;
 className?: string;
 required?: boolean;
 placeholder?: string;
 disabled?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
 label,
 value,
 onChange,
 error,
 className = '',
 required = false,
 placeholder = "Sélectionner une date...",
 disabled = false
}) => {
 const { config } = useLocale();
 const [isOpen, setIsOpen] = useState(false);
 const containerRef = useRef<HTMLDivElement>(null);
 const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

 // Update position when open
 const updatePosition = React.useCallback(() => {
 if (containerRef.current) {
 const rect = containerRef.current.getBoundingClientRect();
 setCoords({
 top: rect.bottom + 8,
 left: rect.left,
 width: Math.max(rect.width, 300)
 });
 }
 }, []);

 // Close on click outside
 useEffect(() => {
 const handleClickOutside = (event: MouseEvent) => {
 if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
 // Also check if click is on the portal content
 const portalContent = document.querySelector('[data-datepicker-portal]');
 if (portalContent && portalContent.contains(event.target as Node)) {
  return;
 }
 setIsOpen(false);
 }
 };
 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 useEffect(() => {
 if (isOpen) {
 updatePosition();
 window.addEventListener('scroll', updatePosition, true);
 window.addEventListener('resize', updatePosition);
 return () => {
 window.removeEventListener('scroll', updatePosition, true);
 window.removeEventListener('resize', updatePosition);
 };
 }
 }, [isOpen, updatePosition]);

 const handleSelect = (date: Date | undefined) => {
 setIsOpen(false);
 if (date) {
 const year = date.getFullYear();
 const month = String(date.getMonth() + 1).padStart(2, '0');
 const day = String(date.getDate()).padStart(2, '0');
 onChange(`${year}-${month}-${day}`);
 } else {
 onChange(undefined);
 }
 };

 const displayValue = value ? new Date(value).toLocaleDateString(config.intlLocale, {
 year: 'numeric',
 month: 'long',
 day: 'numeric'
 }) : '';

 const selectedDate = value ? new Date(value) : undefined;

 const calendarContent = isOpen && !disabled && (
 <div
 data-datepicker-portal
 className="fixed z-tooltip p-2 bg-card rounded-2xl shadow-xl border border-border/40 animate-fade-in"
 style={{
 top: coords.top,
 left: coords.left,
 minWidth: coords.width,
 }}
 >
 <Calendar
 mode="single"
 selected={selectedDate}
 onSelect={handleSelect}
 initialFocus
 />
 {value && (
 <div className="p-2 border-t border-border/40 mt-2">
 <button
  onClick={(e) => { e.stopPropagation(); onChange(undefined); setIsOpen(false); }}
  className="w-full py-2 text-xs font-bold text-destructive hover:bg-destructive/5 rounded-3xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
 >
  Effacer la date
 </button>
 </div>
 )}
 </div>
 );

 return (
 <div className={`relative ${className} ${disabled ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}`} ref={containerRef}>
 <div
 onClick={() => !disabled && setIsOpen(!isOpen)}
 onKeyDown={(e) => {
  if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
  e.preventDefault();
  setIsOpen(!isOpen);
  }
 }}
 role="button"
 tabIndex={disabled ? -1 : 0}
 className={`
  relative flex items-center w-full rounded-2xl border transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
  ${error
  ? 'border-destructive bg-destructive/5'
  : isOpen
  ? 'border-primary ring-2 ring-primary/60 bg-card'
  : 'border-border/40 bg-muted/50 hover:border-border'
  }
 `}
 >
 <div className="w-full px-4 py-3.5 flex items-center justify-between">
  <span className={`font-medium ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
  {displayValue || (isOpen ? placeholder : (label ? '' : placeholder))}
  </span>
  <CalendarIcon className={`h-4 w-4 text-muted-foreground transition-colors ${isOpen ? 'text-primary' : ''}`} />
 </div>

 <label
  className={`
  absolute left-4 transition-all duration-200 pointer-events-none
  ${(isOpen || value)
  ? '-top-2.5 text-xs font-bold uppercase tracking-widest bg-card px-1 rounded text-primary'
  : 'top-3.5 text-sm font-medium text-muted-foreground'
  }
  ${error ? '!text-destructive' : ''}
  `}
 >
  {label} {required && <span className="text-destructive">*</span>}
 </label>
 </div>

 {/* Use Portal to escape overflow:hidden containers */}
 {typeof document !== 'undefined' && createPortal(calendarContent, document.body)}

 {error && (
 <p className="text-destructive text-xs mt-1.5 ml-1 font-medium animate-fade-in">
  {error}
 </p>
 )}
 </div>
 );
};
