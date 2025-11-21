
import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Control, Document, Risk, Finding } from '../types';
import { CheckCircle2, FileText, AlertTriangle, Download, Paperclip, Link, ExternalLink, ShieldAlert, AlertOctagon } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const ISO_SEED_CONTROLS = [
    { code: 'A.5.1', name: 'Politiques de sécurité de l\'information' },
    { code: 'A.5.2', name: 'Rôles et responsabilités en matière de sécurité' },
    { code: 'A.5.3', name: 'Séparation des tâches' },
    { code: 'A.5.4', name: 'Responsabilités de la direction' },
    { code: 'A.5.5', name: 'Contact avec les autorités' },
    { code: 'A.5.6', name: 'Contact avec des groupes d\'intérêt spécial' },
    { code: 'A.5.7', name: 'Renseignement sur la menace' },
    { code: 'A.6.1', name: 'Filtrage' },
    { code: 'A.6.2', name: 'Termes et conditions d\'emploi' },
    { code: 'A.6.3', name: 'Sensibilisation, éducation et formation' },
    { code: 'A.7.1', name: 'Actifs physiques' },
    { code: 'A.8.1', name: 'Périphériques utilisateur' },
    { code: 'A.8.2', name: 'Droits d\'accès privilégiés' },
    { code: 'A.9.1', name: 'Contrôle d\'accès' },
    { code: 'A.10.1', name: 'Cryptographie' }
];

