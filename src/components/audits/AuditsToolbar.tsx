import { Menu } from '@headlessui/react';
import React, { useRef } from 'react';
import { MenuPortal } from '../ui/MenuPortal';
import {
 FileSpreadsheet, MoreVertical,
 Plus, BrainCircuit, Calendar as CalendarIcon, Upload, Trash2
} from '../ui/Icons';
import { PremiumPageControl } from '../ui/PremiumPageControl';
import { CustomSelect } from '../ui/CustomSelect';
import { Button } from '../ui/button';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { useStore } from '../../store';

interface AuditsToolbarProps {
 // Search & Filter
 searchQuery: string;
 onSearchChange: (query: string) => void;

 statusFilter: string;
 setStatusFilter: (value: string) => void;

 typeFilter: string;
 setTypeFilter: (value: string) => void;

 // View Mode
 activeTab: 'overview' | 'list' | 'calendar' | 'findings' | 'methods' | 'audit-trail';
 onTabChange: (tab: 'overview' | 'list' | 'calendar' | 'findings' | 'methods' | 'audit-trail') => void;

 // Data Actions
 selectedAudits: string[];
 handleBulkDelete: () => void;
 handleExportCalendar: () => void;
 handleExportCSV: () => void;

 // Commands
 setImportModalOpen: (open: boolean) => void;
 handleGeneratePlan: () => void;
 handleCreateAudit: () => void;

 // State
 canEdit: boolean;
 canDelete: boolean;
 loading: boolean;
}

export const AuditsToolbar: React.FC<AuditsToolbarProps> = ({
 searchQuery,
 onSearchChange,
 statusFilter,
 setStatusFilter,
 typeFilter,
 setTypeFilter,
 // Note: Audits usually uses Tabs for main views, but we can hook into ViewOptions if we want to change view style within tabs
 // For now, we'll just keep the filters and actions here.
 selectedAudits,
 handleBulkDelete,
 handleExportCalendar,
 handleExportCSV,
 setImportModalOpen,
 handleGeneratePlan,
 handleCreateAudit,
 canEdit,
 canDelete,
 loading
}) => {
 const { t } = useStore();
 const toolsMenuButtonRef = useRef<HTMLButtonElement>(null);

 return (
 <PremiumPageControl
 searchQuery={searchQuery}
 onSearchChange={onSearchChange}
 searchPlaceholder={t('audits.searchPlaceholder')}
 actions={
 <>
  <div className="hidden md:block w-40">
  <CustomSelect
  value={statusFilter}
  onChange={(val) => setStatusFilter(val as string)}
  options={[
  { value: '', label: t('audits.allStatuses') },
  { value: 'Planifié', label: t('audits.status.planned') },
  { value: 'En cours', label: t('audits.status.inProgress') },
  { value: 'Terminé', label: t('audits.status.finished') },
  { value: 'Validé', label: t('audits.status.validated') }
  ]}
  placeholder="Statut"
  />
  </div>
  <div className="hidden md:block w-40 mr-2">
  <CustomSelect
  value={typeFilter}
  onChange={(val) => setTypeFilter(val as string)}
  options={[
  { value: '', label: t('audits.allTypes') },
  { value: 'Interne', label: t('audits.type.internal') },
  { value: 'Externe', label: t('audits.type.external') },
  { value: 'Certification', label: t('audits.type.certification') }
  ]}
  placeholder="Type"
  />
  </div>

  <div className="h-8 w-px bg-muted dark:bg-white/10 mx-2 hidden md:block" />

  {/* Actions Menu */}
  <Menu as="div" className="relative inline-block text-left">
  {({ open }) => (
  <>
  <Menu.Button ref={toolsMenuButtonRef} as={Button} variant="outline" size="icon" className="h-10 w-10">
  <MoreVertical className="h-5 w-5" />
  </Menu.Button>
  <MenuPortal buttonRef={toolsMenuButtonRef} open={open}>
  <div className="p-1">
   <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('audits.exports')}</div>
   <Menu.Item>
   {({ active }) => (
   <button onClick={handleExportCalendar} className={`${active ? 'bg-accent text-accent-foreground' : 'text-foreground'} group flex w-full items-center rounded-lg px-2 py-2 text-sm hover:bg-muted`}>
   <CalendarIcon className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-muted-foreground'}`} /> {t('audits.exportCalendar')}
   </button>
   )}
   </Menu.Item>
   <Menu.Item>
   {({ active }) => (
   <button onClick={handleExportCSV} className={`${active ? 'bg-accent text-accent-foreground' : 'text-foreground'} group flex w-full items-center rounded-lg px-2 py-2 text-sm hover:bg-muted`}>
   <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-muted-foreground'}`} /> {t('audits.exportCSV')}
   </button>
   )}
   </Menu.Item>
  </div>
  {canEdit && (
   <div className="p-1 border-t border-border/40">
   <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('common.import.label')}</div>
   <Menu.Item>
   {({ active }) => (
   <button onClick={() => setImportModalOpen(true)} className={`${active ? 'bg-accent text-accent-foreground' : 'text-foreground'} group flex w-full items-center rounded-lg px-2 py-2 text-sm hover:bg-muted`}>
    <Upload className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-muted-foreground'}`} /> {t('common.importCsv')}
   </button>
   )}
   </Menu.Item>
   </div>
  )}
  </MenuPortal>
  </>
  )}
  </Menu>

  {selectedAudits.length > 0 && canDelete && (
  <Button
  onClick={handleBulkDelete}
  disabled={loading}
  variant="destructive"
  className="gap-2 ml-2"
  >
  <Trash2 className="w-4 h-4" />
  <span className="hidden sm:inline">{t('audits.deleteBulk', { count: selectedAudits.length })}</span>
  </Button>
  )}

  {canEdit && (
  <>
  <CustomTooltip content="Assistant IA">
  <Button
   onClick={handleGeneratePlan}
   disabled={loading}
   variant="outline"
   className="gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 font-medium ml-2"
  >
   <BrainCircuit className="w-4 h-4" />
   <span className="hidden sm:inline">{t('audits.aiAssistant')}</span>
  </Button>
  </CustomTooltip>

  <CustomTooltip content="Nouvel Audit">
  <Button
   onClick={handleCreateAudit}
   disabled={loading}
   className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all ml-2"
   data-tour="audits-new"
  >
   <Plus className="w-4 h-4" />
   <span className="hidden sm:inline">{t('audits.newAudit')}</span>
  </Button>
  </CustomTooltip>
  </>
  )}
 </>
 }
 />
 );
};
