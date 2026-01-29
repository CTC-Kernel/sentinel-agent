import React, { useState, useMemo } from 'react';
import { Risk, RiskTreatment, Criticality, Control, TreatmentAction } from '../../types';
import { Calendar, AlertTriangle, CheckCircle2, Clock, User, Shield, Sparkles, Plus, X, Search, Filter } from '../ui/Icons';
import { format, addDays, isAfter, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { TreatmentActionsList } from './TreatmentActionsList';

interface RiskTreatmentPlanProps {
    risk: Risk;
    onUpdate: (treatment: RiskTreatment) => void;
    onRiskUpdate?: (updates: Partial<Risk>) => void;
    users: { uid: string; displayName: string }[];
    controls?: Control[];
    onDirtyChange?: (isDirty: boolean) => void;
}

export const RiskTreatmentPlan: React.FC<RiskTreatmentPlanProps> = ({ risk, onUpdate, onRiskUpdate, users, controls = [], onDirtyChange }) => {
    // Default SLAs (in days)
    const SLA_DAYS = {
        [Criticality.CRITICAL]: 7,
        [Criticality.HIGH]: 30,
        [Criticality.MEDIUM]: 90,
        [Criticality.LOW]: 180
    };

    // Helper to calculate SLA status
    const calculateSLAStatus = (dueDate: string | undefined, status: string): 'On Track' | 'At Risk' | 'Breached' => {
        if (!dueDate) return 'On Track';

        const today = new Date();
        const due = parseISO(dueDate);

        if (isAfter(today, due) && status !== 'Terminé') {
            return 'Breached';
        } else if (status !== 'Terminé') {
            // Warning if within 3 days
            const warningDate = addDays(today, 3);
            if (isAfter(warningDate, due)) {
                return 'At Risk';
            }
        }
        return 'On Track';
    };

    // Control search and filter state
    const [controlSearch, setControlSearch] = useState('');
    const [frameworkFilter, setFrameworkFilter] = useState<string>('');

    // Get unique frameworks from controls
    const availableFrameworks = useMemo(() => {
        const frameworks = new Set(controls.map(c => c.framework).filter(Boolean));
        return Array.from(frameworks).sort();
    }, [controls]);

    // Filter controls based on search and framework
    const filteredControls = useMemo(() => {
        return controls.filter(c => {
            // Exclude already linked controls
            if (risk.mitigationControlIds?.includes(c.id)) return false;

            // Apply search filter
            const searchLower = controlSearch.toLowerCase();
            const matchesSearch = !controlSearch ||
                c.name.toLowerCase().includes(searchLower) ||
                c.code?.toLowerCase().includes(searchLower) ||
                c.description?.toLowerCase().includes(searchLower);

            // Apply framework filter
            const matchesFramework = !frameworkFilter || c.framework === frameworkFilter;

            return matchesSearch && matchesFramework;
        });
    }, [controls, risk.mitigationControlIds, controlSearch, frameworkFilter]);

    // Get linked controls with details
    const linkedControls = useMemo(() => {
        return (risk.mitigationControlIds || [])
            .map(id => controls.find(c => c.id === id))
            .filter((c): c is Control => c !== undefined);
    }, [risk.mitigationControlIds, controls]);

    // Calculate mitigation coverage based on control implementation status
    const mitigationCoverage = useMemo(() => {
        if (linkedControls.length === 0) return 0;

        const statusWeightMap: Record<string, number> = {
            'Implémenté': 1.0,
            'Actif': 1.0,
            'Partiel': 0.5,
            'En cours': 0.3,
            'En revue': 0.2,
            'Non commencé': 0.1,
            'Non applicable': 0,
            'Exclu': 0,
            'Inactif': 0,
            'Non appliqué': 0
        };

        const effectiveScore = linkedControls.reduce((sum, ctrl) => {
            return sum + (statusWeightMap[ctrl.status] ?? 0);
        }, 0);

        return Math.min(Math.round((effectiveScore / linkedControls.length) * 100), 100);
    }, [linkedControls]);

    const [treatment, setTreatment] = useState<RiskTreatment>(() => {
        const initial: RiskTreatment = risk.treatment ? { ...risk.treatment } : {
            strategy: risk.strategy || 'Atténuer',
            status: 'Planifié',
            description: '',
            ownerId: risk.ownerId
        };

        // Calculate default due date if not present
        if (!initial.dueDate && risk.createdAt) {
            try {
                const days = SLA_DAYS[risk.score >= 15 ? Criticality.CRITICAL :
                    risk.score >= 10 ? Criticality.HIGH :
                        risk.score >= 5 ? Criticality.MEDIUM : Criticality.LOW] || 90;

                const createdAtDate = parseISO(risk.createdAt);
                if (!isNaN(createdAtDate.getTime())) {
                    const suggestedDate = addDays(createdAtDate, days);
                    const formattedDate = format(suggestedDate, 'yyyy-MM-dd');

                    initial.dueDate = formattedDate;
                    initial.slaStatus = calculateSLAStatus(formattedDate, initial.status || 'Planifié');
                }
            } catch {
                // ErrorLogger.error(error, 'RiskTreatmentPlan.parseDate');
                // Keep default date if parsing fails
            }
        }

        return initial;
    });

    // Monitor dirty state for main treatment fields
    React.useEffect(() => {
        const isDirty = (
            treatment.strategy !== (risk.treatment?.strategy || risk.strategy || 'Atténuer') ||
            treatment.status !== (risk.treatment?.status || 'Planifié') ||
            treatment.ownerId !== (risk.treatment?.ownerId || risk.ownerId) ||
            treatment.dueDate !== risk.treatment?.dueDate ||
            treatment.description !== (risk.treatment?.description || '') ||
            treatment.estimatedCost !== risk.treatment?.estimatedCost
        );
        onDirtyChange?.(isDirty);
    }, [treatment, risk.treatment, risk.strategy, risk.ownerId, onDirtyChange]);

    const handleChange = (field: keyof RiskTreatment, value: string | number | string[]) => {
        const updated = { ...treatment, [field]: value };

        // Recalculate SLA if relevant fields change
        if ((field === 'dueDate' || field === 'status') && typeof value === 'string') {
            updated.slaStatus = calculateSLAStatus(
                field === 'dueDate' ? value : treatment.dueDate,
                field === 'status' ? value : (treatment.status || 'Planifié')
            );
        }

        setTreatment(updated);
        onUpdate(updated);
    };

    const toggleControl = (controlId: string) => {
        if (!onRiskUpdate) return;
        const currentIds = risk.mitigationControlIds || [];
        const newIds = currentIds.includes(controlId)
            ? currentIds.filter(id => id !== controlId)
            : [...currentIds, controlId];
        onRiskUpdate({ mitigationControlIds: newIds });
    };

    const removeMeasure = (index: number) => {
        const currentMeasures = treatment.measures || [];
        const newMeasures = currentMeasures.filter((_, i) => i !== index);
        handleChange('measures', newMeasures);
        // Actually, let's just do manual update
        const updated = { ...treatment, measures: newMeasures };
        setTreatment(updated);
        onUpdate(updated);
    };

    // Treatment Actions handlers
    const handleAddAction = (actionData: Omit<TreatmentAction, 'id' | 'createdAt'>) => {
        if (!onRiskUpdate) return;
        const newAction: TreatmentAction = {
            ...actionData,
            id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString()
        };
        const currentActions = risk.treatmentActions || [];
        onRiskUpdate({ treatmentActions: [...currentActions, newAction] });
    };

    const handleUpdateAction = (updatedAction: TreatmentAction) => {
        if (!onRiskUpdate) return;
        const currentActions = risk.treatmentActions || [];
        const newActions = currentActions.map(a =>
            a.id === updatedAction.id ? updatedAction : a
        );
        onRiskUpdate({ treatmentActions: newActions });
    };

    const handleDeleteAction = (actionId: string) => {
        if (!onRiskUpdate) return;
        const currentActions = risk.treatmentActions || [];
        onRiskUpdate({ treatmentActions: currentActions.filter(a => a.id !== actionId) });
    };

    return (
        <div className="space-y-6">
            <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-brand-500" />
                        Plan de Traitement
                    </h3>
                    {treatment.slaStatus === 'Breached' && (
                        <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-bold flex items-center gap-1 border border-red-200">
                            <AlertTriangle className="h-3 w-3" /> SLA Dépassé
                        </span>
                    )}
                    {treatment.slaStatus === 'At Risk' && (
                        <span className="px-3 py-1 bg-warning-bg text-warning-text rounded-full text-xs font-bold flex items-center gap-1 border border-warning-border">
                            <Clock className="h-3 w-3" /> SLA À Risque
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {/* Strategy */}
                    <div className="space-y-2">
                        <label htmlFor="risk-strategy" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 ml-1">Stratégie</label>
                        <div className="relative group">
                            <select
                                id="risk-strategy"
                                value={treatment.strategy}
                                onChange={(e) => handleChange('strategy', e.target.value)}
                                className="w-full appearance-none rounded-3xl border-border/40 dark:border-border/40 bg-white dark:bg-slate-800 text-sm p-3 font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none"
                            >
                                <option value="Atténuer">Atténuer (Réduire)</option>
                                <option value="Transférer">Transférer (Assurance/Sous-traitance)</option>
                                <option value="Éviter">Éviter (Supprimer l'activité)</option>
                                <option value="Accepter">Accepter (Risque résiduel)</option>
                            </select>
                            <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none group-hover:text-brand-500 transition-colors" />
                        </div>
                    </div>


                    {/* Status */}
                    <div className="space-y-2">
                        <label htmlFor="risk-status" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 ml-1">Statut</label>
                        <div className="relative group">
                            <select
                                id="risk-status"
                                value={treatment.status}
                                onChange={(e) => handleChange('status', e.target.value)}
                                className="w-full appearance-none rounded-3xl border-border/40 dark:border-border/40 bg-white dark:bg-slate-800 text-sm p-3 font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none"
                            >
                                <option value="Planifié">Planifié</option>
                                <option value="En cours">En cours</option>
                                <option value="Terminé">Terminé</option>
                                <option value="Retard">En retard</option>
                            </select>
                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none group-hover:text-brand-500 transition-colors" />
                        </div>
                    </div>


                    {/* Owner */}
                    <div className="space-y-2">
                        <label htmlFor="risk-owner" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 ml-1">Responsable</label>
                        <div className="relative group">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-brand-500 transition-colors" />
                            <select
                                id="risk-owner"
                                value={treatment.ownerId || ''}
                                onChange={(e) => handleChange('ownerId', e.target.value)}
                                className="w-full pl-10 pr-4 rounded-3xl border-border/40 dark:border-border/40 bg-white dark:bg-slate-800 text-sm p-3 font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none appearance-none"
                            >
                                <option value="">Sélectionner un responsable</option>
                                {users.map(u => (
                                    <option key={u.uid} value={u.uid}>{u.displayName}</option>
                                ))}
                            </select>
                        </div>
                    </div>


                    {/* Due Date */}
                    <div className="space-y-2">
                        <label htmlFor="risk-due-date" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 ml-1">Échéance (SLA)</label>
                        <div className="relative group">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-brand-500 transition-colors" />
                            <input
                                id="risk-due-date"
                                value={treatment.dueDate || ''}
                                onChange={(e) => handleChange('dueDate', e.target.value)}
                                type="date"
                                className={`w-full pl-10 pr-4 rounded-3xl border-border/40 dark:border-border/40 bg-white dark:bg-slate-800 text-sm p-3 font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none ${treatment.slaStatus === 'Breached' ? 'border-red-500 text-red-600' : ''
                                    }`}
                            />
                        </div>
                        {treatment.dueDate && (
                            <p className="text-xs text-slate-500 dark:text-slate-300 ml-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(parseISO(treatment.dueDate), 'dd MMMM yyyy', { locale: fr })}
                            </p>
                        )}
                    </div>

                    {/* Estimated Cost */}
                    <div className="space-y-2">
                        <label htmlFor="risk-estimated-cost" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 ml-1">Coût Estimé (€)</label>
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold group-focus-within:text-brand-500 transition-colors">€</span>
                            <input
                                id="risk-estimated-cost"
                                value={treatment.estimatedCost || ''}
                                onChange={(e) => handleChange('estimatedCost', parseFloat(e.target.value))}
                                type="number"
                                className="w-full pl-8 pr-4 rounded-3xl border-border/40 dark:border-border/40 bg-white dark:bg-slate-800 text-sm p-3 font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none placeholder:text-muted-foreground"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                </div>

                {/* Description */}
                <div className="space-y-2">
                    <label htmlFor="risk-description" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 ml-1">Description du plan</label>
                    <textarea
                        id="risk-description"
                        value={treatment.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        rows={4}
                        className="w-full rounded-3xl border-border/40 dark:border-border/40 bg-white dark:bg-slate-800 text-sm p-4 font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none placeholder:text-muted-foreground resize-none"
                        placeholder="Détaillez les actions à entreprendre pour traiter ce risque..."
                    />
                </div>


            </div>

            {/* AI Generated Measures */}
            {treatment.measures && treatment.measures.length > 0 && (
                <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-violet-500" />
                        Mesures suggérées (IA)
                    </h3>
                    <div className="grid gap-2">
                        {treatment.measures.map((measure, idx) => (
                            <div key={idx} className="flex items-start justify-between p-3 bg-violet-50/50 dark:bg-violet-900/10 rounded-3xl border border-violet-100 dark:border-violet-900/30">
                                <p className="text-sm text-slate-700 dark:text-slate-300 dark:text-muted-foreground">{measure}</p>
                                <button onClick={() => removeMeasure(idx)} className="text-muted-foreground hover:text-red-500 p-1">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Linked Controls - Enhanced with search and filters */}
            {onRiskUpdate && (
                <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Shield className="h-4 w-4 text-brand-500" />
                            Contrôles liés ({linkedControls.length})
                        </h3>
                        {linkedControls.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-500">Couverture:</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${mitigationCoverage >= 80 ? 'bg-success-text' :
                                                mitigationCoverage >= 50 ? 'bg-warning-text' : 'bg-error-text'
                                                }`}
                                            style={{ width: `${mitigationCoverage}%` }}
                                        />
                                    </div>
                                    <span className={`text-xs font-bold ${mitigationCoverage >= 80 ? 'text-success-text' :
                                        mitigationCoverage >= 50 ? 'text-warning-text' : 'text-error-text'
                                        }`}>
                                        {mitigationCoverage}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Linked Controls List */}
                    <div className="space-y-2">
                        {linkedControls.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-300 italic py-4 text-center">
                                Aucun contrôle lié. Ajoutez des contrôles pour réduire le risque résiduel.
                            </p>
                        ) : (
                            linkedControls.map(ctrl => {
                                const isImplemented = ctrl.status === 'Implémenté' || ctrl.status === 'Actif';
                                const isPartial = ctrl.status === 'Partiel' || ctrl.status === 'En cours';
                                return (
                                    <div key={ctrl.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-3xl border border-border/40 dark:border-slate-700 shadow-sm group hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3">
                                            <Shield className={`h-4 w-4 ${isImplemented ? 'text-success-text' : isPartial ? 'text-warning-text' : 'text-slate-400'}`} />
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{ctrl.code} - {ctrl.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-slate-500">{ctrl.framework || 'Contrôle'}</span>
                                                    <Badge
                                                        status={isImplemented ? 'success' : isPartial ? 'warning' : 'info'}
                                                        variant="soft"
                                                        size="sm"
                                                    >
                                                        {ctrl.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleControl(ctrl.id)}
                                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 opacity-0 group-hover:opacity-70 transition-opacity"
                                            aria-label={`Détacher le contrôle ${ctrl.name}`}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="pt-4 border-t border-border/40 dark:border-slate-700 space-y-3">
                        <label htmlFor="control-search" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 flex items-center gap-2">
                            <Plus className="h-3.5 w-3.5" />
                            Lier un nouveau contrôle
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    id="control-search"
                                    type="text"
                                    placeholder="Rechercher un contrôle..."
                                    value={controlSearch}
                                    onChange={(e) => setControlSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 rounded-3xl border border-border/40 dark:border-border/40 bg-white dark:bg-slate-800 text-sm font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none placeholder:text-muted-foreground"
                                />
                            </div>

                            {availableFrameworks.length > 1 && (
                                <div className="relative">
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <select
                                        value={frameworkFilter}
                                        onChange={(e) => setFrameworkFilter(e.target.value)}
                                        className="pl-9 pr-8 py-2 rounded-3xl border border-border/40 dark:border-border/40 bg-white dark:bg-slate-800 text-sm font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none appearance-none cursor-pointer"
                                        aria-label="Filtrer par framework"
                                    >
                                        <option value="">Tous</option>
                                        {availableFrameworks.map(fw => (
                                            <option key={fw} value={fw}>{fw}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Available Controls List */}
                        <div className="max-h-48 overflow-y-auto space-y-1 rounded-3xl border border-border/40 dark:border-border/40 bg-white/30 dark:bg-black/10 p-2">
                            {filteredControls.length === 0 ? (
                                <p className="text-xs text-slate-500 dark:text-slate-300 text-center py-3">
                                    {controlSearch || frameworkFilter
                                        ? 'Aucun contrôle correspondant'
                                        : 'Tous les contrôles sont déjà liés'}
                                </p>
                            ) : (
                                filteredControls.slice(0, 20).map(ctrl => {
                                    const isImplemented = ctrl.status === 'Implémenté' || ctrl.status === 'Actif';
                                    const isPartial = ctrl.status === 'Partiel' || ctrl.status === 'En cours';
                                    return (
                                        <button
                                            key={ctrl.id}
                                            type="button"
                                            onClick={() => toggleControl(ctrl.id)}
                                            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors text-left group"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Shield className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                    {ctrl.code} - {ctrl.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <Badge
                                                    status={isImplemented ? 'success' : isPartial ? 'warning' : 'info'}
                                                    variant="soft"
                                                    size="sm"
                                                >
                                                    {ctrl.status}
                                                </Badge>
                                                <Plus className="h-4 w-4 text-brand-500 opacity-0 group-hover:opacity-70 transition-opacity" />
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                            {filteredControls.length > 20 && (
                                <p className="text-xs text-slate-500 dark:text-slate-300 text-center py-1">
                                    +{filteredControls.length - 20} autres contrôles...
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Treatment Actions */}
            {onRiskUpdate && (
                <TreatmentActionsList
                    actions={risk.treatmentActions || []}
                    users={users}
                    onAdd={handleAddAction}
                    onUpdate={handleUpdateAction}
                    onDelete={handleDeleteAction}
                    onDirtyChange={onDirtyChange}
                />
            )}
        </div>
    );
};
