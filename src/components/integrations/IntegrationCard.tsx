import React from 'react';
import { IntegrationProvider } from '../../services/integrationService';
import { CheckCircle2, Plug, Loader2 } from '../ui/Icons';

interface IntegrationCardProps {
 provider: IntegrationProvider;
 onConnect: (provider: IntegrationProvider) => void;
 onDisconnect: (provider: IntegrationProvider) => void;
 isConnecting: boolean;
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({ provider, onConnect, onDisconnect, isConnecting }) => {
 const isConnected = provider.status === 'connected';

 return (
 <div className={`group relative p-6 rounded-3xl border transition-all duration-300 ${isConnected
 ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-500/30 shadow-lg shadow-emerald-500/5'
 : 'glass-premium hover:shadow-xl hover:border-primary/40 dark:hover:border-white/20 border-border/40'
 }`}>
 {/* Inner Glow Effect */}
 <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/50 to-transparent dark:to-transparent opacity-0 group-hover:opacity-70 transition-opacity pointer-events-none" />

 <div className="flex items-start justify-between mb-4 relative z-10">
 <div className={`p-3.5 rounded-2xl transition-colors duration-300 ${isConnected
  ? 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 dark:from-emerald-500/20 dark:to-emerald-500/10 dark:text-emerald-400'
  : 'bg-muted text-muted-foreground group-hover:bg-primary/10 dark:group-hover:bg-primary group-hover:text-primary dark:group-hover:text-primary/70'
  }`}>
  {/* Placeholder for actual icons based on provider.icon */}
  <Plug className="h-6 w-6" />
 </div>
 {isConnected && (
  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/50 dark:bg-emerald-500/20 border border-emerald-200/50 dark:border-emerald-500/30 text-xs font-bold text-emerald-700 dark:text-emerald-400 backdrop-blur-sm">
  <CheckCircle2 className="h-3.5 w-3.5" />
  Connecté
  </div>
 )}
 </div>

 <h3 className="text-lg font-bold text-foreground mb-2 relative z-10">{provider.name}</h3>
 <p className="text-sm text-muted-foreground mb-6 min-h-[40px] leading-relaxed relative z-10">
 {provider.description}
 </p>

 <div className="flex items-center justify-between mt-auto relative z-10">
 <button
  onClick={() => isConnected ? onDisconnect(provider) : onConnect(provider)}
  disabled={isConnecting}
  className={`flex-1 py-3 px-4 rounded-3xl text-sm font-bold transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isConnected
  ? 'bg-white/50 dark:bg-white/5 border border-border/40 text-muted-foreground hover:bg-muted/50 dark:hover:bg-white/10 hover:text-red-500 dark:hover:text-red-400'
  : 'bg-foreground text-background hover:bg-primary/90 hover:text-white dark:hover:bg-primary dark:hover:text-white shadow-lg hover:shadow-primary/25'
  }`}
 >
  {isConnecting ? (
  <>
  <Loader2 className="h-4 w-4 animate-spin" />
  Traitement...
  </>
  ) : isConnected ? (
  'Déconnecter'
  ) : (
  'Connecter'
  )}
 </button>
 </div>
 </div>
 );
};
