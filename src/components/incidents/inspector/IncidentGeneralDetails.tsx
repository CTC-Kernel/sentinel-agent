import React from 'react';
import { Incident, Criticality } from '../../../types';
import { BookOpen } from '../../ui/Icons';
import { SafeHTML } from '../../ui/SafeHTML';
import { Badge } from '../../ui/Badge';
import { ThreatIntelChecker } from '../ThreatIntelChecker';
import { NIS2DeadlineTimer } from '../NIS2DeadlineTimer';

interface IncidentGeneralDetailsProps {
    incident: Incident;
}

export const IncidentGeneralDetails: React.FC<IncidentGeneralDetailsProps> = ({ incident }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                {/* Description */}
                <div className="glass-premium p-4 sm:p-6 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-10">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-brand-500" />
                            Description
                        </h3>
                        {incident.description ? (
                            <SafeHTML content={incident.description} />
                        ) : (
                            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                Aucune description.
                            </p>
                        )}
                    </div>
                </div>

                {/* NIS 2 Deadlines */}
                {incident.isSignificant && (
                    <div className="glass-premium p-4 sm:p-6 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-red-50/30 dark:bg-red-50 dark:bg-red-900 pointer-events-none" />
                        <div className="relative z-10">
                            <h3 className="text-sm font-bold text-red-800 dark:text-red-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                                <span className="animate-pulse h-2 w-2 rounded-full bg-red-500" />
                                Délais de Notification (NIS 2)
                            </h3>
                            <NIS2DeadlineTimer incident={incident} />
                        </div>
                    </div>
                )}


                {/* Badges & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 glass-premium rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                        <div className="relative z-10">
                            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Sévérité</span>
                            <Badge
                                status={incident.severity === Criticality.CRITICAL ? 'error' : incident.severity === Criticality.HIGH ? 'warning' : 'info'}
                                variant="soft"
                            >
                                {incident.severity}
                            </Badge>
                        </div>
                    </div>
                    <div className="p-4 glass-premium rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                        <div className="relative z-10">
                            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Statut</span>
                            <Badge status={incident.status === 'Résolu' ? 'success' : 'info'} variant="outline">
                                {incident.status}
                            </Badge>
                        </div>
                    </div>
                    <div className="p-4 glass-premium rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                        <div className="relative z-10">
                            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Impact Financier</span>
                            <span className="font-bold text-slate-900 dark:text-white">{incident.financialImpact ? `${incident.financialImpact} €` : '-'}</span>
                        </div>
                    </div>
                    <div className="p-4 glass-premium rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                        <div className="relative z-10">
                            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Reporter</span>
                            <span className="font-bold text-slate-900 dark:text-white">{incident.reporter}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Meta Info */}
                <div className="glass-premium p-4 sm:p-6 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm space-y-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-10">
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Déclaré le</label>
                            <p className="font-medium text-slate-900 dark:text-white mt-1">
                                {new Date(incident.dateReported).toLocaleString()}
                            </p>
                        </div>
                        <div className="mt-4">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Déclaré par</label>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="h-6 w-6 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
                                    {incident.reporter.charAt(0)}
                                </div>
                                <span className="font-medium text-slate-900 dark:text-white">{incident.reporter}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Threat Intel Check */}
                <ThreatIntelChecker />
            </div>
        </div >
    );
};
