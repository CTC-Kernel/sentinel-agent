
import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Audit, Finding, Control } from '../types';
import { Plus, XCircle, Activity, FileText, Briefcase, Search, CheckCircle2, AlertTriangle, ChevronRight, Trash2 } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const Audits: React.FC = () => {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const { user, addToast } = useStore();
  
  const canEdit = user?.role === 'admin' || user?.role === 'auditor';

  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [showFindingsDrawer, setShowFindingsDrawer] = useState(false);
  const [newFinding, setNewFinding] = useState<Partial<Finding>>({ description: '', type: 'Mineure', status: 'Ouvert', relatedControlId: '' });

  const [newAudit, setNewAudit] = useState<Partial<Audit>>({
    name: '',
    type: 'Interne',
    auditor: '',
    dateScheduled: '',
    status: 'Planifié',
    findingsCount: 0
  });

  const fetchAudits = async () => {
    setLoading(true);
    try {
      const [auditsSnap, controlsSnap] = await Promise.all([
          getDocs(query(collection(db, 'audits'), orderBy('dateScheduled', 'desc'))),
          getDocs(collection(db, 'controls'))
      ]);
      setAudits(auditsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Audit)));
      
      const ctrlData = controlsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Control));
      ctrlData.sort((a,b) => a.code.localeCompare(b.code));
      setControls(ctrlData);
    } catch (err) {
      addToast("Erreur chargement données", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudits(); }, []);

  const handleOpenAudit = async (audit: Audit) => {
      setSelectedAudit(audit);
      setShowFindingsDrawer(true);
      try {
          const q = query(collection(db, 'findings'), where('auditId', '==', audit.id));
          const snap = await getDocs(q);
          setFindings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Finding)));
      } catch (error) {
          setFindings([]);
      }
  };

  const handleAddFinding = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canEdit || !selectedAudit) return;
      try {
          await addDoc(collection(db, 'findings'), {
              ...newFinding,
              auditId: selectedAudit.id,
              createdAt: new Date().toISOString()
          });
          
          const newCount = findings.length + 1;
          await updateDoc(doc(db, 'audits', selectedAudit.id), { findingsCount: newCount });
          
          setAudits(prev => prev.map(a => a.id === selectedAudit.id ? { ...a, findingsCount: newCount } : a));
          
          const q = query(collection(db, 'findings'), where('auditId', '==', selectedAudit.id));
          const snap = await getDocs(q);
          setFindings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Finding)));
          
          setNewFinding({ description: '', type: 'Mineure', status: 'Ouvert', relatedControlId: '' });
          addToast("Constat ajouté", "success");
      } catch(e) { addToast("Erreur ajout constat", "error"); }
  };
  
  const handleDeleteFinding = async (findingId: string) => {
      if(!canEdit || !selectedAudit || !confirm("Supprimer ce constat ?")) return;
      try {
          await deleteDoc(doc(db, 'findings', findingId));
          const newCount = findings.length - 1;
          await updateDoc(doc(db, 'audits', selectedAudit.id), { findingsCount: newCount });
          setAudits(prev => prev.map(a => a.id === selectedAudit.id ? { ...a, findingsCount: newCount } : a));
          setFindings(prev => prev.filter(f => f.id !== findingId));
      } catch(e) { addToast("Erreur suppression", "error"); }
  };

  const handleAddAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      await addDoc(collection(db, 'audits'), {
        ...newAudit,
        createdAt: new Date().toISOString()
      });
      await logAction(user, 'CREATE', 'Audit', `Création audit: ${newAudit.name}`);
      addToast("Audit planifié", "success");
      setShowModal(false);
      setNewAudit({ name: '', type: 'Interne', auditor: '', dateScheduled: '', status: 'Planifié', findingsCount: 0 });
      fetchAudits();
    } catch (error) {
      addToast("Erreur création audit", "error");
    }
  };

  const deleteAudit = async (id: string) => {
      if (!canEdit) return;
      if(!confirm("Supprimer cet audit ?")) return;
      try {
          await deleteDoc(doc(db, 'audits', id));
          await logAction(user, 'DELETE', 'Audit', `Suppression audit ID: ${id}`);
          setAudits(prev => prev.filter(a => a.id !== id));
          addToast("Audit supprimé", "info");
      } catch(e) { addToast("Erreur suppression", "error"); }
  };

  const generateAuditReport = async (audit: Audit) => {
      let reportFindings: Finding[] = [];
      try {
          const q = query(collection(db, 'findings'), where('auditId', '==', audit.id));
          const snap = await getDocs(q);
          reportFindings = snap.docs.map(d => ({ id: d.id, ...d.data() } as Finding));
      } catch(e) { console.warn("Could not fetch findings for report"); }

      const doc = new jsPDF();
      
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text(`Rapport d'Audit: ${audit.name}`, 14, 25);
      doc.setFontSize(11);
      doc.setTextColor(148, 163, 184);
      doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, 160, 25);
      
      (doc as any).autoTable({
          startY: 50,
          head: [['Champs', 'Détail']],
          body: [
              ['Type', audit.type],
              ['Auditeur', audit.auditor],
              ['Date', audit.dateScheduled],
              ['Statut', audit.status],
              ['Nombre d\'écarts', audit.findingsCount]
          ],
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;
      
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("Détail des Constats (Non-conformités)", 14, finalY);

      if (reportFindings.length > 0) {
          const findingRows = reportFindings.map(f => {
              const ctrl = controls.find(c => c.id === f.relatedControlId);
              return [f.description, f.type, f.status, ctrl ? ctrl.code : '-'];
          });
          (doc as any).autoTable({
              startY: finalY + 5,
              head: [['Description', 'Type', 'Statut', 'Contrôle ISO']],
              body: findingRows,
              theme: 'striped',
              headStyles: { fillColor: [244, 63, 94] }
          });
      } else {
          doc.setFontSize(10);
          doc.setTextColor(100);
          doc.text("Aucun écart relevé pour cet audit.", 14, finalY + 10);
      }

      doc.save(`Rapport_Audit_${audit.name.replace(/\s+/g, '_')}.pdf`);
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'Terminé': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Validé': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'En cours': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-400';
    }
  };

  const filteredAudits = audits.filter(a => 
      a.name.toLowerCase().includes(filter.toLowerCase()) || 
      a.auditor.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestion des Audits</h1>
          <p className="text-slate-500 dark:text-slate-400">Planification et suivi des audits internes et de certification.</p>
        </div>
        {canEdit && (
            <button 
              onClick={() => setShowModal(true)}
              className="flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              Planifier un Audit
            </button>
        )}
      </div>

      <div className="flex items-center space-x-4 bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <Search className="h-5 w-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Rechercher un audit par nom ou auditeur..." 
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white"
            value={filter} onChange={e => setFilter(e.target.value)}
          />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
            <div className="col-span-full text-center py-10 text-gray-500">Chargement des audits...</div>
        ) : filteredAudits.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-white dark:bg-slate-850 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3"/>
                <p className="text-gray-500">Aucun audit trouvé.</p>
            </div>
        ) : (
            filteredAudits.map(audit => (
                <div key={audit.id} className="bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${getStatusColor(audit.status)}`}>
                            {audit.status}
                        </div>
                        {canEdit && (
                            <div className="flex items-center space-x-1">
                                <button onClick={() => deleteAudit(audit.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50">
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 truncate" title={audit.name}>{audit.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mb-4">
                        <Briefcase className="h-3 w-3 mr-1.5" />
                        {audit.type}
                    </p>
                    
                    <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4 mb-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Auditeur</span>
                            <span className="font-medium text-slate-900 dark:text-white">{audit.auditor}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Date</span>
                            <span className="font-medium text-slate-900 dark:text-white">{audit.dateScheduled}</span>
                        </div>
                         <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Écarts (NC)</span>
                            <span className={`font-bold ${audit.findingsCount > 0 ? 'text-red-500' : 'text-green-500'}`}>{audit.findingsCount}</span>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleOpenAudit(audit)}
                            className="flex-1 py-2 border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-lg text-sm font-medium hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                        >
                            {canEdit ? 'Gérer les écarts' : 'Voir les écarts'}
                        </button>
                        <button 
                            onClick={() => generateAuditReport(audit)}
                            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                            title="Télécharger Rapport"
                        >
                            <FileText className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* Create Audit Modal */}
      {showModal && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-850 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-800">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nouvel Audit</h2>
            </div>
            <form onSubmit={handleAddAudit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom de l'audit</label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-white" 
                  value={newAudit.name} onChange={e => setNewAudit({...newAudit, name: e.target.value})} placeholder="ex: Audit Annuel ISO 27001" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                    <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-white dark:bg-slate-800"
                      value={newAudit.type} onChange={e => setNewAudit({...newAudit, type: e.target.value as any})}>
                      {['Interne', 'Externe', 'Certification'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date Prévue</label>
                    <input type="date" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-white"
                       value={newAudit.dateScheduled} onChange={e => setNewAudit({...newAudit, dateScheduled: e.target.value})} />
                 </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Auditeur Responsable</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-white" 
                  value={newAudit.auditor} onChange={e => setNewAudit({...newAudit, auditor: e.target.value})} />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">Planifier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Findings Drawer */}
      {showFindingsDrawer && selectedAudit && (
          <div className="fixed inset-0 z-40 overflow-hidden">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowFindingsDrawer(false)} />
              <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
                  <div className="w-screen max-w-md">
                      <div className="h-full flex flex-col bg-white dark:bg-slate-900 shadow-xl animate-slide-up">
                          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
                              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Constats d'audit</h2>
                              <button onClick={() => setShowFindingsDrawer(false)} className="text-gray-400 hover:text-gray-500">
                                  <ChevronRight className="h-6 w-6" />
                              </button>
                          </div>
                          
                          <div className="flex-1 py-6 overflow-y-auto px-4 sm:px-6">
                              <p className="text-sm text-gray-500 mb-4">Audit : <span className="font-medium text-slate-900 dark:text-white">{selectedAudit.name}</span></p>
                              
                              {/* Add Finding Form */}
                              {canEdit && (
                                  <form onSubmit={handleAddFinding} className="mb-6 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                                      <h3 className="text-xs font-bold uppercase text-gray-500">Ajouter un constat</h3>
                                      <textarea 
                                        required
                                        placeholder="Description de l'écart..."
                                        className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-gray-700 dark:text-white"
                                        value={newFinding.description}
                                        onChange={e => setNewFinding({...newFinding, description: e.target.value})}
                                      />
                                      
                                      {/* Link to Control */}
                                      <div>
                                          <label className="block text-xs text-gray-400 mb-1">Lier à un contrôle (optionnel)</label>
                                          <select 
                                            className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-gray-700 dark:text-white"
                                            value={newFinding.relatedControlId}
                                            onChange={e => setNewFinding({...newFinding, relatedControlId: e.target.value})}
                                          >
                                              <option value="">Aucun contrôle</option>
                                              {controls.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                                          </select>
                                      </div>

                                      <div className="flex gap-2">
                                          <select 
                                            className="text-sm p-2 border rounded dark:bg-slate-800 dark:border-gray-700 dark:text-white flex-1"
                                            value={newFinding.type}
                                            onChange={e => setNewFinding({...newFinding, type: e.target.value as any})}
                                          >
                                              <option value="Majeure">NC Majeure</option>
                                              <option value="Mineure">NC Mineure</option>
                                              <option value="Observation">Observation</option>
                                              <option value="Opportunité">Opportunité</option>
                                          </select>
                                          <button type="submit" className="px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded hover:bg-brand-700">Ajouter</button>
                                      </div>
                                  </form>
                              )}

                              {/* Findings List */}
                              <div className="space-y-3">
                                  {findings.length === 0 ? (
                                      <p className="text-center text-gray-400 text-sm italic">Aucun constat enregistré.</p>
                                  ) : (
                                      findings.map(f => {
                                          const relatedControl = controls.find(c => c.id === f.relatedControlId);
                                          return (
                                          <div key={f.id} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-start group hover:shadow-sm">
                                              <div>
                                                  <div className="flex items-center gap-2 mb-1">
                                                      <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                                                          f.type === 'Majeure' ? 'bg-red-100 text-red-700' :
                                                          f.type === 'Mineure' ? 'bg-orange-100 text-orange-700' :
                                                          'bg-blue-100 text-blue-700'
                                                      }`}>
                                                          {f.type}
                                                      </span>
                                                      <span className="text-xs text-gray-400">{new Date(f.createdAt).toLocaleDateString()}</span>
                                                  </div>
                                                  <p className="text-sm text-slate-800 dark:text-slate-200">{f.description}</p>
                                                  {relatedControl && (
                                                      <span className="mt-1 inline-flex items-center px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded">
                                                          Lié: {relatedControl.code}
                                                      </span>
                                                  )}
                                              </div>
                                              {canEdit && (
                                                  <button onClick={() => handleDeleteFinding(f.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                      <Trash2 className="h-4 w-4" />
                                                  </button>
                                              )}
                                          </div>
                                      )})
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
