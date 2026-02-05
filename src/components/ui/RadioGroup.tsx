/**
 * RadioGroup Component
 * Simple radio group using Headless UI
 */

import * as React from 'react';
import { RadioGroup as HeadlessRadioGroup } from '@headlessui/react';
import { cn } from '@/lib/utils';

interface RadioGroupProps {
 value: string;
 onValueChange: (value: string) => void;
 children: React.ReactNode;
 className?: string;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
 ({ value, onValueChange, children, className }, ref) => {
 return (
 <HeadlessRadioGroup
 ref={ref}
 value={value}
 onChange={onValueChange}
 className={cn('space-y-2', className)}
 >
 {children}
 </HeadlessRadioGroup>
 );
 }
);
RadioGroup.displayName = 'RadioGroup';

interface RadioGroupItemProps {
 value: string;
 id?: string;
 className?: string;
 children?: React.ReactNode;
}

const RadioGroupItem = React.forwardRef<HTMLDivElement, RadioGroupItemProps>(
 ({ value, id, className, children }, ref) => {
 return (
 <HeadlessRadioGroup.Option
 ref={ref}
 value={value}
 id={id}
 className={({ checked, active }) =>
 cn(
 'relative flex cursor-pointer rounded-lg px-4 py-3 border transition-all focus:outline-none',
 checked
 ? 'border-primary bg-primary/10 dark:bg-primary'
 : 'border-border/40 hover:border-border/40 dark:hover:border-slate-600',
 active && 'ring-2 ring-primary',
 className
 )
 }
 >
 {({ checked }) => (
 <div className="flex items-center w-full">
 <div
 className={cn(
 'h-4 w-4 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0',
 checked
  ? 'border-primary bg-primary'
  : 'border-border/40'
 )}
 >
 {checked && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
 </div>
 {children}
 </div>
 )}
 </HeadlessRadioGroup.Option>
 );
 }
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
