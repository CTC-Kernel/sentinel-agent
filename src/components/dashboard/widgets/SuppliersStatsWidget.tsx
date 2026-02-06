import React, { useMemo } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Supplier, Criticality } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { Truck, ShieldAlert, CheckCircle2, Users } from '../../ui/Icons';
import { PremiumCard } from '../../ui/PremiumCard';
import { EmptyState } from '../../ui/EmptyState';

interface SuppliersStatsWidgetProps {
 navigate?: (path: string) => void;
}

export const SuppliersStatsWidget: React.FC<SuppliersStatsWidgetProps> = ({ navigate }) => {
 const { user } = useStore();

 const { data: suppliers, loading } = useFirestoreCollection<Supplier>(
 'suppliers',
 [where('organizationId', '==', user?.organizationId || '')],
 { realtime: true, enabled: !!user?.organizationId }
 );

 const stats = useMemo(() => {
 const total = suppliers.length;
 const critical = suppliers.filter(s => s.criticality === Criticality.CRITICAL).length;
 // Assume 'Actif' or 'Active' status for valid suppliers
 const active = suppliers.filter(s => s.status === 'Actif' || (s.status as string) === 'Active').length;

 return { total, critical, active };
 }, [suppliers]);

 if (loading) {
 return (
 <div className="h-full flex items-center justify-center glass-premium rounded-2xl border border-border/40 p-4">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
 </div>
 );
 }

 // Empty state when no suppliers
 if (stats.total === 0) {
 return (
 <PremiumCard glass
 className="h-full flex flex-col p-5 overflow-hidden"
 hover={true}
 gradientOverlay={true}
 >
 <div className="flex items-center justify-between pb-4 border-b border-border/40 dark:border-white/5 relative z-10">
  <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
  <div className="p-1.5 rounded-lg bg-info-bg dark:bg-info/10 text-info-text dark:text-info">
  <Truck className="w-4 h-4" />
  </div>
  Fournisseurs
  </h3>
 </div>

 <div className="flex-1 flex items-center justify-center relative z-10">
  <EmptyState
  icon={Users}
  title="Aucun fournisseur"
  description="Ajoutez vos fournisseurs et tiers pour gérer les risques associés."
  actionLabel="Ajouter un fournisseur"
  onAction={() => navigate && navigate('/suppliers')}
  semantic="info"
  compact
  />
 </div>
 </PremiumCard>
 );
 }

 return (
 <PremiumCard glass
 className="h-full flex flex-col p-5 overflow-hidden group hover:shadow-apple"
 hover={true}
 gradientOverlay={true}
 >
 <div className="flex items-center justify-between pb-4 border-b border-border/40 dark:border-white/5 relative z-10">
 <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
  <div className="p-1.5 rounded-lg bg-info-bg dark:bg-info/10 text-info-text dark:text-info">
  <Truck className="w-4 h-4" />
  </div>
  Fournisseurs
 </h3>
 <button
  onClick={() => navigate && navigate('/suppliers')}
  className="text-xs font-bold px-2 py-1 rounded-lg bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-white/50 dark:border-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
 >
  Voir tout
 </button>
 </div>

 <div className="flex-1 flex flex-col justify-center relative z-10 pt-4">
 <div className="flex items-end gap-3 mb-6">
  <span className="text-4xl font-black text-foreground tracking-tight">{stats.total}</span>
  <span className="text-sm font-medium text-muted-foreground mb-1.5 pb-0.5">tiers gérés</span>
 </div>

 <div className="grid grid-cols-2 gap-3">
  <div className="p-3 rounded-3xl bg-error-bg/50 dark:bg-error/5 border border-error-border dark:border-error/10 flex flex-col">
  <div className="flex items-center gap-1.5 text-error-text dark:text-error mb-1">
  <ShieldAlert className="w-3.5 h-3.5" />
  <span className="text-[11px] uppercase font-bold tracking-wider">Critiques</span>
  </div>
  <span className="text-xl font-bold text-error-text dark:text-error">{stats.critical}</span>
  </div>

  <div className="p-3 rounded-3xl bg-success-bg/50 dark:bg-success/5 border border-success-border dark:border-success/10 flex flex-col">
  <div className="flex items-center gap-1.5 text-success-text dark:text-success mb-1">
  <CheckCircle2 className="w-3.5 h-3.5" />
  <span className="text-[11px] uppercase font-bold tracking-wider">Actifs</span>
  </div>
  <span className="text-xl font-bold text-success-text dark:text-success">{stats.active}</span>
  </div>
 </div>
 </div>
 </PremiumCard>
 );
};
