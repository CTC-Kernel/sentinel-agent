/**
 * CMDB View
 *
 * Configuration Management Database view with premium dashboard
 * and visualization components.
 *
 * @module views/CMDB
 */

import React, { Suspense, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollableTabs } from '@/components/ui/ScrollableTabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { SEO } from '@/components/SEO';
import { MasterpieceBackground } from '@/components/ui/MasterpieceBackground';
import { staggerContainerVariants, slideUpVariants } from '@/components/ui/animationVariants';
import {
  LayoutDashboard,
  Network,
  Search,
  Settings,
  Database,
} from '@/components/ui/Icons';
import { useLocale } from '@/hooks/useLocale';
import { useStore } from '@/store';
import { useCMDBMutations } from '@/hooks/cmdb/useCMDBCIs';
import { useInspectorOpen, useCMDBActions } from '@/stores/cmdbStore';
import { CreateCIFormData } from '@/schemas/cmdbSchema';

// Lazy load heavy components
const CMDBPremiumDashboard = React.lazy(() =>
  import('@/components/cmdb/dashboard').then((m) => ({
    default: m.CMDBPremiumDashboard,
  }))
);

const DiscoveryDashboard = React.lazy(() =>
  import('@/components/cmdb/DiscoveryDashboard').then((m) => ({
    default: m.DiscoveryDashboard,
  }))
);

const ValidationQueue = React.lazy(() =>
  import('@/components/cmdb/ValidationQueue').then((m) => ({
    default: m.ValidationQueue,
  }))
);

const CIInspector = React.lazy(() =>
  import('@/components/cmdb/CIInspector').then((m) => ({
    default: m.CIInspector,
  }))
);

// Loading skeleton for tabs
const TabSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-2xl" />
      ))}
    </div>
    <Skeleton className="h-96 rounded-2xl" />
  </div>
);

export const CMDB: React.FC = () => {
  const { t } = useLocale();
  const { addToast } = useStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Inspector state
  const inspectorOpen = useInspectorOpen();
  const { closeInspector } = useCMDBActions();
  const { createCI, updateCI, deleteCI } = useCMDBMutations();

  // Handle CI creation
  const handleCreate = useCallback(async (data: CreateCIFormData): Promise<boolean | string> => {
    try {
      const ciId = await createCI.mutateAsync(data);
      closeInspector();
      return ciId;
    } catch {
      return false;
    }
  }, [createCI, closeInspector]);

  // Handle CI update
  const handleUpdate = useCallback(async (ciId: string, data: CreateCIFormData): Promise<boolean | string> => {
    try {
      await updateCI.mutateAsync({ ciId, data });
      closeInspector();
      return true;
    } catch {
      return false;
    }
  }, [updateCI, closeInspector]);

  // Handle CI deletion
  const handleDelete = useCallback(async (ciId: string, ciName: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir retirer "${ciName}" ?`)) {
      await deleteCI.mutateAsync(ciId);
      closeInspector();
      addToast(`CI "${ciName}" retiré avec succès`, 'success');
    }
  }, [deleteCI, closeInspector, addToast]);

  const tabs = [
    {
      id: 'dashboard',
      label: t('cmdb.tabs.dashboard', { defaultValue: 'Tableau de bord' }),
      icon: LayoutDashboard,
    },
    {
      id: 'discovery',
      label: t('cmdb.tabs.discovery', { defaultValue: 'Découverte' }),
      icon: Search,
    },
    {
      id: 'topology',
      label: t('cmdb.tabs.topology', { defaultValue: 'Topologie' }),
      icon: Network,
    },
    {
      id: 'validation',
      label: t('cmdb.tabs.validation', { defaultValue: 'Validation' }),
      icon: Settings,
    },
  ];

  return (
    <>
      <SEO
        title={t('cmdb.seoTitle', { defaultValue: 'CMDB - Configuration Management Database' })}
        description={t('cmdb.seoDescription', { defaultValue: 'Gestion complète de votre base de données de configuration' })}
        keywords={t('cmdb.seoKeywords', { defaultValue: 'CMDB, configuration, assets, ITIL' })}
      />
      
      <motion.div
        variants={staggerContainerVariants}
        initial="initial"
        animate="visible"
        className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
      >
        <MasterpieceBackground />
        {/* Page Header */}
        <PageHeader
          title={t('cmdb.title', { defaultValue: 'CMDB' })}
          subtitle={t('cmdb.subtitle', {
            defaultValue: 'Configuration Management Database',
          })}
          icon={
            <Database className="text-cyan-500 dark:text-cyan-400" />
          }
        />

        {/* Tabs */}
        <motion.div variants={slideUpVariants}>
          <ScrollableTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            ariaLabel={t('cmdb.tabsNavigation', { defaultValue: 'Navigation CMDB' })}
          />
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {activeTab === 'dashboard' && (
              <Suspense fallback={<TabSkeleton />}>
                <CMDBPremiumDashboard />
              </Suspense>
            )}

            {activeTab === 'discovery' && (
              <Suspense fallback={<TabSkeleton />}>
                <DiscoveryDashboard />
              </Suspense>
            )}

            {activeTab === 'topology' && (
              <Suspense fallback={<TabSkeleton />}>
                <motion.div
                  variants={slideUpVariants}
                  className="glass-premium p-8 rounded-3xl text-center"
                >
                  <Network className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">
                    {t('cmdb.topology.title', { defaultValue: 'Carte Topologique' })}
                  </h3>
                  <p className="text-muted-foreground">
                    {t('cmdb.topology.selectCI', {
                      defaultValue: 'Sélectionnez un CI pour visualiser ses dépendances',
                    })}
                  </p>
                </motion.div>
              </Suspense>
            )}

            {activeTab === 'validation' && (
              <Suspense fallback={<TabSkeleton />}>
                <ValidationQueue />
              </Suspense>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* CI Inspector Slide Panel */}
      <Suspense fallback={null}>
        <CIInspector
          isOpen={inspectorOpen}
          onClose={closeInspector}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </Suspense>
    </>
  );
};

export default CMDB;
