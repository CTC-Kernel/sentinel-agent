import React, { useState } from 'react';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Asset, UserProfile, Supplier, BusinessProcess, MaintenanceRecord } from '../../types';
import { AssetFormData } from '../../schemas/assetSchema';
import { AssetForm } from './AssetForm';
import { LifecycleTimeline } from './LifecycleTimeline';
import { RelationshipGraph } from '../RelationshipGraph';
import { AssetAIAssistant } from './AssetAIAssistant';
import { CommentSection } from '../collaboration/CommentSection';
import { ResourceHistory } from '../shared/ResourceHistory';
import { useAssetDetails } from '../../hooks/assets/useAssetDetails';
import { useAssetSecurity } from '../../hooks/assets/useAssetSecurity';
import {
    HeartPulse, Archive, ClipboardList, ShieldAlert,
    Siren, Flame, FolderKanban, CheckSquare, CalendarClock,
    AlertTriangle, FileText, ExternalLink, History, Search, Plus, Server
} from '../ui/Icons';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { DatePicker } from '../ui/DatePicker';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { sanitizeData } from '../../utils/dataSanitizer';
import { LayoutDashboard, RefreshCw, Shield, Network, BrainCircuit, MessageSquare } from 'lucide-react';

interface AssetInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset?: Asset | null;
    onUpdate: (id: string, data: AssetFormData) => Promise<boolean | string>;
    onCreate: (data: AssetFormData) => Promise<boolean | string>;
    users: UserProfile[];
    suppliers: Supplier[];
    processes: BusinessProcess[];
    canEdit: boolean;
}

