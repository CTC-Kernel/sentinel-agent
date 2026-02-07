/**
 * EBIOS Workshop Stepper Component
 * Visual stepper for navigating between EBIOS RM workshops (1-5)
 *
 * Implements ADR-E001: Workshop state machine
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Lock } from '../ui/Icons';
import { cn } from '../../utils/cn';
import { WORKSHOP_INFO, WORKSHOP_STATUS_LABELS } from '../../data/ebiosLibrary';
import type { EbiosWorkshops, EbiosWorkshopNumber } from '../../types/ebios';
import { canProceedToWorkshop } from '../../types/ebios';

interface EbiosWorkshopStepperProps {
 workshops: EbiosWorkshops;
 currentWorkshop: EbiosWorkshopNumber;
 onWorkshopSelect: (workshop: EbiosWorkshopNumber) => void;
 className?: string;
 compact?: boolean;
}

const WORKSHOP_NUMBERS: EbiosWorkshopNumber[] = [1, 2, 3, 4, 5];

export const EbiosWorkshopStepper: React.FC<EbiosWorkshopStepperProps> = ({
 workshops,
 currentWorkshop,
 onWorkshopSelect,
 className,
 compact = false,
}) => {
 const { i18n } = useTranslation();
 const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';



 const getLineColor = (workshopNum: EbiosWorkshopNumber) => {
 const status = workshops[workshopNum].status;
 if (status === 'validated' || status === 'completed') {
 return 'bg-success';
 }
 return 'bg-muted';
 };

 const isLocked = (workshopNum: EbiosWorkshopNumber) => {
 return !canProceedToWorkshop(workshops, workshopNum);
 };

 const handleClick = (workshopNum: EbiosWorkshopNumber) => {
 if (!isLocked(workshopNum)) {
 onWorkshopSelect(workshopNum);
 }
 };

 if (compact) {
 return (
 <div className={cn("flex items-center gap-3", className)}>
 {WORKSHOP_NUMBERS.map((num) => {
 const workshop = workshops[num];
 const locked = isLocked(num);
 const isActive = currentWorkshop === num;
 const info = WORKSHOP_INFO[num];

 return (
 <button
 key={num || 'unknown'}
 onClick={() => handleClick(num)}
 disabled={locked}
 className={cn(
 "relative flex items-center justify-center w-10 h-10 rounded-3xl transition-all duration-300",
 "border font-medium text-sm backdrop-blur-md",
 locked && "opacity-40 cursor-not-allowed border-transparent bg-muted text-muted-foreground",
 !locked && "cursor-pointer hover:scale-105 hover:bg-muted dark:hover:bg-muted/50",
 isActive && "ring-2 ring-offset-2 ring-primary ring-offset-background border-primary/60 bg-primary/10 text-primary",
 (workshop.status === 'validated' || workshop.status === 'completed') && !isActive && "bg-success/10 border-success/50 text-success-text",
 )}
 title={info.name[locale]}
 >
 {(workshop.status === 'validated' || workshop.status === 'completed') && !isActive ? (
 <CheckCircle className="w-5 h-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" />
 ) : locked ? (
 <Lock className="w-4 h-4" />
 ) : (
 num
 )}
 {/* Active Indicator Dot */}
 {isActive && (
 <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
 )}
 </button>
 );
 })}
 </div>
 );
 }

 return (
 <div className={cn("w-full px-4", className)}>
 {/* Desktop View */}
 <div className="hidden md:flex items-start justify-between relative">
 {/* Connecting Lines */}
 <div className="absolute top-6 left-0 right-0 flex px-10">
 {WORKSHOP_NUMBERS.slice(0, -1).map((num) => (
 <div
 key={`line-${num || 'unknown'}`}
 className={cn(
 "flex-1 h-0.5 mx-2 rounded-full transition-colors duration-500",
 getLineColor(num)
 )}
 />
 ))}
 </div>

 {/* Workshop Steps */}
 {WORKSHOP_NUMBERS.map((num) => {
 const workshop = workshops[num];
 const locked = isLocked(num);
 const isActive = currentWorkshop === num;
 const info = WORKSHOP_INFO[num];
 const isDone = workshop.status === 'validated' || workshop.status === 'completed';

 return (
 <div
 key={num || 'unknown'}
 className="flex flex-col items-center relative z-decorator flex-1 group"
 >
 <button
 onClick={() => handleClick(num)}
 disabled={locked}
 className={cn(
  "relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300",
  "shadow-lg backdrop-blur-xl border border-border/40",
  locked && "opacity-70 cursor-not-allowed bg-muted text-muted-foreground",
  !locked && "cursor-pointer hover:-translate-y-1 hover:shadow-xl",
  isActive && "scale-110 ring-4 ring-primary/60 shadow-primary bg-gradient-to-br from-primary to-primary text-white border-transparent",
  isDone && !isActive && "bg-gradient-to-br from-success to-success text-success-foreground border-transparent shadow-success",
  !isDone && !isActive && !locked && "bg-card text-muted-foreground hover:bg-muted/50"
 )}
 >
 {isDone ? (
  <CheckCircle className="w-6 h-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" />
 ) : locked ? (
  <Lock className="w-5 h-5" />
 ) : (
  <span className="text-lg font-bold">{num}</span>
 )}
 </button>

 {/* Workshop Info */}
 <div className={cn(
 "mt-4 text-center transition-all duration-300 px-2",
 isActive ? "opacity-70 transform-none" : "opacity-70 group-hover:opacity-70"
 )}>
 <p className={cn(
  "font-semibold text-sm leading-tight mb-1",
  isActive ? "text-primary" : "text-foreground"
 )}>
  {info.shortName[locale]}
 </p>
 <div className="flex justify-center">
  <span className={cn(
  "text-xs uppercase tracking-wider font-medium px-2 py-0.5 rounded-full",
  isDone ? "bg-success-bg text-success-text" :
  isActive ? "bg-primary text-primary-foreground" :
  "bg-muted text-muted-foreground"
  )}>
  {WORKSHOP_STATUS_LABELS[workshop.status][locale]}
  </span>
 </div>
 </div>
 </div>
 );
 })}
 </div>

 {/* Mobile View */}
 <div className="md:hidden space-y-3">
 {WORKSHOP_NUMBERS.map((num) => {
 const workshop = workshops[num];
 const locked = isLocked(num);
 const isActive = currentWorkshop === num;
 const info = WORKSHOP_INFO[num];
 const isDone = workshop.status === 'validated' || workshop.status === 'completed';

 return (
 <button
 key={num || 'unknown'}
 onClick={() => handleClick(num)}
 disabled={locked}
 className={cn(
 "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300",
 "border backdrop-blur-md",
 locked && "opacity-70 cursor-not-allowed bg-muted/50 border-transparent",
 !locked && "cursor-pointer active:scale-[0.98]",
 isActive
  ? "border-primary/40 bg-primary/15 dark:bg-primary shadow-lg shadow-primary"
  : "border-border/40 bg-card/40 hover:bg-card/60"
 )}
 >
 <div className={cn(
 "flex items-center justify-center w-10 h-10 rounded-3xl font-bold shadow-sm transition-colors",
 isActive ? "bg-primary text-primary-foreground shadow-primary" :
  isDone ? "bg-success text-success-foreground shadow-success" :
  locked ? "bg-muted text-muted-foreground" :
  "bg-card text-muted-foreground"
 )}>
 {isDone ? (
  <CheckCircle className="w-5 h-5" />
 ) : locked ? (
  <Lock className="w-4 h-4" />
 ) : (
  num
 )}
 </div>

 <div className="flex-1 text-left">
 <p className={cn(
  "font-semibold text-sm",
  isActive ? "text-primary dark:text-primary/70" : "text-foreground"
 )}>
  {info.name[locale]}
 </p>
 <div className="flex items-center gap-2 mt-1">
  <span className={cn(
  "w-1.5 h-1.5 rounded-full",
  isDone ? "bg-success" :
  isActive ? "bg-primary" :
  "bg-muted"
  )} />
  <p className="text-xs text-muted-foreground">
  {WORKSHOP_STATUS_LABELS[workshop.status][locale]}
  </p>
 </div>
 </div>

 {isActive && (
 <div className="w-1.5 h-8 rounded-full bg-primary" />
 )}
 </button>
 );
 })}
 </div>
 </div>
 );
};

export default EbiosWorkshopStepper;
