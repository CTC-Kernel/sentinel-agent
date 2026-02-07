import React, { useState } from 'react';
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, YAxis } from 'recharts';
import { Archive, ClipboardList } from '../../ui/Icons';
import { DatePicker } from '../../ui/DatePicker';
import { CustomSelect } from '../../ui/CustomSelect';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { LifecycleTimeline } from '../LifecycleTimeline';
import { Asset, MaintenanceRecord } from '../../../types';
import { useStore } from '../../../store';
import { sanitizeData } from '../../../utils/dataSanitizer';
import { EmptyChartState } from '../../ui/EmptyChartState';
import { SENTINEL_PALETTE, CHART_STYLES } from '../../../theme/chartTheme';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { useLocale } from '@/hooks/useLocale';

interface AssetInspectorLifecycleProps {
 selectedAsset: Asset;
 maintenanceRecords: MaintenanceRecord[];
 addMaintenance: (record: MaintenanceRecord) => Promise<boolean | string>;
 canEdit: boolean;
}

export const AssetInspectorLifecycle: React.FC<AssetInspectorLifecycleProps> = ({
 selectedAsset,
 maintenanceRecords,
 addMaintenance,
 canEdit
}) => {
 const { t, config } = useLocale();
 const { user } = useStore();
 const [isAddingMaintenance, setIsAddingMaintenance] = useState(false);
 const [newMaintenance, setNewMaintenance] = useState<Partial<MaintenanceRecord>>({
 date: new Date().toISOString().split('T')[0],
 type: 'Préventive',
 description: '',
 technician: ''
 });

 const handleAddMaintenance = async () => {
 if (!selectedAsset || !newMaintenance.description || !canEdit) return;
 setIsAddingMaintenance(true);

 const recordToSave: MaintenanceRecord = {
 ...(sanitizeData(newMaintenance) as MaintenanceRecord),
 performedBy: user ? {
 userId: user.uid,
 userName: user.displayName || user.email || 'System'
 } : undefined
 };

 const success = await addMaintenance(recordToSave);
 if (success) {
 setNewMaintenance({
 date: new Date().toISOString().split('T')[0],
 type: 'Préventive',
 description: '',
 technician: '',
 cost: undefined
 });
 }
 setIsAddingMaintenance(false);
 };

 const calculateDepreciation = (price: number, purchaseDate: string) => {
 if (!price || !purchaseDate) return price;
 const start = new Date(purchaseDate);
 const now = new Date();
 const ageInYears = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
 const value = price * (1 - (ageInYears / 5));
 return Math.max(0, Math.round(value));
 };

 const calculateTCO = () => {
 if (!selectedAsset?.purchasePrice) return 0;
 const maintenanceCost = maintenanceRecords.reduce((acc, m) => acc + (m.cost || 0), 0);
 return selectedAsset.purchasePrice + maintenanceCost;
 };

 const getDepreciationData = () => {
 if (!selectedAsset?.purchasePrice || !selectedAsset?.purchaseDate) return [];
 const data = [];
 const startYear = new Date(selectedAsset.purchaseDate).getFullYear();
 for (let i = 0; i <= 5; i++) {
 const year = startYear + i;
 const value = Math.max(0, selectedAsset.purchasePrice * (1 - (i / 5)));
 data.push({ year, value });
 }
 return data;
 };

 const totalMaintenanceCost = maintenanceRecords.reduce((acc, m) => acc + (m.cost || 0), 0);

 return (
 <div className="space-y-6 sm:space-y-8">
 <div className="glass-premium p-8 rounded-3xl border border-border/40 shadow-sm overflow-x-auto">
 <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-8">
  {t('assets.lifecycle.timelineTitle', 'Timeline du cycle de vie')}
 </h3>
 <div className="min-w-[320px] sm:min-w-[500px] md:min-w-[600px] px-4">
  <LifecycleTimeline
  status={selectedAsset?.lifecycleStatus || 'Neuf'}
  purchaseDate={selectedAsset?.purchaseDate}
  warrantyEnd={selectedAsset?.warrantyEnd}
  nextMaintenance={selectedAsset?.nextMaintenance}
  />
 </div>
 </div>

 <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
 <div className="flex items-center justify-between mb-6">
  <h3 className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300 flex items-center">
  <Archive className="h-4 w-4 mr-2" /> {t('assets.lifecycle.status', 'État de l\'Actif')}
  </h3>
  <div className="px-3 py-1 rounded-full bg-info-bg text-info-text text-xs font-bold">
  {selectedAsset?.lifecycleStatus || 'Neuf'}
  </div>
 </div>
 <div className="space-y-4">
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
  <div>
  <div className="block text-xs font-bold uppercase text-muted-foreground mb-2">
  {t('assets.lifecycle.purchaseDate', 'Date d\'achat')}
  </div>
  <div className="text-sm font-medium text-foreground">
  {selectedAsset?.purchaseDate ? new Date(selectedAsset.purchaseDate).toLocaleDateString() : '-'}
  </div>
  </div>
  <div>
  <div className="block text-xs font-bold uppercase text-muted-foreground mb-2">
  {t('assets.lifecycle.warranty.status', 'Fin de garantie')}
  </div>
  <div className="text-sm font-medium text-foreground">
  {selectedAsset?.warrantyEnd ? new Date(selectedAsset.warrantyEnd).toLocaleDateString() : '-'}
  </div>
  </div>
  <div>
  <div className="block text-xs font-bold uppercase text-muted-foreground mb-2">
  {t('assets.lifecycle.purchasePrice', 'Prix d\'achat (€)')}
  </div>
  <div className="text-sm font-medium text-foreground">
  {selectedAsset?.purchasePrice ? new Intl.NumberFormat(config.intlLocale, { style: 'currency', currency: 'EUR' }).format(selectedAsset.purchasePrice) : '-'}
  </div>
  </div>
  <div>
  <div className="block text-xs font-bold uppercase text-muted-foreground mb-2">
  {t('assets.lifecycle.maintenance', 'Coût Maintenance (€)')}
  </div>
  <div className="px-4 py-3 rounded-3xl bg-muted/50 dark:bg-white/5 text-sm font-bold">
  {new Intl.NumberFormat(config.intlLocale, { style: 'currency', currency: 'EUR' }).format(totalMaintenanceCost)}
  </div>
  </div>
  </div>

  {selectedAsset?.purchasePrice && (
  <div className="mt-6 pt-6 border-t border-dashed border-border/40">
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
   <p className="text-xs font-bold uppercase text-emerald-600 mb-1">
   {t('assets.lifecycle.currentValue', 'Valeur Actuelle (Net)')}
   </p>
   <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">
   {new Intl.NumberFormat(config.intlLocale, { style: 'currency', currency: 'EUR' }).format(calculateDepreciation(selectedAsset.purchasePrice, selectedAsset.purchaseDate || ''))}
   </p>
  </div>
  <div className="p-4 bg-blue-50/20 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
   <p className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400 mb-1">
   {t('common.tco', 'TCO (Coût Total)')}
   </p>
   <p className="text-xl font-black text-blue-700 dark:text-blue-400">
   {new Intl.NumberFormat(config.intlLocale, { style: 'currency', currency: 'EUR' }).format(calculateTCO())}
   </p>
  </div>
  </div>
  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
  {t('assets.lifecycle.depreciation', 'Courbe d\'amortissement (5 ans)')}
  </h4>
  <div className="h-40 w-full">
  <ResponsiveContainer width="100%" height="100%">
   {getDepreciationData().length === 0 ? (
   <EmptyChartState
   variant="line"
   message={t('common.emptyChart.noData', 'Données insuffisantes')}
   description={t('assets.lifecycle.emptyDepreciation', 'Prix ou date d\'achat manquants')}
   className="scale-75 origin-top"
   />
   ) : (
   <AreaChart data={getDepreciationData()}>
   <defs>
   <linearGradient id="colorValueLifecycle" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.3} />
    <stop offset="95%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0} />
   </linearGradient>
   </defs>
   <CartesianGrid {...CHART_STYLES.grid} />
   <XAxis dataKey="year" {...CHART_STYLES.axis} />
   <YAxis hide />
   <RechartsTooltip
   content={<ChartTooltip formatter={(val: number) => new Intl.NumberFormat(config.intlLocale, { style: 'currency', currency: 'EUR' }).format(val)} />}
   cursor={{ stroke: CHART_STYLES.cursor, strokeWidth: 1, strokeDasharray: '3 3' }}
   />
   <Area
   type="monotone"
   dataKey="value"
   stroke={SENTINEL_PALETTE.success}
   strokeWidth={2}
   fillOpacity={1}
   fill="url(#colorValueLifecycle)"
   />
   </AreaChart>
   )}
  </ResponsiveContainer>
  </div>
  </div>
  )}
 </div>
 </div>

 <div>
 <div className="flex items-center justify-between mb-4 px-1">
  <h3 className="text-sm font-bold text-foreground flex items-center">
  <ClipboardList className="h-4 w-4 mr-2 text-primary" /> {t('assets.lifecycle.history', 'Historique Maintenance')}
  </h3>
 </div>
 {canEdit && (
  <div className="glass-premium p-5 rounded-3xl border border-border/40 mb-6 shadow-sm">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
  <DatePicker
  label={t('common.date', 'Date')}
  value={newMaintenance.date}
  onChange={(date) => setNewMaintenance({ ...newMaintenance, date: date || '' })}
  />
  <CustomSelect
  label={t('assets.lifecycle.type', 'Type')}
  options={[
   { value: 'Préventive', label: t('assets.lifecycle.types.preventive', 'Préventive') },
   { value: 'Corrective', label: t('assets.lifecycle.types.corrective', 'Corrective') },
   { value: 'Mise à jour', label: t('assets.lifecycle.types.update', 'Mise à jour') },
   { value: 'Inspection', label: t('assets.lifecycle.types.inspection', 'Inspection') }
  ]}
  value={newMaintenance.type || ''}
  onChange={(val) => setNewMaintenance({ ...newMaintenance, type: val as MaintenanceRecord['type'] })}
  />
  </div>
  <div className="flex flex-col md:flex-row gap-4 mb-4">
  <div className="flex-1">
  <FloatingLabelInput
   label={t('assets.lifecycle.description', 'Description')}
   value={newMaintenance.description}
   onChange={e => setNewMaintenance({ ...newMaintenance, description: e.target.value })}
  />
  </div>
  <div className="w-full md:w-32">
  <FloatingLabelInput
   type="number"
   label={t('assets.lifecycle.cost', 'Coût (€)')}
   value={newMaintenance.cost || ''}
   onChange={e => setNewMaintenance({ ...newMaintenance, cost: parseFloat(e.target.value) })}
  />
  </div>
  </div>
  <button
  type="button"
  onClick={handleAddMaintenance}
  disabled={isAddingMaintenance}
  aria-label={t('assets.lifecycle.addMaintenance', 'Ajouter une intervention')}
  className="w-full py-3 bg-primary text-primary-foreground rounded-3xl text-sm font-bold shadow-lg hover:scale-[1.02] transition-transform disabled:bg-muted disabled:text-muted-foreground flex justify-center items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
  {isAddingMaintenance ? <span className="animate-spin mr-2">⏳</span> : null}
  {t('common.save', 'Enregistrer')}
  </button>
  </div>
 )}
 <div className="space-y-3">
  {maintenanceRecords.length === 0 ? (
  <p className="text-sm text-muted-foreground text-center italic py-8 bg-muted/30 rounded-3xl border border-dashed border-border/40">
  {t('assets.lifecycle.noRecords', 'Aucune intervention enregistrée.')}
  </p>
  ) : (
  maintenanceRecords.map(rec => (
  <div key={rec.id || 'unknown'} className="flex items-start p-4 glass-premium border border-border/40 rounded-3xl shadow-sm hover:shadow-md transition-all">
  <div className={`mt-1.5 w-2.5 h-2.5 rounded-full mr-4 flex-shrink-0 ${rec.type === 'Corrective' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`}></div>
  <div className="flex-1">
   <div className="flex items-center justify-between mb-1">
   <span className="text-xs font-bold text-foreground">
   {new Date(rec.date).toLocaleDateString()}
   </span>
   <span className="text-xs uppercase tracking-wider bg-muted dark:bg-white/10 px-2 py-0.5 rounded-3xl text-muted-foreground font-bold">
   {t(`assets.lifecycle.types.${rec.type === 'Préventive' ? 'preventive' : rec.type === 'Corrective' ? 'corrective' : rec.type === 'Mise à jour' ? 'update' : 'inspection'}`, rec.type)}
   </span>
   </div>
   <p className="text-sm text-muted-foreground leading-relaxed">{rec.description}</p>
   <div className="flex justify-between mt-2">
   <div className="flex flex-col gap-0.5">
   <span className="text-xs text-muted-foreground font-medium">Tech: {rec.technician}</span>
   {rec.performedBy && (
   <span className="text-xs text-muted-foreground italic">Performed by: {rec.performedBy.userName}</span>
   )}
   </div>
   {rec.cost && (
   <span className="text-xs font-bold text-muted-foreground">
   {new Intl.NumberFormat(config.intlLocale, { style: 'currency', currency: 'EUR' }).format(rec.cost)}
   </span>
   )}
   </div>
  </div>
  </div>
  ))
  )}
 </div>
 </div>
 </div>
 );
};
