import React, { useState } from 'react';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { MigrationService } from '../../services/migrationService';
import { Database, Loader2, Zap } from '../ui/Icons';

export const MigrationTool: React.FC = () => {
 const { addToast, t } = useStore();
 const [loading, setLoading] = useState(false);
 const [logs, setLogs] = useState<string[]>([]);
 const [progress, setProgress] = useState(0);

 const runMigration = async () => {
 setLoading(true);
 setLogs([]);
 setProgress(0);

 try {
 const result = await MigrationService.runOrganizationMigration((progressUpdate) => {
 setProgress(progressUpdate.progress);
 setLogs(progressUpdate.logs);
 });

 addToast(
 t('admin.toast.migrationComplete', { defaultValue: `Migration terminée. ${result.totalFixed} documents et ${result.orgFixed} organisations corrigés.`, totalFixed: result.totalFixed, orgFixed: result.orgFixed }),
 "success"
 );
 } catch (error) {
 ErrorLogger.error(error, 'MigrationTool.runMigration');
 const msg = error instanceof Error ? error.message : 'Unknown error';
 setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Erreur: ${msg}`]);
 addToast(t('admin.toast.migrationError', { defaultValue: "Erreur lors de la migration" }), "error");
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="glass-premium rounded-2xl p-6 border border-border/40">
 <div className="flex items-center gap-4 mb-6">
 <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl text-indigo-600 dark:text-indigo-400">
  <Database className="h-6 w-6" />
 </div>
 <div>
  <h3 className="text-lg font-bold text-foreground">Migration & Intégrité</h3>
  <p className="text-sm text-muted-foreground">Vérifier et réparer la cohérence des données multi-tenant.</p>
 </div>
 </div>

 <div className="bg-muted/50 rounded-3xl p-4 mb-6 font-mono text-xs h-48 overflow-y-auto border border-border/40">
 {logs.length === 0 ? (
  <span className="text-muted-foreground italic">Prêt à démarrer...</span>
 ) : (
  logs.map((l, i) => <div key={`${i || 'unknown'}-${l}`} className="mb-1 text-muted-foreground">{l}</div>)
 )}
 </div>

 {loading && (
 <div className="mb-4">
  <div className="h-2 bg-muted rounded-full overflow-hidden">
  <div
  className="h-full bg-indigo-500 transition-all duration-300"
  style={{ width: `${progress}%` }}
  />
  </div>
 </div>
 )}

 <button
 onClick={runMigration}
 disabled={loading}
 className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-3xl transition-colors flex items-center justify-center gap-2 disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
 >
 {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
 {loading ? 'Migration en cours...' : 'Lancer la Migration'}
 </button>
 </div>
 );
};
