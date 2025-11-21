
import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Incident, Asset, Criticality } from '../types';
import { Plus, Search, Filter, Siren, Trash2, Edit, CheckCircle2, AlertTriangle, Server } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';

export const Incidents: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const { user, addToast } = useStore();
  
  const canEdit = user?.role === 'admin' || user?.role === 'auditor';
  const [isEditing, setIsEditing] = useState(false);
  const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null);

  const [newIncident, setNewIncident] = useState<Partial<Incident>>({
    title: '',
    description: '',
    severity: Criticality.MEDIUM,
    status: 'Nouveau',
    affectedAssetId: '',
    reporter: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incSnap, astSnap] = await Promise.all([
          getDocs(query(collection(db, 'incidents'), orderBy('dateReported', 'desc'))),
          getDocs(query(collection(db, 'assets'), orderBy('name')))
      ]);
      
      setIncidents(incSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident)));
      setAssets(astSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset)));
    } catch (err) {
      addToast("Erreur chargement données", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openModal = (incident?: Incident) => {
    if(incident) {
        setNewIncident(incident);
        setCurrentIncidentId(incident.id);
        setIsEditing(true);
    } else {
        setNewIncident({
            title: '', description: '', severity: Criticality.MEDIUM,
            status: 'Nouveau', affectedAssetId: '', reporter: user?.displayName || user?.email || ''
        });
        setCurrentIncidentId(null);
        setIsEditing(false);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          if (isEditing && currentIncidentId) {
             await updateDoc(doc(db, 'incidents', currentIncidentId), newIncident as any);
             await logAction(user, 'UPDATE', 'Incident', `MAJ Incident: ${newIncident.title}`);
             addToast("Incident mis à jour", "success");
          } else {
             await addDoc(collection(db, 'incidents'), {
                 ...newIncident,
                 dateReported: new Date().toISOString()
             });
             await logAction(user, 'CREATE', 'Incident', `Nouvel Incident: ${newIncident.title}`);
             addToast("Incident déclaré", "success");
          }
          setShowModal(false);
          fetchData();
      } catch(e) { addToast("Erreur enregistrement", "error"); }
  };

  const handleDelete = async (id: string) => {
      if(!confirm("Supprimer cet incident ?")) return;
      try {
          await deleteDoc(doc(db, 'incidents', id));
          setIncidents(prev => prev.filter(i => i.id !== id));
          addToast("Incident supprimé", "info");
      } catch(e) { addToast("Erreur suppression", "error"); }
  };

  const getSeverityColor = (s: Criticality) => {
      switch(s) {
          case Criticality.CRITICAL: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
          case Criticality.HIGH: return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
          case Criticality.MEDIUM: return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
          default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      }
  };

  const getStatusColor = (s: string) => {
      switch(s) {
          case 'Nouveau': return 'bg-purple-100 text-purple-700';
          case 'Analyse': return 'bg-blue-100 text-blue-700';
          case 'Contenu': return 'bg-amber-100 text-amber-700';
          case 'Résolu': return 'bg-green-100 text-green-700';
          case 'Fermé': return 'bg-gray-100 text-gray-600 line-through opacity-70';
          default: return 'bg-gray-100 text-gray-700';
      }
  };

  const filteredIncidents = incidents.filter(i => i.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Incidents de Sécurité</h1>
                <p className="text-slate-500 dark:text-slate-400">Gestion et réponse aux incidents (ISO 27001 A.16).</p>
            </div>
            <button onClick={() => openModal()} className="flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 animate-pulse">
                <Siren className="h-4 w-4 mr-2" />
                Déclarer un Incident
            </button>
        </div>

        <div className="flex items-center space-x-4 bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <Search className="h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Rechercher..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white"
              value={filter} onChange={e => setFilter(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {loading ? <div className="col-span-full text-center">Chargement...</div> : 
             filteredIncidents.length === 0 ? <div className="col-span-full text-center py-10 text-gray-500">Aucun incident signalé.</div> :
             filteredIncidents.map(incident => (
                 <div key={incident.id} className="bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden">
                     {incident.severity === Criticality.CRITICAL && (
                         <div className="absolute top-0 right-0 p-2">
                             <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                         </div>
                     )}
                     
                     <div className="flex justify-between items-start mb-3">
                         <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityColor(incident.severity)}`}>
                             {incident.severity}
                         </span>
                         <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(incident.status)}`}>
                             {incident.status}
                         </span>
                     </div>

                     <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{incident.title}</h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 flex-1">{incident.description}</p>

                     {incident.affectedAssetId && (
                         <div className="flex items-center text-xs text-slate-500 mb-4 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg w-fit">
                             <Server className="h-3 w-3 mr-1.5"/>
                             Asset: {assets.find(a => a.id === incident.affectedAssetId)?.name || 'Inconnu'}
                         </div>
                     )}

                     <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                         <div className="text-xs text-gray-400">
                             Signalé le {new Date(incident.dateReported).toLocaleDateString()} par {incident.reporter}
                         </div>
                         <div className="flex gap-2">
                             {canEdit && (
                                 <>
                                    <button onClick={() => openModal(incident)} className="p-1.5 text-gray-400 hover:text-brand-600 bg-gray-50 dark:bg-slate-800 rounded"><Edit className="h-4 w-4"/></button>
                                    <button onClick={() => handleDelete(incident.id)} className="p-1.5 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-slate-800 rounded"><Trash2 className="h-4 w-4"/></button>
                                 </>
                             )}
                         </div>
                     </div>
                 </div>
             ))
            }
        </div>

        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-850 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-800">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-red-50 dark:bg-red-900/10">
                        <h2 className="text-xl font-bold text-red-700 dark:text-red-400 flex items-center">
                            <AlertTriangle className="h-5 w-5 mr-2"/>
                            {isEditing ? "Modifier l'incident" : "Déclarer un incident"}
                        </h2>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Titre de l'incident</label>
                            <input required type="text" className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white"
                             value={newIncident.title} onChange={e => setNewIncident({...newIncident, title: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Description détaillée</label>
                            <textarea required rows={3} className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white"
                             value={newIncident.description} onChange={e => setNewIncident({...newIncident, description: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Sévérité</label>
                                <select className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white dark:bg-slate-800"
                                 value={newIncident.severity} onChange={e => setNewIncident({...newIncident, severity: e.target.value as any})}>
                                    {Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Statut</label>
                                <select className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white dark:bg-slate-800"
                                 value={newIncident.status} onChange={e => setNewIncident({...newIncident, status: e.target.value as any})}>
                                    {['Nouveau', 'Analyse', 'Contenu', 'Résolu', 'Fermé'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Actif Impacté</label>
                            <select className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white dark:bg-slate-800"
                                value={newIncident.affectedAssetId} onChange={e => setNewIncident({...newIncident, affectedAssetId: e.target.value})}>
                                <option value="">Aucun / Inconnu</option>
                                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-500">Annuler</button>
                            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold">Enregistrer</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};