import { History } from '../../ui/Icons';
import { ResourceHistory } from '../../shared/ResourceHistory';
import { Asset } from '../../../types';
import { useLocale } from '../../../hooks/useLocale';

interface AssetInspectorHistoryProps {
 selectedAsset: Asset;
}

export const AssetInspectorHistory: React.FC<AssetInspectorHistoryProps> = ({
 selectedAsset
}) => {
 const { t } = useLocale();
 return (
 <div className="space-y-6 sm:space-y-8">
 <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
 <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center">
  <History className="h-4 w-4 mr-2" /> {t('common.inspector.history.dicpHistory')}
 </h3>
 {!selectedAsset.history || selectedAsset.history.length === 0 ? (
  <p className="text-sm text-muted-foreground italic">{t('common.inspector.history.noChanges')}</p>
 ) : (
  <div className="space-y-4">
  {selectedAsset.history.slice().reverse().map((h, i) => (
  <div key={`rec-${i || 'unknown'}`} className="p-4 bg-muted/50 dark:bg-white/5 rounded-2xl border border-border/40">
  <div className="flex justify-between items-center mb-2">
   <span className="text-xs font-bold text-muted-foreground">{new Date(h.date).toLocaleString('fr-FR')}</span>
   <span className="text-xs font-medium text-muted-foreground">{t('common.inspector.history.by')} {h.userName}</span>
  </div>
  <div className="grid grid-cols-3 gap-2 text-xs">
   <div className="flex flex-col items-center p-2 rounded-3xl bg-white dark:bg-black/20">
   <span className="text-xs text-muted-foreground uppercase">{t('common.inspector.history.confidentiality')}</span>
   <div className="flex items-center gap-1 mt-1">
   <span className="line-through opacity-60">{h.previousConfidentiality}</span>
   <span>→</span>
   <span className="font-bold">{h.newConfidentiality}</span>
   </div>
   </div>
   <div className="flex flex-col items-center p-2 rounded-3xl bg-white dark:bg-black/20">
   <span className="text-xs text-muted-foreground uppercase">{t('common.inspector.history.integrity')}</span>
   <div className="flex items-center gap-1 mt-1">
   <span className="line-through opacity-60">{h.previousIntegrity}</span>
   <span>→</span>
   <span className="font-bold">{h.newIntegrity}</span>
   </div>
   </div>
   <div className="flex flex-col items-center p-2 rounded-3xl bg-white dark:bg-black/20">
   <span className="text-xs text-muted-foreground uppercase">{t('common.inspector.history.availability')}</span>
   <div className="flex items-center gap-1 mt-1">
   <span className="line-through opacity-60">{h.previousAvailability}</span>
   <span>→</span>
   <span className="font-bold">{h.newAvailability}</span>
   </div>
   </div>
  </div>
  </div>
  ))}
  </div>
 )}
 </div>

 <div className="px-1">
 <ResourceHistory resourceId={selectedAsset.id} resourceType="Asset" />
 </div>
 </div>
 );
};
