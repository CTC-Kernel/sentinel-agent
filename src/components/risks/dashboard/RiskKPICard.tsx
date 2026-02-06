import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from '../../ui/Icons';

interface RiskKPICardProps {
 title: string;
 value: string | number;
 subtext: string;
 icon: LucideIcon;
 color: 'red' | 'orange' | 'blue' | 'purple' | 'emerald';
 chip?: {
 label: string;
 color?: 'emerald' | 'red';
 };
 delay?: number;
}

export const RiskKPICard: React.FC<RiskKPICardProps> = ({

 value,
 subtext,
 icon: Icon,
 color,
 chip,
 delay = 0
}) => {
 const colorStyles = {
 red: 'bg-error-bg dark:bg-error-bg/20 text-error-text dark:text-error-text',
 orange: 'bg-warning-bg dark:bg-warning-bg/20 text-warning-text dark:text-warning-text',
 blue: 'bg-info-bg dark:bg-info-bg/20 text-info-text dark:text-info-text',
 purple: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400',
 emerald: 'bg-success-bg dark:bg-success-bg/20 text-success-text dark:text-success-text'
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay }}
 className="p-6 rounded-2xl bg-card border border-border/40 shadow-sm hover:shadow-md transition-all"
 >
 <div className="flex justify-between items-start mb-4">
 <div className={`p-3 rounded-3xl ${colorStyles[color]}`}>
  <Icon className="w-6 h-6" />
 </div>
 {chip && (
  <span className={`text-xs font-bold px-2 py-1 rounded-full ${chip.color === 'emerald' ? 'text-success-text bg-success-bg dark:bg-success-bg/20' : ''
  }`}>
  {chip.label}
  </span>
 )}
 </div>
 <div className="text-3xl font-bold text-foreground mb-1">{value}</div>
 <div className="text-sm text-muted-foreground font-medium">{subtext}</div>
 </motion.div>
 );
};
