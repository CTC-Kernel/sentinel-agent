
import React from 'react';
import { PageHeader } from '../ui/PageHeader';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDown, Link, FileSpreadsheet, Plus, Box } from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';

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
    return (
        <PageHeader
            title="Actifs & Inventaire"
            subtitle="Gérez votre cartographie des actifs et votre analyse d'impact."
            icon={<Box className="h-6 w-6 text-white" />}
            breadcrumbs={[
                { label: 'Tableau de bord', path: '/' },
                { label: 'Inventaire', path: '/assets' }
            ]}
            actions={(
                <>
                    <Menu as="div" className="relative inline-block text-left mr-3">
                        <Menu.Button className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-white/10 transition-all flex items-center">
                            Actions <ChevronDown className="ml-2 h-4 w-4" />
                        </Menu.Button>
                        <Transition
                            as={React.Fragment}
                            enter="transition ease-out duration-100"
                            enterFrom="transform opacity-0 scale-95"
                            enterTo="transform opacity-100 scale-100"
                            leave="transition ease-in duration-75"
                            leaveFrom="transform opacity-100 scale-100"
                            leaveTo="transform opacity-0 scale-95"
                        >
                            <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                <div className="p-1">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Outils
                                    </div>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                onClick={onGenerateLink}
                                                className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                    } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                            >
                                                <Link className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-brand-500'}`} />
                                                Lien Kiosque
                                            </button>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                onClick={onExportCSV}
                                                className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                    } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                            >
                                                <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />
                                                Export CSV
                                            </button>
                                        )}
                                    </Menu.Item>
                                </div>
                            </Menu.Items>
                        </Transition>
                    </Menu>

                    {canEdit && (
                        <CustomTooltip content="Créer un nouvel actif">
                            <button
                                onClick={onNewAsset}
                                className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                            >
                                <Plus className="h-4 w-4 mr-2" /> Nouvel Actif
                            </button>
                        </CustomTooltip>
                    )}
                </>
            )}
        />
    );
};
