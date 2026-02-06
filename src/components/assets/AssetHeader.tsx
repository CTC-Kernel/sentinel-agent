import React, { useRef } from 'react';
import { PageHeader } from '../ui/PageHeader';
import { Menu } from '@headlessui/react';
import { MenuPortal } from '../ui/MenuPortal';
import { ChevronDown, Link, FileSpreadsheet, Plus, Box } from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { Button } from '../ui/button';
import { useLocale } from '../../hooks/useLocale';

interface AssetHeaderProps {
 onGenerateLink: () => void;
 onExportCSV: () => void;
 onNewAsset: () => void;
 canEdit: boolean;
}

export const AssetHeader: React.FC<AssetHeaderProps> = ({
 onGenerateLink,
 onExportCSV,
 onNewAsset,
 canEdit
}) => {
 const { t } = useLocale();
 const actionsMenuButtonRef = useRef<HTMLButtonElement>(null);
 return (
 <PageHeader
 title={t('assets.header.title', { defaultValue: 'Actifs & Inventaire' })}
 subtitle={t('assets.header.subtitle', { defaultValue: "Gérez votre cartographie des actifs et votre analyse d'impact." })}
 icon={<Box className="h-6 w-6 text-white" />}
 breadcrumbs={[
 { label: t('assets.header.breadcrumbs.dashboard', { defaultValue: 'Tableau de bord' }), path: '/' },
 { label: t('assets.header.breadcrumbs.inventory', { defaultValue: 'Inventaire' }), path: '/assets' }
 ]}
 actions={(
 <>
  <Menu as="div" className="relative inline-block text-left mr-3">
  {({ open }) => (
  <>
  <Menu.Button ref={actionsMenuButtonRef} as={Button} variant="outline" className="text-foreground font-bold shadow-sm hover:bg-muted/50 dark:hover:bg-muted transition-all flex items-center">
  {t('assets.header.actions', { defaultValue: 'Actions' })} <ChevronDown className="ml-2 h-4 w-4" />
  </Menu.Button>
  <MenuPortal buttonRef={actionsMenuButtonRef} open={open}>
  <div className="p-1">
   <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
   {t('assets.header.tools', { defaultValue: 'Outils' })}
   </div>
   <Menu.Item>
   {({ active }) => (
   <button
   onClick={onGenerateLink}
   className={`${active ? 'bg-accent text-accent-foreground' : 'text-foreground'
    } group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors duration-150`}
   >
   <Link className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-primary'}`} />
   {t('assets.header.kioskLink', { defaultValue: 'Lien Kiosque' })}
   </button>
   )}
   </Menu.Item>
   <Menu.Item>
   {({ active }) => (
   <button
   onClick={onExportCSV}
   className={`${active ? 'bg-accent text-accent-foreground' : 'text-foreground'
    } group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors duration-150`}
   >
   <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-muted-foreground'}`} />
   Export CSV
   </button>
   )}
   </Menu.Item>
  </div>
  </MenuPortal>
  </>
  )}
  </Menu>

  {canEdit && (
  <CustomTooltip content={t('assets.header.createNewAsset', { defaultValue: 'Créer un nouvel actif' })}>
  <Button
  onClick={onNewAsset}
  className="flex items-center px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-3xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
  >
  <Plus className="h-4 w-4 mr-2" /> {t('assets.header.newAsset', { defaultValue: 'Nouvel Actif' })}
  </Button>
  </CustomTooltip>
  )}
 </>
 )}
 />
 );
};
