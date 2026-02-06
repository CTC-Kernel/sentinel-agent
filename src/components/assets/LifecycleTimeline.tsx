import React from 'react';
import { ShoppingCart, Wrench, ShieldCheck, Trash2, Archive, CheckCircle2 } from '../ui/Icons';
import { useLocale } from '../../hooks/useLocale';

interface LifecycleTimelineProps {
 status: string;
 purchaseDate?: string;
 warrantyEnd?: string;
 nextMaintenance?: string;
}

export const LifecycleTimeline: React.FC<LifecycleTimelineProps> = ({
 status,
 purchaseDate,
 warrantyEnd,
 nextMaintenance
}) => {
 const { t } = useLocale();
 const steps = [
 { id: 'Neuf', label: t('assets.lifecycle.steps.purchase', { defaultValue: 'Achat' }), icon: ShoppingCart, date: purchaseDate },
 { id: 'En service', label: t('assets.lifecycle.steps.inService', { defaultValue: 'En Service' }), icon: CheckCircle2, date: null },
 { id: 'Maintenance', label: t('assets.lifecycle.steps.maintenance', { defaultValue: 'Maintenance' }), icon: Wrench, date: nextMaintenance ? `${t('assets.lifecycle.steps.next', { defaultValue: 'Prochaine' })}: ${new Date(nextMaintenance).toLocaleDateString()}` : null },
 { id: 'Garantie', label: t('assets.lifecycle.steps.warrantyEnd', { defaultValue: 'Fin Garantie' }), icon: ShieldCheck, date: warrantyEnd },
 { id: 'Fin de vie', label: t('assets.lifecycle.steps.endOfLife', { defaultValue: 'Fin de Vie' }), icon: Archive, date: null },
 { id: 'Rebut', label: t('assets.lifecycle.steps.disposal', { defaultValue: 'Rebut' }), icon: Trash2, date: null }
 ];

 const getCurrentStepIndex = () => {
 switch (status) {
 case 'Neuf': return 0;
 case 'En service': return 1;
 case 'En réparation': return 2;
 case 'Fin de vie': return 4;
 case 'Rebut': return 5;
 default: return 1;
 }
 };

 const currentStep = getCurrentStepIndex();

 return (
 <div className="relative">
 <div className="absolute top-1/2 left-0 w-full h-1 bg-muted -translate-y-1/2 rounded-full" />
 <div
 className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 rounded-full transition-all duration-500"
 style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
 />

 <div className="relative flex justify-between">
 {steps.map((step, index) => {
  const Icon = step.icon;
  const isCompleted = index <= currentStep;
  const isCurrent = index === currentStep;

  return (
  <div key={step.id || 'unknown'} className="flex flex-col items-center group">
  <div className={`
  w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 z-10
  ${isCompleted
   ? 'bg-primary border-primary/20 dark:border-primary text-white'
   : 'bg-card border-border/40 text-muted-foreground'
  }
  ${isCurrent ? 'scale-110 shadow-lg shadow-primary/30' : ''}
  `}>
  <Icon className="h-4 w-4" />
  </div>
  <div className="mt-3 text-center">
  <p className={`text-xs font-bold uppercase tracking-wider ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
   {step.label}
  </p>
  {step.date && (
   <p className="text-xs font-medium text-muted-foreground mt-0.5">
   {step.date.includes('Prochaine') ? step.date : new Date(step.date).toLocaleDateString()}
   </p>
  )}
  </div>
  </div>
  );
 })}
 </div>
 </div>
 );
};
