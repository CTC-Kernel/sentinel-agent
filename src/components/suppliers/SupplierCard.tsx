import React, { memo } from 'react';
import { Supplier, Criticality, UserProfile } from '../../types';
import { Building, Truck, ShieldAlert } from '../ui/Icons';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
import { useLocale } from '../../hooks/useLocale';
// Focus indicators: focus-visible:ring-2 applied globally via CSS

const getCriticalityColor = (c: Criticality) => {
 switch (c) {
 case Criticality.CRITICAL: return 'bg-error-bg text-error-text border-error-border';
 case Criticality.HIGH: return 'bg-warning-bg text-warning-text border-warning-border';
 case Criticality.MEDIUM: return 'bg-warning-bg/50 text-warning-text border-warning-border/50';
 default: return 'bg-success-bg text-success-text border-success-border';
 }
};

const getScoreColor = (score: number) => {
 if (score >= 80) return 'bg-success';
 if (score >= 50) return 'bg-warning';
 return 'bg-destructive';
};

interface SupplierCardProps {
 supplier: Supplier;
 onClick: (supplier: Supplier) => void;
 onDelete?: () => void;
 users?: UserProfile[]; // Optional to avoid breaking if not passed yet
}

export const SupplierCard = memo(({ supplier, onClick, users }: SupplierCardProps) => {
 const { t } = useLocale();
 const isExpired = supplier.contractEnd && new Date(supplier.contractEnd) < new Date();

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 onClick(supplier);
 }
 };

 return (
 <button
 onClick={() => onClick(supplier)}
 onKeyDown={handleKeyDown}
 aria-label={`${supplier.name} - ${supplier.category} - ${supplier.criticality}`}
 className="glass-premium p-4 sm:p-6 rounded-3xl shadow-sm card-hover cursor-pointer group flex flex-col border border-border/40 relative overflow-hidden h-full transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
 >
 <div className="absolute inset-0 bg-gradient-to-br from-white/30 dark:from-white/5 to-transparent pointer-events-none" />
 <div className="relative z-10 flex flex-col h-full">

 <div className="flex justify-between items-start mb-5">
  <div className="p-3 bg-muted rounded-2xl text-muted-foreground shadow-inner group-hover:bg-primary/10 dark:group-hover:bg-primary/10 group-hover:text-primary transition-colors">
  {supplier.category === 'Matériel' ? <Truck className="h-6 w-6" /> : <Building className="h-6 w-6" />}
  </div>
  <span className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase border shadow-sm ${getCriticalityColor(supplier.criticality || Criticality.MEDIUM)}`}>
  {supplier.criticality}
  </span>
 </div>

 <h3 className="text-lg font-bold text-foreground mb-1 leading-tight">{supplier.name}</h3>
 <div className="flex flex-wrap gap-2 mb-6">
  <span className="px-2.5 py-0.5 bg-muted rounded-lg text-xs font-medium text-muted-foreground">{supplier.category}</span>
  <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wide border ${supplier.status === 'Actif' ? 'bg-success-bg text-success-text border-success-border' : 'bg-muted text-muted-foreground border-border/40'}`}>{supplier.status}</span>
  {supplier.isICTProvider && (
  <span className="px-2.5 py-0.5 bg-primary/10 dark:bg-primary/20 text-primary rounded-lg text-xs font-bold border border-primary/30">DORA ICT</span>
  )}
 </div>

 <div className="mb-6 bg-muted/30 p-4 rounded-2xl border border-border/40 dark:border-white/5">
  <div className="flex justify-between text-xs mb-2">
  <span className="text-muted-foreground flex items-center font-bold uppercase tracking-wide"><ShieldAlert className="h-3.5 w-3.5 mr-1.5" /> {t('suppliers.card.security', { defaultValue: 'Sécurité' })}</span>
  <span className={`font-black ${getScoreColor(supplier.securityScore || 0).replace('bg-', 'text-')}`}>{supplier.securityScore || 0}/100</span>
  </div>
  <div className="w-full bg-muted rounded-full h-1.5 mb-4">
  <div className={`h-1.5 rounded-full ${getScoreColor(supplier.securityScore || 0)} transition-all duration-1000`} style={{ width: `${supplier.securityScore || 0}%` }}></div>
  </div>
  <div className="flex justify-between text-xs">
  <span className="text-muted-foreground">{t('suppliers.card.contract', { defaultValue: 'Contrat' })}</span>
  {supplier.contractEnd ? (
  <span className={`font-medium ${isExpired ? 'text-destructive' : 'text-foreground'}`}>{new Date(supplier.contractEnd).toLocaleDateString()}</span>
  ) : <span className="text-muted-foreground">-</span>}
  </div>
 </div>

 <div className="mt-auto pt-4 border-t border-border/40 dark:border-white/5 flex items-center justify-between text-xs text-muted-foreground">
  <div className="flex items-center">
  {supplier.contactName && (
  <div className="flex items-center gap-2">
  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
  <img
   src={(() => {
   const contactUser = users?.find(u =>
   (supplier.contactName && u.displayName === supplier.contactName) ||
   (supplier.contactEmail && u.email === supplier.contactEmail)
   );
   return getUserAvatarUrl(contactUser?.photoURL, contactUser?.role || 'user');
   })()}
   alt={`Avatar de ${supplier.contactName}`}
   className="w-5 h-5 rounded-full object-cover bg-muted"
   onError={(e) => {
   const target = e.target as HTMLImageElement;
   target.src = getUserAvatarUrl(null, 'user');
   }}
  />
  <span className="font-medium mr-1">{supplier.contactName}</span>
  </div>
  )}
  </div>
 </div>
 </div>
 </button>
 );
});