export const AssetInspector: React.FC<AssetInspectorProps> = ({
    isOpen,
    onClose,
    selectedAsset,
    onUpdate,
    onCreate,
    users,
    suppliers,
    processes,
    canEdit
}) => {
    const navigate = useNavigate();
    const [inspectorTab, setInspectorTab] = useState<'details' | 'lifecycle' | 'security' | 'compliance' | 'projects' | 'audits' | 'documents' | 'history' | 'graph' | 'intelligence' | 'comments'>('details');
    const {
        maintenanceRecords,
        linkedRisks,
        linkedIncidents,
        linkedProjects,
        linkedAudits,
        linkedDocuments,
        linkedControls,
        addMaintenance
    } = useAssetDetails(selectedAsset || null);

    const {
        scanning,
        shodanResult,
        vulnerabilities,
        scanShodan,
        checkCVEs,
        createRiskFromVuln
    } = useAssetSecurity(selectedAsset || null);

    const [newMaintenance, setNewMaintenance] = useState<Partial<MaintenanceRecord>>({
        date: new Date().toISOString().split('T')[0],
        type: 'Préventive',
        description: '',
        technician: ''
    });
    const [isAddingMaintenance, setIsAddingMaintenance] = useState(false);

    const handleAddMaintenance = async () => {
        if (!selectedAsset || !newMaintenance.description || !canEdit) return;
        setIsAddingMaintenance(true);
        const success = await addMaintenance(sanitizeData(newMaintenance) as MaintenanceRecord);
        if (success) {
            setNewMaintenance({ date: new Date().toISOString().split('T')[0], type: 'Préventive', description: '', technician: '' });
        }
        setIsAddingMaintenance(false);
    };

    // Calculate TCO logic (moved locally or duplicated for display)
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



    const tabs = [
        { id: 'details', label: 'Détails', icon: LayoutDashboard },
        ...(selectedAsset ? [
            { id: 'lifecycle', label: 'Cycle de Vie', icon: RefreshCw },
            { id: 'security', label: 'Sécurité', icon: ShieldAlert },
            { id: 'compliance', label: 'Conformité', icon: Shield },
            { id: 'projects', label: 'Projets', icon: FolderKanban },
            { id: 'audits', label: 'Audits', icon: CheckSquare },
            { id: 'documents', label: 'Documents', icon: FileText },
            { id: 'history', label: 'Historique', icon: History },
            { id: 'graph', label: 'Graphe', icon: Network },
            { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
            { id: 'comments', label: 'Discussion', icon: MessageSquare }
        ] : [])
    ];

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={selectedAsset ? selectedAsset.name : "Nouvel Actif"}
            subtitle={selectedAsset ? "Détails et configuration de l'actif" : "Ajouter un nouvel actif à l'inventaire"}
            icon={selectedAsset ? Server : Plus}
            statusBadge={selectedAsset ? (
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${selectedAsset.lifecycleStatus === 'En service' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'}`}>
                    {selectedAsset.lifecycleStatus || 'Neuf'}
                </span>
            ) : null}
            tabs={tabs}
            activeTab={inspectorTab}
            onTabChange={(id) => setInspectorTab(id as typeof inspectorTab)}
        >

            <div className="space-y-8 max-w-7xl mx-auto">
                {inspectorTab === 'details' && (
                    <div className="space-y-8">
                        <AssetForm
                            initialData={selectedAsset || undefined}
                            onSubmit={async (data) => {
                                if (selectedAsset) {
                                    await onUpdate(selectedAsset.id, data);
                                } else {
                                    await onCreate(data);
                                    onClose();
                                }
                            }}
                            usersList={users}
                            suppliers={suppliers}
                            isEditing={!!selectedAsset}
                            onCancel={onClose}
                        />


                    </div>
                )}

                {inspectorTab === 'lifecycle' && selectedAsset && (
                    <div className="space-y-8">
                        <div className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm overflow-x-auto">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-8">Timeline du cycle de vie</h3>
                            <div className="min-w-[600px] px-4">
                                <LifecycleTimeline
                                    status={selectedAsset?.lifecycleStatus || 'Neuf'}
                                    purchaseDate={selectedAsset?.purchaseDate}
                                    warrantyEnd={selectedAsset?.warrantyEnd}
                                    nextMaintenance={selectedAsset?.nextMaintenance}
                                />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-blue-600/80 flex items-center"><Archive className="h-4 w-4 mr-2" /> État du cycle de vie</h3>
                                <div className="px-3 py-1 rounded-full bg-blue-50 dark:bg-slate-900 dark:bg-slate-900/20 text-blue-600 text-xs font-bold">{selectedAsset?.lifecycleStatus || 'Neuf'}</div>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                                    <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Date d'achat</label><div className="text-sm font-medium text-slate-900 dark:text-white">{selectedAsset?.purchaseDate ? new Date(selectedAsset.purchaseDate).toLocaleDateString() : '-'}</div></div>
                                    <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Fin de garantie</label><div className="text-sm font-medium text-slate-900 dark:text-white">{selectedAsset?.warrantyEnd ? new Date(selectedAsset.warrantyEnd).toLocaleDateString() : '-'}</div></div>
                                    <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Prix d'achat (€)</label><div className="text-sm font-medium text-slate-900 dark:text-white">{selectedAsset?.purchasePrice ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(selectedAsset.purchasePrice) : '-'}</div></div>
                                    <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Coût Maintenance (€)</label><div className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/5 text-sm font-bold">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(maintenanceRecords.reduce((acc, m) => acc + (m.cost || 0), 0))}</div></div>
                                </div>

                                {selectedAsset?.purchasePrice && (
                                    <div className="mt-6 pt-6 border-t border-dashed border-slate-200 dark:border-white/10">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                                <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">Valeur Actuelle (Net)</p>
                                                <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(calculateDepreciation(selectedAsset.purchasePrice, selectedAsset.purchaseDate || ''))}</p>
                                            </div>
                                            <div className="p-4 bg-blue-50 dark:bg-slate-900 dark:bg-slate-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                                <p className="text-[10px] font-bold uppercase text-blue-600 mb-1">TCO (Coût Total)</p>
                                                <p className="text-xl font-black text-blue-700 dark:text-blue-400">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(calculateTCO())}</p>
                                            </div>
                                        </div>
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Courbe d'amortissement (5 ans)</h4>
                                        <div className="h-40 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={getDepreciationData()}>
                                                    <defs>
                                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                                                    <XAxis dataKey="year" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                                    <YAxis hide />
                                                    <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} itemStyle={{ color: '#fff' }} formatter={(val: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val)} />
                                                    <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-4 px-1"><h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center"><ClipboardList className="h-4 w-4 mr-2 text-brand-500" /> Historique Maintenance</h3></div>
                            {canEdit && (
                                <div className="bg-white dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-white/5 mb-6 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <DatePicker
                                            label="Date"
                                            value={newMaintenance.date}
                                            onChange={(date) => setNewMaintenance({ ...newMaintenance, date: date || '' })}
                                        />
                                        <CustomSelect
                                            label="Type"
                                            options={['Préventive', 'Corrective', 'Mise à jour', 'Inspection'].map(t => ({ value: t, label: t }))}
                                            value={newMaintenance.type || ''}
                                            onChange={(val) => setNewMaintenance({ ...newMaintenance, type: val as MaintenanceRecord['type'] })}
                                        />
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                                        <div className="flex-1">
                                            <FloatingLabelInput
                                                label="Description"
                                                value={newMaintenance.description}
                                                onChange={e => setNewMaintenance({ ...newMaintenance, description: e.target.value })}
                                            />
                                        </div>
                                        <div className="w-full md:w-32">
                                            <FloatingLabelInput
                                                type="number"
                                                label="Coût (€)"
                                                value={newMaintenance.cost || ''}
                                                onChange={e => setNewMaintenance({ ...newMaintenance, cost: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddMaintenance}
                                        disabled={isAddingMaintenance}
                                        aria-label="Ajouter une intervention de maintenance"
                                        className="w-full py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl text-sm font-bold shadow-lg hover:scale-[1.02] transition-transform disabled:opacity-50 flex justify-center items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                    >
                                        {isAddingMaintenance ? <span className="animate-spin mr-2">⏳</span> : null}Ajouter Intervention
                                    </button>
                                </div>
                            )}
                            <div className="space-y-3">
                                {maintenanceRecords.length === 0 ? <p className="text-sm text-slate-500 text-center italic py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucune intervention enregistrée.</p> : maintenanceRecords.map(rec => (
                                    <div key={rec.id} className="flex items-start p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm hover:shadow-md transition-all">
                                        <div className={`mt-1.5 w-2.5 h-2.5 rounded-full mr-4 flex-shrink-0 ${rec.type === 'Corrective' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`}></div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-slate-900 dark:text-white">{new Date(rec.date).toLocaleDateString()}</span><span className="text-[10px] uppercase tracking-wider bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300 font-bold">{rec.type}</span></div>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{rec.description}</p>
                                            <div className="flex justify-between mt-2"><span className="text-[10px] text-slate-500 font-medium">Tech: {rec.technician}</span>{rec.cost && <span className="text-[10px] font-bold text-slate-600">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(rec.cost)}</span>}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {inspectorTab === 'security' && selectedAsset && (
                    <div className="space-y-8">
                        <div className="flex gap-4">
                            <CustomTooltip content="Scanner l'actif avec Shodan.io">
                                <button
                                    type="button"
                                    onClick={scanShodan}
                                    disabled={scanning}
                                    aria-label="Lancer un scan Shodan"
                                    className="flex-1 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl text-sm font-bold shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                >
                                    {scanning ? <span className="animate-spin mr-2">⏳</span> : <Search className="w-4 h-4 mr-2" />}
                                    Scan Shodan
                                </button>
                            </CustomTooltip>
                            <CustomTooltip content="Rechercher des CVEs (NVD)">
                                <button
                                    type="button"
                                    onClick={checkCVEs}
                                    disabled={scanning}
                                    aria-label="Rechercher des vulnérabilités CVE"
                                    className="flex-1 py-3 bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white rounded-xl text-sm font-bold shadow-sm hover:bg-slate-200 dark:hover:bg-white/20 transition-colors flex items-center justify-center disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                >
                                    {scanning ? <span className="animate-spin mr-2">⏳</span> : <ShieldAlert className="w-4 h-4 mr-2" />}
                                    Check CVEs (NVD)
                                </button>
                            </CustomTooltip>
                        </div>

                        {shodanResult && (
                            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4 flex items-center">
                                    <Server className="h-4 w-4 mr-2" /> Résultat Shodan
                                </h3>
                                <div className="space-y-2 text-sm font-mono">
                                    <p><span className="text-slate-500">IP:</span> {shodanResult.ip_str}</p>
                                    <p><span className="text-slate-500">OS:</span> {shodanResult.os || 'N/A'}</p>
                                    <p><span className="text-slate-500">Ports:</span> {shodanResult.ports?.join(', ') || 'None'}</p>
                                    <p><span className="text-slate-500">Org:</span> {shodanResult.org || 'N/A'}</p>
                                </div>
                            </div>
                        )}

                        {vulnerabilities.length > 0 && (
                            <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/30">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-4 flex items-center">
                                    <ShieldAlert className="h-4 w-4 mr-2" /> Vulnérabilités NVD ({vulnerabilities.length})
                                </h3>
                                <div className="space-y-3">
                                    {vulnerabilities.map(vuln => (
                                        <div key={vuln.cveId} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-red-100 dark:border-red-900/20 shadow-sm">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-sm font-bold text-red-700 dark:text-red-400">{vuln.cveId}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-800 rounded">{vuln.severity} ({vuln.score})</span>
                                                    <CustomTooltip content="Créer un risque">
                                                        <button
                                                            onClick={() => createRiskFromVuln(vuln)}
                                                            aria-label={`Créer un risque pour ${vuln.cveId}`}
                                                            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </button>
                                                    </CustomTooltip>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2" title={vuln.description}>{vuln.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center">
                                    <ShieldAlert className="h-4 w-4 mr-2" /> Risques Identifiés ({linkedRisks.length})
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => selectedAsset && navigate('/risks', { state: { createForAsset: selectedAsset.id, assetName: selectedAsset.name } })}
                                    aria-label="Créer un nouveau risque"
                                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Nouveau Risque
                                </button>
                            </div>
                            {linkedRisks.length === 0 ? (
                                <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun risque associé.</p>
                            ) : (
                                <div className="grid gap-4">
                                    {linkedRisks.map(risk => (
                                        <div key={risk.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{risk.threat}</span>
                                                <span className={`text-[10px] px-2 py-1 rounded-lg font-bold ${risk.score >= 15 ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'}`}>Score {risk.score}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{risk.vulnerability}</p>
                                            {risk.score >= 15 && <div className="flex items-center text-[10px] text-red-600 font-bold bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-xl w-fit"><Flame className="h-3 w-3 mr-1.5" /> Risque Critique</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center">
                                    <Siren className="h-4 w-4 mr-2" /> Incidents ({linkedIncidents.length})
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => selectedAsset && navigate('/incidents', { state: { createForAsset: selectedAsset.id, assetName: selectedAsset.name } })}
                                    aria-label="Signaler un incident"
                                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Signaler Incident
                                </button>
                            </div>
                            {linkedIncidents.length === 0 ? (
                                <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun incident signalé.</p>
                            ) : (
                                <div className="grid gap-4">
                                    {linkedIncidents.map(inc => (
                                        <div key={inc.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{inc.title}</span>
                                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${inc.status === 'Résolu' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inc.status}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{new Date(inc.dateReported).toLocaleDateString()}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {inspectorTab === 'compliance' && selectedAsset && (
                    <div className="space-y-8">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><Shield className="h-4 w-4 mr-2" /> Contrôles de Sécurité ({linkedControls.length})</h3>
                        {linkedControls.length === 0 ? (
                            <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun contrôle associé.</p>
                        ) : (
                            <div className="grid gap-4">
                                {linkedControls.map(ctrl => (
                                    <div key={ctrl.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                {ctrl.code}
                                            </span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${ctrl.status === 'Implémenté' ? 'bg-green-100 text-green-700' : ctrl.status === 'Partiel' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{ctrl.status}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{ctrl.name}</p>
                                        <div className="text-[10px] text-slate-400">Type: {ctrl.type || 'Non défini'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-slate-400 text-center mt-4">Les contrôles sont gérés dans le module Conformité.</p>

                        {/* Supported Processes (Moved from Details) */}
                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center">
                                <HeartPulse className="h-4 w-4 mr-2" /> Processus Supportés
                            </h3>
                            {(() => {
                                const supported = processes.filter(p => p.supportingAssetIds?.includes(selectedAsset.id));
                                return supported.length > 0 ? (
                                    <div className="space-y-2">
                                        {supported.map(p => (
                                            <div key={p.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center">
                                                <span className="text-sm font-medium text-slate-700 dark:text-white">{p.name}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${p.priority === 'Critique' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{p.priority}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-sm text-slate-500 italic">Cet actif ne supporte aucun processus critique.</p>;
                            })()}
                        </div>
                    </div>
                )}
                {inspectorTab === 'projects' && selectedAsset && (
                    <div className="space-y-8">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><FolderKanban className="h-4 w-4 mr-2" /> Projets Liés ({linkedProjects.length})</h3>
                        {linkedProjects.length === 0 ? (
                            <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun projet associé.</p>
                        ) : (
                            <div className="grid gap-4">
                                {linkedProjects.map(proj => (
                                    <div key={proj.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{proj.name}</span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${proj.status === 'En cours' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{proj.status}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{proj.description}</p>
                                        <div className="flex items-center justify-between">
                                            <div className="w-full bg-slate-200 rounded-full h-1.5 mr-4 max-w-[100px]">
                                                <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${proj.progress}%` }}></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{proj.progress}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {inspectorTab === 'audits' && selectedAsset && (
                    <div className="space-y-8">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><CheckSquare className="h-4 w-4 mr-2" /> Audits Liés ({linkedAudits.length})</h3>
                        {linkedAudits.length === 0 ? (
                            <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun audit associé.</p>
                        ) : (
                            <div className="grid gap-4">
                                {linkedAudits.map(audit => (
                                    <div key={audit.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{audit.name}</span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${audit.status === 'Terminé' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{audit.status}</span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                                <CalendarClock className="h-3 w-3" />
                                                {new Date(audit.dateScheduled).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" />
                                                {audit.findingsCount} constats
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {inspectorTab === 'documents' && selectedAsset && (
                    <div className="space-y-8">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><FileText className="h-4 w-4 mr-2" /> Documents Liés ({linkedDocuments.length})</h3>
                        {linkedDocuments.length === 0 ? (
                            <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun document associé.</p>
                        ) : (
                            <div className="grid gap-4">
                                {linkedDocuments.map(doc => (
                                    <div key={doc.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate pr-4">{doc.title}</span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${doc.status === 'Publié' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{doc.status}</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-3">
                                            <span className="text-xs text-slate-500">{doc.type} • v{doc.version}</span>
                                            <CustomTooltip content="Ouvrir le document dans un nouvel onglet">
                                                <a href={doc.url} target="_blank" rel="noreferrer" aria-label={`Voir le document ${doc.title}`} className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center">
                                                    Voir <ExternalLink className="h-3 w-3 ml-1" />
                                                </a>
                                            </CustomTooltip>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {inspectorTab === 'history' && selectedAsset && (
                    <div className="space-y-8">
                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center">
                                <History className="h-4 w-4 mr-2" /> Historique DICP
                            </h3>
                            {!selectedAsset.history || selectedAsset.history.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">Aucune modification enregistrée.</p>
                            ) : (
                                <div className="space-y-4">
                                    {selectedAsset.history.slice().reverse().map((h, i) => (
                                        <div key={`rec-${i}`} className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{new Date(h.date).toLocaleString()}</span>
                                                <span className="text-xs font-medium text-slate-500">par {h.userName}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="flex flex-col items-center p-2 rounded bg-white dark:bg-black/20">
                                                    <span className="text-[10px] text-slate-500 uppercase">Confidentialité</span>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="line-through opacity-50">{h.previousConfidentiality}</span>
                                                        <span>→</span>
                                                        <span className="font-bold">{h.newConfidentiality}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center p-2 rounded bg-white dark:bg-black/20">
                                                    <span className="text-[10px] text-slate-500 uppercase">Intégrité</span>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="line-through opacity-50">{h.previousIntegrity}</span>
                                                        <span>→</span>
                                                        <span className="font-bold">{h.newIntegrity}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center p-2 rounded bg-white dark:bg-black/20">
                                                    <span className="text-[10px] text-slate-500 uppercase">Disponibilité</span>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="line-through opacity-50">{h.previousAvailability}</span>
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
                )}

                {inspectorTab === 'graph' && selectedAsset && (
                    <div className="h-[500px]">
                        <RelationshipGraph rootId={selectedAsset.id} rootType="Asset" />
                    </div>
                )}

                {inspectorTab === 'intelligence' && selectedAsset && (
                    <div className="h-full overflow-y-auto p-6">
                        <AssetAIAssistant
                            asset={selectedAsset}
                            onUpdate={(updates) => onUpdate(selectedAsset.id, { ...selectedAsset, ...updates } as unknown as AssetFormData)}
                        />
                    </div>
                )}

                {inspectorTab === 'comments' && selectedAsset && (
                    <div className="h-full flex flex-col">
                        <CommentSection collectionName="assets" documentId={selectedAsset.id} />
                    </div>
                )}
            </div>
        </InspectorLayout>
    );
};
