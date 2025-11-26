import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Keep original db path
import { useStore } from '../store';
import { Incident, Asset, Risk, UserProfile, Criticality } from '../types';
import { IncidentDashboard } from '../components/incidents/IncidentDashboard';
import { IncidentPlaybookModal } from '../components/incidents/IncidentPlaybookModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { logAction } from '../services/logger';
import { sendEmail } from '../services/emailService';
import { getIncidentAlertTemplate } from '../services/emailTemplates'; // Changed path

import { AIAssistButton } from '../components/ai/AIAssistButton';

const PLAYBOOKS: Record<string, string[]> = {
    'Ransomware': ['Déconnecter la machine', 'Ne PAS éteindre', 'Photo de la rançon', 'Vérifier backups', 'Identifier malware', 'Isoler partages', 'Déclarer CNIL', 'Restaurer'],
    'Phishing': ['Changer mot de passe', 'Activer MFA', 'Scanner règles email', 'Purger email', 'Vérifier logs', 'Rappel utilisateurs'],
    'Vol Matériel': ['Effacement à distance', 'Révoquer certificats', 'Changer MDP locaux', 'Plainte police', 'Assurance'],
    'Indisponibilité': ['Vérifier élec/ondulateur', 'Ping/Traceroute', 'Basculer lien secours', 'Contacter FAI', 'Activer PCA > 4h'],
    'Fuite de Données': ['Identifier source', 'Colmater brèche', 'Lister données', 'Qualifier sensibilité', 'Notifier personnes', 'Notifier CNIL'],
    'Autre': ['Documenter faits', 'Qualifier impact', 'Prévenir RSSI', 'Sauvegarder logs', 'Sécuriser preuves']
};

