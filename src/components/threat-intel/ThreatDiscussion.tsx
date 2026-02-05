
import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from '../ui/Icons';
import { DiscussionPanel } from '../collaboration/DiscussionPanel';
import { useLocale } from '@/hooks/useLocale';

interface ThreatDiscussionProps {
 threatId: string;
 threatTitle: string;
 isOpen: boolean;
 onClose: () => void;
}

export const ThreatDiscussion: React.FC<ThreatDiscussionProps> = ({ threatId, threatTitle, isOpen, onClose }) => {
 const { t } = useLocale();
 return (
 <Transition.Root show={isOpen} as={React.Fragment}>
 <Dialog as="div" className="relative z-modal" onClose={onClose}>
 <Transition.Child
  as={React.Fragment}
  enter="ease-in-out duration-500"
  enterFrom="opacity-0"
  enterTo="opacity-100"
  leave="ease-in-out duration-500"
  leaveFrom="opacity-100"
  leaveTo="opacity-0"
 >
  <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] transition-opacity" />
 </Transition.Child>

 <div className="fixed inset-0 overflow-hidden">
  <div className="absolute inset-0 overflow-hidden">
  <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
  <Transition.Child
  as={React.Fragment}
  enter="transform transition ease-in-out duration-500 sm:duration-700"
  enterFrom="translate-x-full"
  enterTo="translate-x-0"
  leave="transform transition ease-in-out duration-500 sm:duration-700"
  leaveFrom="translate-x-0"
  leaveTo="translate-x-full"
  >
  <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
   <div className="flex h-full flex-col overflow-y-scroll bg-card shadow-xl border-l border-border/40">
   <div className="px-4 py-4 sm:px-6 bg-muted/50 border-b border-border/40">
   <div className="flex items-start justify-between">
   <div>
    <Dialog.Title className="text-base font-bold text-foreground">
    {t('threatIntel.discussion.title', { defaultValue: 'Discussion' })}
    </Dialog.Title>
    <p className="text-xs text-muted-foreground truncate max-w-[280px] mt-1">{threatTitle}</p>
   </div>
   <div className="ml-3 flex h-7 items-center">
    <button
    type="button"
    className="relative rounded-md text-muted-foreground hover:text-muted-foreground focus:outline-none focus:ring-2 focus-visible:ring-primary focus:ring-offset-2"
    onClick={onClose}
    >
    <span className="absolute -inset-2.5" />
    <span className="sr-only">{t('threatIntel.discussion.closePanel', { defaultValue: 'Fermer panel' })}</span>
    <X className="h-6 w-6" aria-hidden="true" />
    </button>
   </div>
   </div>
   </div>
   <div className="relative flex-1 px-4 py-6 sm:px-6">
   <DiscussionPanel 
   collectionName="threats" 
   documentId={threatId}
   title={threatTitle}
   showHeader={false}
   enableSearch={true}
   enableFilters={true}
   enableExport={true}
   enableNotifications={true}
   compact={true}
   />
   </div>
   </div>
  </Dialog.Panel>
  </Transition.Child>
  </div>
  </div>
 </div>
 </Dialog>
 </Transition.Root>
 );
};

// Typed helper since generic useState was used in prompt

// Headless UI handles FocusTrap and keyboard navigation
