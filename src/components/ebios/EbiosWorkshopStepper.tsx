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
import type { EbiosWorkshops, EbiosWorkshopNumber, EbiosWorkshopStatus } from '../../types/ebios';
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

  const getStatusColor = (status: EbiosWorkshopStatus) => {
    switch (status) {
      case 'validated':
        return 'bg-purple-500 border-purple-500';
      case 'completed':
        return 'bg-green-500 border-green-500';
      case 'in_progress':
        return 'bg-blue-500 border-blue-500';
      default:
        return 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600';
    }
  };

  const getLineColor = (workshopNum: EbiosWorkshopNumber) => {
    const status = workshops[workshopNum].status;
    if (status === 'validated' || status === 'completed') {
      return 'bg-green-500';
    }
    return 'bg-gray-200 dark:bg-gray-700';
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
      <div className={cn("flex items-center gap-2", className)}>
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
                "border-2 font-semibold text-sm",
                locked && "opacity-50 cursor-not-allowed",
                !locked && "cursor-pointer hover:scale-105",
                isActive && "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-900",
                workshop.status === 'validated' && "bg-purple-500 border-purple-500 text-white",
                workshop.status === 'completed' && "bg-green-500 border-green-500 text-white",
                workshop.status === 'in_progress' && "bg-blue-500 border-blue-500 text-white",
                workshop.status === 'not_started' && "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
              )}
              title={info.name[locale]}
            >
              {workshop.status === 'validated' || workshop.status === 'completed' ? (
                <CheckCircle className="w-5 h-5" />
              ) : locked ? (
                <Lock className="w-4 h-4" />
              ) : (
                num
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop View */}
      <div className="hidden md:flex items-start justify-between relative">
        {/* Connecting Lines */}
        <div className="absolute top-6 left-0 right-0 flex">
          {WORKSHOP_NUMBERS.slice(0, -1).map((num) => (
            <div
              key={`line-${num}`}
              className={cn(
                "flex-1 h-1 mx-8 rounded-full transition-colors duration-500",
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

          return (
            <div
              key={num}
              className="flex flex-col items-center relative z-10 flex-1"
            >
              <button
                onClick={() => handleClick(num)}
                disabled={locked}
                className={cn(
                  "relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300",
                  "border-2 font-bold text-lg shadow-lg",
                  locked && "opacity-50 cursor-not-allowed",
                  !locked && "cursor-pointer hover:scale-110 hover:shadow-xl",
                  isActive && "ring-4 ring-offset-2 ring-blue-500/30 dark:ring-offset-gray-900 scale-110",
                  getStatusColor(workshop.status),
                  (workshop.status === 'validated' || workshop.status === 'completed' || workshop.status === 'in_progress')
                    ? "text-white"
                    : "text-gray-500 dark:text-gray-400"
                )}
              >
                {workshop.status === 'validated' ? (
                  <CheckCircle className="w-6 h-6" />
                ) : workshop.status === 'completed' ? (
                  <CheckCircle className="w-6 h-6" />
                ) : locked ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  num
                )}
              </button>

              {/* Workshop Info */}
              <div className="mt-3 text-center max-w-[140px]">
                <p className={cn(
                  "font-semibold text-sm leading-tight",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                )}>
                  {info.shortName[locale]}
                </p>
                <p className={cn(
                  "text-xs mt-1",
                  WORKSHOP_STATUS_LABELS[workshop.status].color === 'gray'
                    ? "text-gray-400 dark:text-gray-500"
                    : `text-${WORKSHOP_STATUS_LABELS[workshop.status].color}-500`
                )}>
                  {WORKSHOP_STATUS_LABELS[workshop.status][locale]}
                </p>
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

          return (
            <button
              key={num}
              onClick={() => handleClick(num)}
              disabled={locked}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300",
                "border-2 backdrop-blur-sm",
                locked && "opacity-50 cursor-not-allowed",
                !locked && "cursor-pointer active:scale-[0.98]",
                isActive
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl font-bold",
                getStatusColor(workshop.status),
                (workshop.status === 'validated' || workshop.status === 'completed' || workshop.status === 'in_progress')
                  ? "text-white"
                  : "text-gray-500 dark:text-gray-400"
              )}>
                {workshop.status === 'validated' || workshop.status === 'completed' ? (
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
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                )}>
                  {info.name[locale]}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {WORKSHOP_STATUS_LABELS[workshop.status][locale]}
                </p>
              </div>

              {isActive && (
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EbiosWorkshopStepper;
