import React, { useState } from 'react';
import { AlertTriangle, Phone, ShieldAlert, CheckCircle2, User, Megaphone, Lock } from '../ui/Icons';
import { Button } from '../ui/button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { UserProfile } from '../../types';
import { useStore } from '../../store';
import { WarRoomModal } from './WarRoomModal';
import { useCrisis } from '../../contexts/CrisisContext';
import { useLocale } from '@/hooks/useLocale';

interface ContinuityCrisisProps {
 users: UserProfile[];
}

export const ContinuityCrisis: React.FC<ContinuityCrisisProps> = ({ users }) => {
 const { addToast } = useStore();
 const { t } = useLocale();
 const {
 isCrisisActive: crisisActive,
 scenario,
 activationStep,
 activateCrisis,
 deactivateCrisis,
 setActivationStep
 } = useCrisis();

 // Derived state for local UI not managed by context
 const [confirmDeactivate, setConfirmDeactivate] = useState(false);
 const [selectedScenario, setSelectedScenario] = useState<'cyber' | 'fire' | 'supply' | 'staff'>('cyber');
 const [isWarRoomOpen, setIsWarRoomOpen] = useState(false);

 const crisisTeam = users.filter(u => u.role === 'admin' || u.role === 'rssi' || u.role === 'direction');

 const handleActivateCrisis = async () => {
 if (activationStep < 2) {
 setActivationStep(activationStep + 1);
 return;
 }

 await activateCrisis(selectedScenario);

 const scenarioLabels = {
 cyber: t('continuity.crisis.scenarioCyber', { defaultValue: 'CYBERATTAQUE DE GRANDE AMPLEUR' }),
 fire: t('continuity.crisis.scenarioFire', { defaultValue: 'INCENDIE DATACENTER / LOCAUX' }),
 supply: t('continuity.crisis.scenarioSupply', { defaultValue: 'DÉFAILLANCE CRITIQUE FOURNISSEUR' }),
 staff: t('continuity.crisis.scenarioStaff', { defaultValue: 'INDISPONIBILITÉ MAJEURE PERSONNEL' })
 };
 addToast(t('continuity.toast.crisisActivated', { defaultValue: `MODE CRISE ACTIVÉ : ${scenarioLabels[selectedScenario]}`, scenario: scenarioLabels[selectedScenario] }), "error");
 addToast(t('continuity.toast.crisisNotificationsSent', { defaultValue: "Notifications envoyées à la cellule de crise." }), "info");
 };

 const handleDeactivate = async () => {
 await deactivateCrisis();
 setConfirmDeactivate(false);
 setActivationStep(0);
 addToast(t('continuity.toast.crisisDeactivated', { defaultValue: "Mode crise désactivé. Retour à la normale." }), "success");
 };

 return (
 <div className="space-y-6 sm:space-y-8">
 {/* Status Header */}
 <div className={`p-8 rounded-4xl border-2 transition-all duration-500 overflow-hidden relative ${crisisActive ? 'bg-red-950/30 border-red-2000 shadow-[0_0_50px_rgba(239,68,68,0.2)]' : 'glass-premium border-border/40'}`}>
 <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
  <div className="flex items-center gap-6">
  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg ${crisisActive ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20'}`}>
  {crisisActive ? <AlertTriangle className="w-10 h-10" /> : <ShieldAlert className="w-10 h-10" />}
  </div>
  <div>
  <h2 className="text-3xl font-black tracking-tight mb-2 text-foreground">
  {crisisActive ? t('continuity.crisis.cellActivated', { defaultValue: 'CELLULE DE CRISE ACTIVÉE' }) : t('continuity.crisis.normalSurveillance', { defaultValue: 'Surveillance Normale' })}
  </h2>
  <p className="text-lg opacity-80 max-w-xl">
  {crisisActive
   ? t('continuity.crisis.protocolActive', { defaultValue: `Protocole ${scenario.toUpperCase()} en cours. P.C.A activé. Actions journalisées.`, scenario: scenario.toUpperCase() })
   : t('continuity.crisis.noIncident', { defaultValue: 'Aucun incident critique en cours. Les systèmes sont nominaux.' })}
  </p>
  </div>
  </div>

  <div className="flex flex-col items-end gap-3">
  {!crisisActive ? (
  <div className="flex flex-col gap-2 items-end">
  {activationStep === 0 && (
   <select
   value={selectedScenario}
   onChange={(e) => setSelectedScenario(e.target.value as 'cyber' | 'fire' | 'supply' | 'staff')}
   className="bg-muted border border-border/40 rounded-lg px-3 py-2 text-sm font-bold text-foreground mb-2 focus-visible:ring-2 focus-visible:ring-red-500"
   >
   <option value="cyber">{t('continuity.crisis.optionCyber', { defaultValue: 'Cyberattaque (Ransomware/DDoS)' })}</option>
   <option value="fire">{t('continuity.crisis.optionFire', { defaultValue: 'Incendie / Sinistre Physique' })}</option>
   <option value="supply">{t('continuity.crisis.optionSupply', { defaultValue: 'Défaillance Fournisseur Critique' })}</option>
   <option value="staff">{t('continuity.crisis.optionStaff', { defaultValue: 'Indisponibilité Personnel (Pandémie)' })}</option>
   </select>
  )}
  <Button
   onClick={handleActivateCrisis}
   className={`h-16 px-8 text-lg font-bold rounded-2xl transition-all ${activationStep === 0 ? 'bg-foreground text-background dark:text-black' :
   activationStep === 1 ? 'bg-amber-500 hover:bg-amber-600 text-white' :
   'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-500/30 animate-pulse'
   }`}
  >
   {activationStep === 0 && <span className="flex items-center gap-2"><Megaphone className="w-5 h-5" /> {t('continuity.crisis.reportIncident', { defaultValue: 'Signaler Incident' })}</span>}
   {activationStep === 1 && t('continuity.crisis.confirmAlert', { defaultValue: "Confirmer l'alerte ?" })}
   {activationStep === 2 && t('continuity.crisis.activateNow', { defaultValue: 'ACTIVER MAINTENANT' })}
  </Button>
  </div>
  ) : (
  <Button onClick={() => setConfirmDeactivate(true)} variant="outline" className="h-16 px-8 text-lg border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 font-bold rounded-2xl">
  <CheckCircle2 className="w-6 h-6 mr-2" /> {t('continuity.crisis.closeCrisis', { defaultValue: 'Clôturer la Crise' })}
  </Button>
  )}
  {activationStep > 0 && !crisisActive && (
  <button onClick={() => setActivationStep(0)} className="text-sm text-muted-foreground hover:text-foreground">{t('common.cancel', { defaultValue: 'Annuler' })}</button>
  )}
  </div>
 </div>

 {/* Background Pattern */}
 {crisisActive && (
  <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(239,68,68,0.05)_10px,rgba(239,68,68,0.05)_20px)] pointer-events-none" />
 )}
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {/* Contacts Card */}
 <div className="md:col-span-2 glass-premium p-4 sm:p-6 rounded-2xl border border-border/40">
  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
  <Phone className="w-5 h-5 text-info" /> {t('continuity.crisis.crisisDirectory', { defaultValue: 'Annuaire de Crise (Décideurs)' })}
  </h3>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  {crisisTeam.map(member => (
  <div key={member.uid || 'unknown'} className="flex items-center p-4 bg-muted/50 dark:bg-white/5 rounded-3xl border border-border/40 dark:border-white/5">
  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground mr-3">
   <User className="w-5 h-5" />
  </div>
  <div>
   <p className="font-bold text-sm text-foreground">{member.displayName || member.email}</p>
   <p className="text-xs text-muted-foreground uppercase font-bold">{member.role}</p>
  </div>
  <Button size="sm" variant="ghost" className="ml-auto text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30">
   <Phone className="w-4 h-4" />
  </Button>
  </div>
  ))}
  </div>
 </div>

 {/* Secure Room Access */}
 <div className="glass-premium p-4 sm:p-6 rounded-2xl border border-border/40 flex flex-col items-center justify-center text-center">
  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
  <Lock className="w-8 h-8 text-muted-foreground" />
  </div>
  <h3 className="font-bold text-lg mb-2">{t('continuity.crisis.warRoomTitle', { defaultValue: 'War Room Virtuelle' })}</h3>
  <p className="text-sm text-muted-foreground mb-6">{t('continuity.crisis.warRoomDescription', { defaultValue: 'Accès sécurisé aux documents confidentiels et au chat crypté de crise.' })}</p>
  <Button disabled={!crisisActive} className="w-full" onClick={() => setIsWarRoomOpen(true)}>
  {t('continuity.crisis.access', { defaultValue: 'Accéder' })}
  </Button>
 </div>
 </div>

 {/* Event Log Placeholder */}
 {crisisActive && (
 <div className="glass-premium p-4 sm:p-6 rounded-2xl border border-red-500/20">
  <h3 className="font-bold mb-4">{t('continuity.crisis.eventLog', { defaultValue: 'Journal des Événements (Main Courante)' })}</h3>
  <div className="space-y-4">
  <div className="flex gap-4 items-start">
  <span className="text-xs font-mono text-muted-foreground mt-1">{new Date().toLocaleTimeString()}</span>
  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg text-sm flex-1">
  <strong>{t('continuity.crisis.system', { defaultValue: 'SYSTÈME' })} :</strong> {t('continuity.crisis.activationBy', { defaultValue: `Activation de la cellule de crise par ${useStore.getState().user?.role}.`, role: useStore.getState().user?.role })}
  </div>
  </div>
  </div>
 </div>
 )}

 <WarRoomModal
 isOpen={isWarRoomOpen}
 onClose={() => setIsWarRoomOpen(false)}
 incidentId={`crisis-${scenario}-${new Date().toISOString().split('T')[0]}`}
 incidentTitle={`PROTOCOLE ${scenario.toUpperCase()}`}
 />

 <ConfirmModal
 isOpen={confirmDeactivate}
 onClose={() => setConfirmDeactivate(false)}
 onConfirm={handleDeactivate}
 title={t('continuity.closeCrisisTitle', { defaultValue: 'Clôturer la crise ?' })}
 message={t('continuity.closeCrisisMessage', { defaultValue: 'Confirmer la fin de la crise ? Un rapport sera généré automatiquement et le journal des événements sera archivé.' })}
 confirmText={t('continuity.closeCrisisConfirm', { defaultValue: 'Clôturer' })}
 cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
 />
 </div>
 );
};
