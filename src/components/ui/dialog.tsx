import React from 'react';
import { Dialog as HeadlessDialog, DialogPanel as HeadlessDialogPanel, DialogTitle as HeadlessDialogTitle } from '@headlessui/react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string; // z-index customization
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children, className = 'relative z-[150]' }) => {
  return (
    <HeadlessDialog open={open} onClose={() => onOpenChange(false)} className={className}>
      {children}
    </HeadlessDialog>
  );
};

export const DialogContent: React.FC<DialogContentProps> = ({ children, className = '' }) => {
  return (
    <div className="fixed inset-0 bg-black/30" aria-hidden="true">
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <HeadlessDialogPanel className={`glass-panel rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto ${className}`}>
          {children}
        </HeadlessDialogPanel>
      </div>
    </div>
  );
};

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children, className = '' }) => {
  return (
    <div className={`mb-6 ${className}`}>
      {children}
    </div>
  );
};

export const DialogTitle: React.FC<DialogTitleProps> = ({ children, className = '' }) => {
  return (
    <HeadlessDialogTitle className={`text-lg font-bold text-slate-900 dark:text-white ${className}`}>
      {children}
    </HeadlessDialogTitle>
  );
};

export const DialogDescription: React.FC<DialogTitleProps> = ({ children, className = '' }) => {
  return (
    <div className={`mt-2 text-sm text-slate-500 dark:text-slate-400 ${className}`}>
      {children}
    </div>
  );
};

export const DialogFooter: React.FC<DialogHeaderProps> = ({ children, className = '' }) => {
  return (
    <div className={`mt-6 flex justify-end space-x-2 ${className}`}>
      {children}
    </div>
  );
};
