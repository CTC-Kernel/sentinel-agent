import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Download, ExternalLink } from './Icons';
import { CalendarService } from '../../services/calendarService';

export interface CalendarEventDetails {
 title: string;
 description?: string;
 start: Date;
 end: Date;
 location?: string;
}

interface AddToCalendarProps {
 event: CalendarEventDetails;
 className?: string;
}

export const AddToCalendar: React.FC<AddToCalendarProps> = ({ event, className }) => {
 const [isOpen, setIsOpen] = useState(false);
 const buttonRef = useRef<HTMLButtonElement>(null);
 const dropdownRef = useRef<HTMLDivElement>(null);
 const [coords, setCoords] = useState({ top: 0, left: 0 });

 const updatePosition = useCallback(() => {
 if (buttonRef.current) {
 const rect = buttonRef.current.getBoundingClientRect();
 const dropdownWidth = 192; // w-48 = 12rem = 192px

 let left = rect.right - dropdownWidth;
 if (left < 8) left = 8;
 if (left + dropdownWidth > window.innerWidth - 8) {
 left = window.innerWidth - dropdownWidth - 8;
 }

 setCoords({
 top: rect.bottom + 8,
 left,
 });
 }
 }, []);

 useEffect(() => {
 const handleClickOutside = (e: MouseEvent) => {
 const target = e.target as Node;
 if (
 buttonRef.current && !buttonRef.current.contains(target) &&
 dropdownRef.current && !dropdownRef.current.contains(target)
 ) {
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

 const dropdownContent = isOpen && (
 <div
 ref={dropdownRef}
 className="fixed w-48 bg-card rounded-3xl shadow-xl border border-border/40 dark:border-white/5 z-tooltip overflow-hidden animate-in fade-in zoom-in-95 duration-200"
 style={{
 top: coords.top,
 left: coords.left,
 }}
 >
 <div className="p-1">
 <a
  href={CalendarService.google(event)}
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  onClick={() => setIsOpen(false)}
 >
  <ExternalLink className="h-4 w-4 mr-2 text-primary" />
  Google Calendar
 </a>
 <a
  href={CalendarService.outlook(event)}
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  onClick={() => setIsOpen(false)}
 >
  <ExternalLink className="h-4 w-4 mr-2 text-info-400" />
  Outlook
 </a>
 <button
  onClick={() => {
  CalendarService.downloadIcs(event);
  setIsOpen(false);
  }}
  className="w-full flex items-center px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
 >
  <Download className="h-4 w-4 mr-2 text-success-500" />
  Fichier ICS
 </button>
 </div>
 </div>
 );

 return (
 <div className={`relative ${className}`}>
 <button
 ref={buttonRef}
 onClick={() => setIsOpen(!isOpen)}
 className="flex items-center px-3 py-2 bg-white dark:bg-white/5 border border-border/40 rounded-3xl text-sm font-medium text-foreground hover:bg-muted/50 dark:hover:bg-muted transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
 >
 <Calendar className="h-4 w-4 mr-2" data-testid="calendar-icon" />
 Ajouter au calendrier
 </button>

 {/* Use Portal to escape overflow:hidden containers */}
 {typeof document !== 'undefined' && createPortal(dropdownContent, document.body)}
 </div>
 );
};
