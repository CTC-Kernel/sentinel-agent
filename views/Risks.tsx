
import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Risk, Control, Asset } from '../types';
import { Plus, Trash2, Edit, Search, CheckCircle2, ShieldAlert, Filter, Server, ArrowRight } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';

export const Risks: React.FC = () => {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const { user, addToast } = useStore();
  
  // RBAC
  const canEdit = user?.role === 'admin';

  const [isEditing, setIsEditing] = useState(false);
  const [currentRiskId, setCurrentRiskId] = useState<string | null>(null);

  const [newRisk, setNewRisk] = useState<Partial<Risk>>({
    assetId: '',
    threat: '',
    vulnerability: '',
    probability: 3,
    impact: 3,
    residualProbability: 3,
    residualImpact: 3,
    strategy: 'Atténuer',
    status: 'Ouvert',
    owner: '',
    mitigationControlIds: []
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [risksSnap, controlsSnap, assetsSnap] = await Promise.all([
          getDocs(query(collection(db, 'risks'), orderBy('score', 'desc'))),
          getDocs(collection(db, 'controls')),
          getDocs(query(collection(db, 'assets'), orderBy('name')))
      ]);
      
      const riskData = risksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Risk));
      setRisks(riskData);

      const controlData = controlsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Control));
      controlData.sort((a, b) => a.code.localeCompare(b.code));
      setControls(controlData);

      const assetData = assetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
      setAssets(assetData);

    } catch(err) {
      console.warn("Impossible de récupérer les données.");
      addToast("Erreur chargement données", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = (risk?: Risk) => {
    if (!canEdit && !risk) return;
    if(risk) {
      setIsEditing(true);
      setCurrentRiskId(risk.id);
      setNewRisk({ 
          ...risk, 
          mitigationControlIds: risk.mitigationControlIds || [],
          residualProbability: risk.residualProbability || risk.probability,
          residualImpact: risk.residualImpact || risk.impact
      });
    } else {
      setIsEditing(false);
      setCurrentRiskId(null);
      setNewRisk({ 
          assetId: '', threat: '', vulnerability: '', 
          probability: 3, impact: 3, 
          residualProbability: 3, residualImpact: 3,
          strategy: 'Atténuer', status: 'Ouvert', owner: '', mitigationControlIds: [] 
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    
    const score = (newRisk.probability || 1) * (newRisk.impact || 1);
    const residualScore = (newRisk.residualProbability || newRisk.probability || 1) * (newRisk.residualImpact || newRisk.impact || 1);

    try {
      if (isEditing && currentRiskId) {
          const oldRisk = risks.find(r => r.id === currentRiskId);
          const previousScore = oldRisk ? oldRisk.score : undefined;

          const { id, ...dataToUpdate } = newRisk as any;
          await updateDoc(doc(db, 'risks', currentRiskId), { ...dataToUpdate, score, residualScore, previousScore });
          await logAction(user, 'UPDATE', 'Risk', `Modification risque: ${newRisk.threat} (Score: ${score} -> ${residualScore})`);
          addToast("Risque mis à jour", "success");
      } else {
          await addDoc(collection(db, 'risks'), {
            ...newRisk,
            score,
            residualScore,
            previousScore: score, // Initialement, pas de tendance
            createdAt: new Date().toISOString()
          });
          await logAction(user, 'CREATE', 'Risk', `Ajout risque: ${newRisk.threat}`);
          addToast("Risque ajouté", "success");
      }
      setShowModal(false);
      fetchData(); 
    } catch (error) {
      addToast("Erreur lors de l'enregistrement", "error");
    }
  };

  const handleDeleteRisk = async (id: string, threat: string) => {
      if (!canEdit) return;
      if(!confirm("Supprimer ce risque ?")) return;
      try {
          await deleteDoc(doc(db, 'risks', id));
          await logAction(user, 'DELETE', 'Risk', `Suppression risque: ${threat}`);
          setRisks(prev => prev.filter(r => r.id !== id));
          addToast("Risque supprimé", "info");
      } catch(e) { addToast("Erreur suppression", "error"); }
  };

  const handleStatusChange = async (risk: Risk, newStatus: Risk['status']) => {
      if (!canEdit) return;
      try {
          await updateDoc(doc(db, 'risks', risk.id), { status: newStatus });
          setRisks(prev => prev.map(r => r.id === risk.id ? { ...r, status: newStatus } : r));
          addToast(`Statut changé : ${newStatus}`, "success");
      } catch(e) { console.error(e); }
  };

  const toggleControlSelection = (controlId: string) => {
      const currentIds = newRisk.mitigationControlIds || [];
      if (currentIds.includes(controlId)) {
          setNewRisk({ ...newRisk, mitigationControlIds: currentIds.filter(id => id !== controlId) });
      } else {
          setNewRisk({ ...newRisk, mitigationControlIds: [...currentIds, controlId] });
      }
  };

  const getRiskLevel = (score: number) => {
    if (score >= 15) return { label: 'Critique', color: 'bg-rose-500 text-white shadow-rose-500/30' };
    if (score >= 10) return { label: 'Élevé', color: 'bg-orange-500 text-white shadow-orange-500/30' };
    if (score >= 5) return { label: 'Moyen', color: 'bg-amber-400 text-white shadow-amber-400/30' };
    return { label: 'Faible', color: 'bg-emerald-500 text-white shadow-emerald-500/30' };
  };

  const getAssetName = (id?: string) => assets.find(a => a.id === id)?.name || 'Actif inconnu';

  const filteredRisks = risks.filter(r => 
      r.threat.toLowerCase().includes(filter.toLowerCase()) || 
      r.vulnerability.toLowerCase().includes(filter.toLowerCase())
  );

  const getTrendIcon = (current: number, previous?: number) => {
      if (previous === undefined || current === previous) return null;
      if (current > previous) return <span className="text-red-500 text-[10px] font-bold ml-1" title="Risque en hausse">↗</span>;
      if (current < previous) return <span className="text-green-500 text-[10px] font-bold ml-1" title="Risque en baisse">↘</span>;
      return null;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Registre des Risques</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Cartographie et traitement des menaces ISO 27005.</p>
        </div>
        {canEdit && (
            <button 
              onClick={() => openModal()}
              className="group flex items-center px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold rounded-xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 dark:shadow-none"
            >
              <Plus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
              Nouveau Risque
            </button>
        )}
      </div>

      <div className="flex items-center space-x-4 bg-white dark:bg-slate-800/50 p-1.5 pl-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-shadow">
          <Search className="h-5 w-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Rechercher une menace..." 
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 placeholder-gray-400"
            value={filter} onChange={e => setFilter(e.target.value)}
          />
          <button className="p-2.5 bg-gray-100 dark:bg-slate-700 rounded-xl text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors">
              <Filter className="h-4 w-4" />
          </button>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {filteredRisks.map(risk => {
            const level = getRiskLevel(risk.score);
            // Logic for residual risk display
            const residualScore = risk.residualScore || risk.score;
            const isMitigated = residualScore < risk.score;
            const residualLevel = getRiskLevel(residualScore);

            return (
                <div key={risk.id} className="group bg-white dark:bg-slate-800 rounded-[1.5rem] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                            <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm flex items-center ${level.color}`}>
                                {level.label} {risk.score}
                                {getTrendIcon(risk.score, risk.previousScore)}
                            </div>
                            {isMitigated && (
                                <>
                                    <ArrowRight className="w-3 h-3 text-gray-400" />
                                    <div className={`px-2 py-1 text-[10px] font-bold rounded-full border ${residualLevel.color.replace('text-white', 'text-slate-900 dark:text-white').replace('bg-', 'border-').replace('shadow-', 'nothing')}`}>
                                        Résiduel: {residualScore}
                                    </div>
                                </>
                            )}
                        </div>
                        {canEdit && (
                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button onClick={() => openModal(risk)} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-full text-slate-400 hover:text-brand-600 transition-colors"><Edit className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleDeleteRisk(risk.id, risk.threat)} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-full text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                        )}
                    </div>

                    <div className="mb-4 flex-1">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                            <Server className="w-3 h-3 mr-1.5" />
                            {getAssetName(risk.assetId)}
                         </p>
                         <h4 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-2">{risk.threat}</h4>
                         <p className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg inline-block">
                            Vuln.: {risk.vulnerability}
                         </p>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-dashed border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                            {risk.mitigationControlIds && risk.mitigationControlIds.length > 0 ? (
                                risk.mitigationControlIds.map(cid => {
                                    const c = controls.find(ctrl => ctrl.id === cid);
                                    return c ? (
                                        <span key={cid} className="flex-shrink-0 text-[10px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-2 py-1 rounded-md border border-brand-100 dark:border-brand-800/30" title={c.name}>
                                            {c.code}
                                        </span>
                                    ) : null;
                                })
                            ) : (
                                <span className="text-xs text-slate-400 italic flex items-center"><ShieldAlert className="h-3 w-3 mr-1"/>Aucun contrôle</span>
                            )}
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">{risk.strategy}</span>
                            {canEdit ? (
                                <select 
                                    value={risk.status} 
                                    onChange={(e) => handleStatusChange(risk, e.target.value as any)}
                                    className={`text-xs font-bold border-none bg-transparent focus:ring-0 cursor-pointer py-0 pr-6 ${risk.status === 'Ouvert' ? 'text-rose-500' : risk.status === 'En cours' ? 'text-amber-500' : 'text-emerald-500'}`}
                                >
                                    <option value="Ouvert">Ouvert</option>
                                    <option value="En cours">En cours</option>
                                    <option value="Fermé">Fermé</option>
                                </select>
                            ) : (
                                <span className={`text-xs font-bold ${risk.status === 'Ouvert' ? 'text-rose-500' : risk.status === 'En cours' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {risk.status}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )
        })}
      </div>

      {showModal && canEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-900/50">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{isEditing ? 'Modifier le risque' : 'Nouveau Risque'}</h2>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Actif concerné</label>
                                <select 
                                    required
                                    className="w-full px-4 py-3 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-brand-500 dark:text-white transition-shadow"
                                    value={newRisk.assetId}
                                    onChange={e => setNewRisk({...newRisk, assetId: e.target.value})}
                                >
                                    <option value="">Sélectionner...</option>
                                    {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Menace</label>
                                <textarea required rows={2} className="w-full px-4 py-3 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-brand-500 dark:text-white" 
                                    value={newRisk.threat} onChange={e=>setNewRisk({...newRisk, threat: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Vulnérabilité</label>
                                <input required className="w-full px-4 py-3 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-brand-500 dark:text-white" 
                                    value={newRisk.vulnerability} onChange={e=>setNewRisk({...newRisk, vulnerability: e.target.value})} />
                            </div>
                            
                            {/* Brut Risk */}
                            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                                <h4 className="text-xs font-bold uppercase text-red-600 mb-3">Risque Brut (Avant traitement)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Probabilité</label>
                                        <input type="number" min="1" max="5" className="w-full px-3 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-sm font-bold text-center"
                                        value={newRisk.probability} onChange={e=>setNewRisk({...newRisk, probability: parseInt(e.target.value) as any})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Impact</label>
                                        <input type="number" min="1" max="5" className="w-full px-3 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-sm font-bold text-center"
                                        value={newRisk.impact} onChange={e=>setNewRisk({...newRisk, impact: parseInt(e.target.value) as any})} />
                                    </div>
                                </div>
                            </div>

                            {/* Residual Risk */}
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                                <h4 className="text-xs font-bold uppercase text-emerald-600 mb-3">Risque Résiduel (Après traitement)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Probabilité</label>
                                        <input type="number" min="1" max="5" className="w-full px-3 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-sm font-bold text-center"
                                        value={newRisk.residualProbability || newRisk.probability} onChange={e=>setNewRisk({...newRisk, residualProbability: parseInt(e.target.value) as any})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Impact</label>
                                        <input type="number" min="1" max="5" className="w-full px-3 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-sm font-bold text-center"
                                        value={newRisk.residualImpact || newRisk.impact} onChange={e=>setNewRisk({...newRisk, residualImpact: parseInt(e.target.value) as any})} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700 flex flex-col h-full">
                            <label className="flex items-center text-xs font-bold uppercase tracking-wider text-brand-600 mb-3">
                                <CheckCircle2 className="h-4 w-4 mr-2"/>
                                Contrôles d'atténuation
                            </label>
                            
                            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar max-h-[280px]">
                                {controls.map(ctrl => (
                                    <label key={ctrl.id} className={`flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-all border ${newRisk.mitigationControlIds?.includes(ctrl.id) ? 'bg-white dark:bg-slate-800 border-brand-200 dark:border-brand-800 shadow-sm' : 'border-transparent hover:bg-white dark:hover:bg-slate-800'}`}>
                                        <input 
                                            type="checkbox" 
                                            className="mt-1 rounded-full border-gray-300 text-brand-600 focus:ring-brand-500"
                                            checked={newRisk.mitigationControlIds?.includes(ctrl.id)}
                                            onChange={() => toggleControlSelection(ctrl.id)}
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-900 dark:text-white block">{ctrl.code}</span>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">{ctrl.name}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-4 pt-8 mt-4 border-t border-gray-100 dark:border-gray-700">
                        <button type="button" onClick={()=>setShowModal(false)} className="px-6 py-3 text-sm font-medium text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors">Annuler</button>
                        <button type="submit" className="px-8 py-3 text-sm font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform shadow-xl shadow-slate-900/20 dark:shadow-none">
                            {isEditing ? 'Enregistrer les modifications' : 'Créer le Risque'}
                        </button>
                    </div>
                </form>
            </div>
          </div>
      )}
    </div>
  );
};
