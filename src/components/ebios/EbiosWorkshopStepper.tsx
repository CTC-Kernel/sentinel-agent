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
      return 'bg-emerald-500';
    }
    return 'bg-slate-200 dark:bg-slate-700';
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
              key={num}
              onClick={() => handleClick(num)}
              disabled={locked}
              className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300",
                "border font-medium text-sm backdrop-blur-md",
                locked && "opacity-40 cursor-not-allowed border-transparent bg-slate-100 dark:bg-slate-800 text-slate-400",
                !locked && "cursor-pointer hover:scale-105 hover:bg-white/10 dark:hover:bg-white/5",
                isActive && "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-slate-900 border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400",
                (workshop.status === 'validated' || workshop.status === 'completed') && !isActive && "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
              )}
              title={info.name[locale]}
            >
              {(workshop.status === 'validated' || workshop.status === 'completed') && !isActive ? (
                <CheckCircle className="w-5 h-5" />
              ) : locked ? (
                <Lock className="w-4 h-4" />
              ) : (
                num
              )}
              {/* Active Indicator Dot */}
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
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
              key={`line-${num}`}
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
              key={num}
              className="flex flex-col items-center relative z-10 flex-1 group"
            >
              <button
                onClick={() => handleClick(num)}
                disabled={locked}
                className={cn(
                  "relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300",
                  "shadow-lg backdrop-blur-xl border border-white/20 dark:border-white/10",
                  locked && "opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400",
                  !locked && "cursor-pointer hover:-translate-y-1 hover:shadow-xl",
                  isActive && "scale-110 ring-4 ring-blue-500/20 shadow-blue-500/30 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-transparent",
                  isDone && !isActive && "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-transparent shadow-emerald-500/30",
                  !isDone && !isActive && !locked && "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                )}
              >
                {isDone ? (
                  <CheckCircle className="w-6 h-6" />
                ) : locked ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  <span className="text-lg font-bold">{num}</span>
                )}
              </button>

              {/* Workshop Info */}
              <div className={cn(
                "mt-4 text-center transition-all duration-300 px-2",
                isActive ? "opacity-100 transform-none" : "opacity-70 group-hover:opacity-100"
              )}>
                <p className={cn(
                  "font-semibold text-sm leading-tight mb-1",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"
                )}>
                  {info.shortName[locale]}
                </p>
                <div className="flex justify-center">
                  <span className={cn(
                    "text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full",
                    isDone ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
                      isActive ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
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
              key={num}
              onClick={() => handleClick(num)}
              disabled={locked}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300",
                "border backdrop-blur-md",
                locked && "opacity-50 cursor-not-allowed bg-slate-50/50 dark:bg-slate-900/50 border-transparent",
                !locked && "cursor-pointer active:scale-[0.98]",
                isActive
                  ? "border-blue-500/30 bg-blue-50/80 dark:bg-blue-900/20 shadow-lg shadow-blue-500/10"
                  : "border-white/10 bg-white/40 dark:bg-slate-800/40 hover:bg-white/60 dark:hover:bg-slate-800/60"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl font-bold shadow-sm transition-colors",
                isActive ? "bg-blue-500 text-white shadow-blue-500/30" :
                  isDone ? "bg-emerald-500 text-white shadow-emerald-500/30" :
                    locked ? "bg-slate-200 dark:bg-slate-800 text-slate-400" :
                      "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300"
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
                  isActive ? "text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"
                )}>
                  {info.name[locale]}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isDone ? "bg-emerald-500" :
                      isActive ? "bg-blue-500" :
                        "bg-slate-300 dark:bg-slate-600"
                  )} />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {WORKSHOP_STATUS_LABELS[workshop.status][locale]}
                  </p>
                </div>
              </div>

              {isActive && (
                <div className="w-1.5 h-8 rounded-full bg-blue-500/50" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EbiosWorkshopStepper;