export const Incidents: React.FC = () => {
    const { user, addToast } = useStore(); // addToast destructured from useStore
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null);
    const [newIncident, setNewIncident] = useState<Partial<Incident>>({});
    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const fetchData = async () => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'incidents'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId)))
            ]);

            const getDocsData = <T,>(result: PromiseSettledResult<any>): T[] => {
                if (result.status === 'fulfilled') {
                    return result.value.docs.map((d: any) => ({ id: d.id, ...d.data() })) as T[];
                }
                return [];
            };

            const data = getDocsData<Incident>(results[0]);
            data.sort((a, b) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime());
            setIncidents(data);

            const assetData = getDocsData<Asset>(results[1]);
            assetData.sort((a, b) => a.name.localeCompare(b.name));
            setAssets(assetData);

            const riskData = getDocsData<Risk>(results[2]);
            riskData.sort((a, b) => a.threat.localeCompare(b.threat));
            setRisks(riskData);

            const userData = getDocsData<UserProfile>(results[3]);
            setUsersList(userData);
        } catch (_err) {
            addToast("Erreur chargement données", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [user?.organizationId]);

    const openModal = (incident?: Incident) => {
        if (incident) { setNewIncident(incident); setCurrentIncidentId(incident.id); setIsEditing(true); }
        else { setNewIncident({ title: '', description: '', severity: Criticality.MEDIUM, status: 'Nouveau', category: 'Autre', playbookStepsCompleted: [], affectedAssetId: '', relatedRiskId: '', reporter: user?.displayName || user?.email || '', financialImpact: 0 }); setCurrentIncidentId(null); setIsEditing(false); }
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.organizationId) return;
        try {
            const incidentData = { ...newIncident };
            const now = new Date().toISOString();

            if (incidentData.status === 'Analyse' && !incidentData.dateAnalysis) incidentData.dateAnalysis = now;
            if (incidentData.status === 'Contenu' && !incidentData.dateContained) incidentData.dateContained = now;
            if ((incidentData.status === 'Résolu' || incidentData.status === 'Fermé') && !incidentData.dateResolved) incidentData.dateResolved = now;

            if (isEditing && currentIncidentId) {
                await updateDoc(doc(db, 'incidents', currentIncidentId), incidentData as any);
                await logAction(user, 'UPDATE', 'Incident', `MAJ Incident: ${newIncident.title}`);
                addToast("Incident mis à jour", "success");
                if (selectedIncident?.id === currentIncidentId) setSelectedIncident({ ...selectedIncident, ...incidentData } as Incident);
            } else {
                await addDoc(collection(db, 'incidents'), { ...incidentData, organizationId: user.organizationId, dateReported: new Date().toISOString() });
                await logAction(user, 'CREATE', 'Incident', `Nouvel Incident: ${newIncident.title}`);

                const incidentLink = `${window.location.origin}/#/incidents`;
                const htmlContent = getIncidentAlertTemplate(newIncident.title || 'Incident', newIncident.severity || 'Moyenne', user?.displayName || 'Utilisateur', incidentLink);
                await sendEmail(user, { to: 'rssi@sentinel.local', subject: `[ALERTE SÉCURITÉ] ${newIncident.severity?.toUpperCase()} - ${newIncident.title}`, type: 'INCIDENT_ALERT', html: htmlContent });
                addToast("Incident déclaré (Alerte envoyée)", "success");
            }
            setShowModal(false);
            fetchData();
        } catch (error) { addToast("Erreur enregistrement", "error"); }
    };

    const initiateDelete = (id: string) => { setConfirmData({ isOpen: true, title: "Supprimer l'incident ?", message: "Cette action est définitive.", onConfirm: () => handleDelete(id) }); };
    const handleDelete = async (id: string) => { try { await deleteDoc(doc(db, 'incidents', id)); setIncidents(prev => prev.filter(i => i.id !== id)); if (selectedIncident?.id === id) setSelectedIncident(null); addToast("Incident supprimé", "info"); fetchData(); } catch (error) { addToast("Erreur suppression", "error"); } };

    return (
        <div className="space-y-8 animate-fade-in pb-10 relative">
            <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData({ ...confirmData, isOpen: false })} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} />
            <IncidentDashboard
                incidents={incidents}
                onCreate={() => openModal()}
                onSelect={(inc: Incident) => setSelectedIncident(inc)}
                loading={loading}
                onDelete={initiateDelete}
            />

            {/* Create/Edit Modal */}
            <IncidentPlaybookModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={isEditing ? "Modifier l'incident" : "Déclarer un incident"}
            >
                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Titre de l'incident</label>
                        <input required type="text" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium" value={newIncident.title} onChange={e => setNewIncident({ ...newIncident, title: e.target.value })} placeholder="Ex: Attaque Ransomware sur Serveur RH" />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Description détaillée</label>
                            <AIAssistButton
                                context={{
                                    title: newIncident.title,
                                    category: newIncident.category,
                                    severity: newIncident.severity,
                                    affectedAsset: assets.find(a => a.id === newIncident.affectedAssetId)?.name
                                }}
                                fieldName="description"
                                onSuggest={(val: string) => setNewIncident({ ...newIncident, description: val })}
                                prompt="Rédige une description détaillée et professionnelle pour cet incident de sécurité. Inclus les éléments factuels probables basés sur le titre et la catégorie."
                            />
                        </div>
                        <textarea required rows={4} className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium resize-none" value={newIncident.description} onChange={e => setNewIncident({ ...newIncident, description: e.target.value })} placeholder="Décrivez les faits, l'heure de découverte, les symptômes..." />
                    </div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Catégorie (Playbook)</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.category} onChange={e => setNewIncident({ ...newIncident, category: e.target.value as any })}>{Object.keys(PLAYBOOKS).map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Sévérité</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.severity} onChange={e => setNewIncident({ ...newIncident, severity: e.target.value as any })}>{Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}</select></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.status} onChange={e => setNewIncident({ ...newIncident, status: e.target.value as any })}>{['Nouveau', 'Analyse', 'Contenu', 'Résolu', 'Fermé'].map(s => <option key={s} value={s}>{s}</option>)}</select></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Actif Impacté</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.affectedAssetId} onChange={e => setNewIncident({ ...newIncident, affectedAssetId: e.target.value })}><option value="">Aucun / Inconnu</option>{assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Lier à un Risque Identifié</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.relatedRiskId} onChange={e => setNewIncident({ ...newIncident, relatedRiskId: e.target.value })}><option value="">Non lié</option>{risks.map(r => <option key={r.id} value={r.id}>{r.threat} (Score: {r.score})</option>)}</select></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Déclaré par</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.reporter} onChange={e => setNewIncident({ ...newIncident, reporter: e.target.value })}><option value="">Sélectionner...</option>{usersList.map(u => <option key={u.uid} value={u.displayName}>{u.displayName}</option>)}</select></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Coût estimé (€)</label><input type="number" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium" value={newIncident.financialImpact || ''} onChange={e => setNewIncident({ ...newIncident, financialImpact: parseFloat(e.target.value) })} placeholder="0.00" /></div></div><div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                        <button type="submit" className="px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-sm shadow-lg shadow-red-500/20 hover:scale-105 transition-all">Enregistrer</button>
                    </div>
                </form>
            </IncidentPlaybookModal>
        </div>
    );
};