export const Compliance: React.FC = () => {
  const [controls, setControls] = useState<Control[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useStore();
  
  const [selectedControl, setSelectedControl] = useState<Control | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ctrlSnap, docSnap, riskSnap, findingSnap] = await Promise.all([
          getDocs(collection(db, 'controls')),
          getDocs(collection(db, 'documents')),
          getDocs(collection(db, 'risks')),
          getDocs(collection(db, 'findings'))
      ]);

      setDocuments(docSnap.docs.map(d => ({ id: d.id, ...d.data() } as Document)));
      setRisks(riskSnap.docs.map(d => ({ id: d.id, ...d.data() } as Risk)));
      setFindings(findingSnap.docs.map(d => ({ id: d.id, ...d.data() } as Finding)));

      if (ctrlSnap.empty) {
        const batch = writeBatch(db);
        const newControls: Control[] = [];
        ISO_SEED_CONTROLS.forEach(c => {
            const docRef = doc(collection(db, 'controls'));
            const controlData: any = {
                code: c.code,
                name: c.name,
                status: 'Non commencé',
                lastUpdated: new Date().toISOString(),
                evidenceIds: []
            };
            batch.set(docRef, controlData);
            newControls.push({ id: docRef.id, ...controlData });
        });
        await batch.commit();
        setControls(newControls);
      } else {
        const data = ctrlSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Control));
        data.sort((a, b) => a.code.localeCompare(b.code));
        setControls(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleStatus = async (control: Control) => {
      const statuses: Control['status'][] = ['Non commencé', 'Partiel', 'Implémenté', 'Non applicable', 'Exclu'];
      const nextStatus = statuses[(statuses.indexOf(control.status) + 1) % statuses.length];
      try {
          await updateDoc(doc(db, 'controls', control.id), { status: nextStatus, lastUpdated: new Date().toISOString() });
          setControls(prev => prev.map(c => c.id === control.id ? { ...c, status: nextStatus } : c));
      } catch (e) { alert("Erreur MAJ statut"); }
  };

  const linkDocument = async (docId: string) => {
      if(!selectedControl) return;
      try {
          await updateDoc(doc(db, 'controls', selectedControl.id), {
              evidenceIds: arrayUnion(docId)
          });
          setControls(prev => prev.map(c => {
              if(c.id === selectedControl.id) {
                  return { ...c, evidenceIds: [...(c.evidenceIds || []), docId] };
              }
              return c;
          }));
          setShowLinkModal(false);
          await logAction(user, 'LINK', 'Compliance', `Preuve liée au contrôle ${selectedControl.code}`);
      } catch(e) { alert("Erreur lors de la liaison"); }
  };

  const handleExportCSV = () => {
    const headers = ["Code", "Contrôle", "Statut", "Preuves (Nb)", "Risques Couverts (Nb)", "Constats Ouverts (Nb)", "Dernière MAJ"];
    const rows = controls.map(c => {
        const riskCount = risks.filter(r => r.mitigationControlIds?.includes(c.id)).length;
        const findingsCount = findings.filter(f => f.relatedControlId === c.id && f.status === 'Ouvert').length;
        return [c.code, c.name, c.status, (c.evidenceIds?.length || 0).toString(), riskCount.toString(), findingsCount.toString(), c.lastUpdated || ''];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'soa_export.csv';
    link.click();
  };

  const generateSoAPDF = () => {
    const doc = new jsPDF();
    
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("Déclaration d'Applicabilité (SoA)", 14, 25);
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`ISO/IEC 27001:2022 | ${new Date().toLocaleDateString()}`, 14, 32);

    const tableData = controls.map(c => [
        c.code,
        c.name,
        c.status,
        `${c.evidenceIds?.length || 0} preuves`
    ]);

    (doc as any).autoTable({
        startY: 50,
        head: [['Code', 'Mesure de sécurité', 'Statut', 'Justification/Preuves']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 25 }, 2: { cellWidth: 30 } }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Sentinel GRC - Document Confidentiel - Page ${i}/${pageCount}`, 105, 290, { align: "center" });
    }

    doc.save(`SoA_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getStatusColor = (s: string) => {
      switch(s) {
          case 'Implémenté': return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
          case 'Partiel': return 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';
          case 'Non applicable': return 'text-gray-400 bg-gray-50 border-gray-200 dark:bg-slate-800 dark:text-gray-500 dark:border-gray-700';
          case 'Exclu': return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
          default: return 'text-slate-600 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
      }
  };

  const getRiskCountForControl = (controlId: string) => {
      return risks.filter(r => r.mitigationControlIds?.includes(controlId)).length;
  };

  const getFindingsCountForControl = (controlId: string) => {
      return findings.filter(f => f.relatedControlId === controlId && f.status === 'Ouvert').length;
  };

  const stats = {
      total: controls.length,
      implemented: controls.filter(c => c.status === 'Implémenté').length,
      partial: controls.filter(c => c.status === 'Partiel').length,
      excluded: controls.filter(c => c.status === 'Exclu' || c.status === 'Non applicable').length
  };
  const score = stats.total > 0 ? Math.round((stats.implemented / (stats.total - stats.excluded)) * 100) || 0 : 0;

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Déclaration d'Applicabilité (DdA)</h1>
                <p className="text-slate-500 dark:text-slate-400">Suivi de conformité ISO/IEC 27001:2022 avec preuves.</p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-2">
                <button onClick={generateSoAPDF} className="flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-all hover:scale-105">
                    <FileText className="h-4 w-4 mr-2" /> Rapport PDF
                </button>
                <button onClick={handleExportCSV} className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors text-slate-700 dark:text-slate-200">
                    <Download className="h-4 w-4 mr-2" /> CSV
                </button>
            </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div><p className="text-sm text-gray-500">Conformité Globale</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{score}%</p></div>
                <CheckCircle2 className="h-8 w-8 text-brand-500 bg-brand-100 dark:bg-brand-900/30 rounded-full p-1.5"/>
            </div>
            <div className="bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                 <p className="text-sm text-gray-500">Implémentés</p><p className="text-xl font-bold text-emerald-600">{stats.implemented}</p>
            </div>
            <div className="bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                 <p className="text-sm text-gray-500">En cours</p><p className="text-xl font-bold text-amber-600">{stats.partial}</p>
            </div>
             <div className="bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                 <p className="text-sm text-gray-500">Hors périmètre</p><p className="text-xl font-bold text-gray-500">{stats.excluded}</p>
            </div>
        </div>

        {/* Controls List */}
        <div className="bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-gray-800 font-semibold text-slate-900 dark:text-white flex items-center">
                <FileText className="w-5 h-5 mr-2 text-brand-500"/> Annexe A - Contrôles
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? ( <div className="p-8 text-center">Chargement...</div> ) : (
                    controls.map((control) => {
                        const riskCount = getRiskCountForControl(control.id);
                        const findingsCount = getFindingsCountForControl(control.id);
                        return (
                        <div key={control.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                            <div className="flex items-start space-x-4 flex-1">
                                <div className="mt-0.5 min-w-[60px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 text-center border border-slate-200 dark:border-slate-700">
                                    {control.code}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-medium text-slate-900 dark:text-white">{control.name}</h4>
                                    <div className="flex items-center mt-1 gap-3 flex-wrap">
                                        {control.evidenceIds && control.evidenceIds.length > 0 ? (
                                            <span className="text-xs flex items-center text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-1.5 py-0.5 rounded">
                                                <Paperclip className="h-3 w-3 mr-1"/> {control.evidenceIds.length} Preuve(s)
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic flex items-center"><AlertTriangle className="h-3 w-3 mr-1"/>Aucune preuve</span>
                                        )}
                                        
                                        {riskCount > 0 && (
                                            <span className="text-xs flex items-center text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded" title="Risques traités par ce contrôle">
                                                <ShieldAlert className="h-3 w-3 mr-1"/> {riskCount} Risque(s) couvert(s)
                                            </span>
                                        )}

                                        {findingsCount > 0 && (
                                            <span className="text-xs flex items-center text-red-600 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900" title="Constats d'audit ouverts">
                                                <AlertOctagon className="h-3 w-3 mr-1"/> {findingsCount} Écart(s)
                                            </span>
                                        )}

                                        {control.status === 'Exclu' && <span className="text-xs text-red-500">Justification requise</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => { setSelectedControl(control); setShowLinkModal(true); }}
                                    className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                    title="Lier une preuve"
                                >
                                    <Link className="h-4 w-4"/>
                                </button>
                                <button 
                                    onClick={() => toggleStatus(control)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold border uppercase tracking-wide transition-all w-36 text-center shadow-sm ${getStatusColor(control.status)} hover:opacity-80`}
                                >
                                    {control.status}
                                </button>
                            </div>
                        </div>
                    )})
                )}
            </div>
        </div>

        {/* Link Evidence Modal */}
        {showLinkModal && selectedControl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-850 rounded-2xl p-6 w-full max-w-lg border border-gray-200 dark:border-gray-800 max-h-[80vh] flex flex-col">
                    <h3 className="text-lg font-bold mb-1 dark:text-white">Lier une preuve</h3>
                    <p className="text-sm text-gray-500 mb-4">Contrôle {selectedControl.code} : {selectedControl.name}</p>
                    
                    <div className="flex-1 overflow-y-auto border rounded-lg border-gray-200 dark:border-gray-700 divide-y dark:divide-gray-700">
                        {documents.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">Aucun document disponible.</div>
                        ) : (
                            documents.map(d => (
                                <button key={d.id} onClick={() => linkDocument(d.id)} className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center justify-between group">
                                    <div className="flex items-center overflow-hidden">
                                        <FileText className="h-4 w-4 mr-3 text-gray-400"/>
                                        <div className="truncate">
                                            <p className="text-sm font-medium dark:text-white truncate">{d.title}</p>
                                            <p className="text-xs text-gray-500">{d.type} • v{d.version}</p>
                                        </div>
                                    </div>
                                    {(selectedControl.evidenceIds?.includes(d.id)) && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Lié</span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                    <button onClick={() => setShowLinkModal(false)} className="mt-4 w-full py-2 border rounded dark:border-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800">Fermer</button>
                </div>
            </div>
        )}
    </div>
  );
};