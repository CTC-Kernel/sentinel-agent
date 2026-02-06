/**
 * CMDB View
 *
 * Configuration Management Database view with premium dashboard
 * and visualization components.
 *
 * @module views/CMDB
 */

import React, { Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  LayoutDashboard,
  Network,
  Search,
  Settings,
  Database,
} from '@/components/ui/Icons';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '@/lib/utils';

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
  const [activeTab, setActiveTab] = useState('dashboard');

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
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {t('cmdb.title', { defaultValue: 'CMDB' })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('cmdb.subtitle', {
                defaultValue: 'Configuration Management Database',
              })}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass-panel p-1 rounded-xl">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
                'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground',
                'data-[state=active]:shadow-md'
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mt-6"
          >
            <TabsContent value="dashboard" className="mt-0">
              <Suspense fallback={<TabSkeleton />}>
                <CMDBPremiumDashboard />
              </Suspense>
            </TabsContent>

            <TabsContent value="discovery" className="mt-0">
              <Suspense fallback={<TabSkeleton />}>
                <DiscoveryDashboard />
              </Suspense>
            </TabsContent>

            <TabsContent value="topology" className="mt-0">
              <Suspense fallback={<TabSkeleton />}>
                <div className="glass-premium p-8 rounded-3xl text-center">
                  <Network className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">
                    {t('cmdb.topology.title', { defaultValue: 'Carte Topologique' })}
                  </h3>
                  <p className="text-muted-foreground">
                    {t('cmdb.topology.selectCI', {
                      defaultValue: 'Sélectionnez un CI pour visualiser ses dépendances',
                    })}
                  </p>
                </div>
              </Suspense>
            </TabsContent>

            <TabsContent value="validation" className="mt-0">
              <Suspense fallback={<TabSkeleton />}>
                <ValidationQueue />
              </Suspense>
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  );
};

export default CMDB;
