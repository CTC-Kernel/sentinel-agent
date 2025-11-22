
import React, { useEffect, useState, useRef } from 'react';
import { collection, addDoc, getDocs, query, deleteDoc, doc, updateDoc, where, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Document, UserProfile, SystemLog } from '../types';
import { Plus, Search, File, ExternalLink, Trash2, Link as LinkIcon, UploadCloud, Edit, Users, Bell, FileText, X, History, MessageSquare, Save, Eye, FileSpreadsheet } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { sendEmail } from '../services/emailService';
import { getDocumentReviewTemplate } from '../services/emailTemplates';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Comments } from '../components/ui/Comments';

export const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState('');
  const { user, addToast } = useStore();
  const canEdit = user?.role === 'admin';
  
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'details' | 'history' | 'comments'>('details');
  const [docHistory, setDocHistory] = useState<SystemLog[]>([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Document>>({});
  
  const [newDocData, setNewDocData] = useState<Partial<Document>>({
    title: '', type: 'Politique', version: '1.0', status: 'Brouillon',
    owner: user?.displayName || '', nextReviewDate: '', readBy: []
  });
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirm Dialog
  const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
      isOpen: false, title: '', message: '', onConfirm: () => {}
  });

  const fetchData = async () => {
    if (!user?.organizationId) {
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
      // Robust fetching
      const results = await Promise.allSettled([
          getDocs(query(collection(db, 'documents'), where('organizationId', '==', user.organizationId))),
          getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId)))
      ]);
      
      const getDocsData = <T,>(result: PromiseSettledResult<any>): T[] => {
          if (result.status === 'fulfilled') {
              return result.value.docs.map((d: any) => ({ id: d.id, ...d.data() })) as T[];
          }
          return [];
      };

      const docsData = getDocsData<Document>(results[0]);
      docsData.sort((a, b) => a.title.localeCompare(b.title));
      setDocuments(docsData);

      // If users load fails, list is empty, but docs still show
      const usersData = getDocsData<UserProfile>(results[1]);
      // Fix for users collection sometimes having uid as id or field
      const formattedUsers = usersData.map(u => ({ ...u, uid: u.uid || (u as any).id }));
      setUsersList(formattedUsers);

    } catch (err) {
      console.error(err);
      addToast("Erreur chargement documents", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user?.organizationId]);

  const openInspector = async (docItem: Document) => {
      setSelectedDocument(docItem);
      setInspectorTab('details');
      setEditForm(docItem);
      setIsEditing(false);

      try {
          // Limit history fetch to avoid heavy reads
          const q = query(collection(db, 'system_logs'), where('organizationId', '==', user?.organizationId), limit(50));
          const snap = await getDocs(q);
          const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemLog));
          
          // Filter and sort client side
          const relevantLogs = logs.filter(l => l.resource === 'Document' && l.details?.includes(docItem.title));
          relevantLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          setDocHistory(relevantLogs);
      } catch(e) { console.error(e); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setFileToUpload(e.target.files[0]);
      }
  };

  const uploadFile = async (file: File, docId?: string): Promise<string> => {
      const storageRef = ref(storage, `documents/${user?.organizationId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
  };

  const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user?.organizationId) return;
      
      setUploading(true);
      try {
          let url = '';
          if (fileToUpload) {
              url = await uploadFile(fileToUpload);
          }

          await addDoc(collection(db, 'documents'), {
              ...newDocData,
              url,
              organizationId: user.organizationId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
          });

          await logAction(user, 'CREATE', 'Document', `Nouveau document: ${newDocData.title}`);
          addToast("Document ajouté", "success");
          setShowCreateModal(false);
          setFileToUpload(null);
          fetchData();
      } catch (e) {
          addToast("Erreur création document", "error");
      } finally {
          setUploading(false);
      }
  };

  const handleUpdate = async () => {
      if (!canEdit || !selectedDocument) return;
      setUploading(true);
      try {
          const { id, ...data } = editForm as any;
          
          await updateDoc(doc(db, 'documents', selectedDocument.id), {
              ...data,
              updatedAt: new Date().toISOString()
          });
          
          await logAction(user, 'UPDATE', 'Document', `MAJ document: ${editForm.title}`);
          
          setDocuments(prev => prev.map(d => d.id === selectedDocument.id ? { ...d, ...data, updatedAt: new Date().toISOString() } : d));
          setSelectedDocument({ ...selectedDocument, ...data, updatedAt: new Date().toISOString() });
          setIsEditing(false);
          addToast("Document mis à jour", "success");
      } catch (e) {
          addToast("Erreur mise à jour", "error");
      } finally {
          setUploading(false);
      }
  };

  const initiateDelete = (id: string, title: string) => {
      if (!canEdit) return;
      setConfirmData({
          isOpen: true,
          title: "Supprimer le document ?",
          message: "Cette action est définitive.",
          onConfirm: () => handleDelete(id, title)
      });
  };

  const handleDelete = async (id: string, title: string) => {
      try {
          await deleteDoc(doc(db, 'documents', id));
          setDocuments(prev => prev.filter(d => d.id !== id));
          setSelectedDocument(null);
          await logAction(user, 'DELETE', 'Document', `Suppression: ${title}`);
          addToast("Document supprimé", "info");
      } catch (e) {
          addToast("Erreur suppression", "error");
      }
  };

  const sendReviewReminder = async () => {
      if (!selectedDocument || !user) return;
      try {
          const link = `${window.location.origin}/#/documents`;
          const html = getDocumentReviewTemplate(selectedDocument.title, selectedDocument.owner, selectedDocument.nextReviewDate || new Date().toISOString(), link);
          
          await sendEmail(user, {
              to: usersList.find(u => u.displayName === selectedDocument.owner)?.email || selectedDocument.owner, 
              subject: `Rappel de révision : ${selectedDocument.title}`,
              type: 'DOCUMENT_REVIEW',
              html
          });
          addToast("Rappel envoyé au propriétaire", "success");
      } catch (e) {
          addToast("Erreur envoi rappel", "error");
      }
  };

  const handleExportCSV = () => {
    const headers = ["Titre", "Type", "Version", "Statut", "Propriétaire", "Prochaine Révision", "Fichier Joint"];
    const rows = filteredDocuments.map(d => [
        d.title,
        d.type,
        d.version,
        d.status,
        d.owner,
        d.nextReviewDate ? new Date(d.nextReviewDate).toLocaleDateString() : '',
        d.url ? 'Oui' : 'Non'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `documents_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filteredDocuments = documents.filter(d => d.title.toLowerCase().includes(filter.toLowerCase()));

  const getStatusColor = (s: string) => {
      switch(s) {
          case 'Publié': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50';
          case 'Obsolète': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50';
          default: return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
      }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10 relative">
        <ConfirmModal 
            isOpen={confirmData.isOpen}
            onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
            onConfirm={confirmData.onConfirm}
            title={confirmData.title}
            message={confirmData.message}
        />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Gestion Documentaire</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Politiques, procédures et preuves (ISO 27001 A.5.37).</p>
            </div>
            {canEdit && (
                <button onClick={() => {
                    setNewDocData({ title: '', type: 'Politique', version: '1.0', status: 'Brouillon', owner: user?.displayName || '', nextReviewDate: '', readBy: [] });
                    setShowCreateModal(true);
                }} className="flex items-center px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-blue-500/20">
                    <Plus className="h-4 w-4 mr-2" /> Nouveau Document
                </button>
            )}
        </div>

        <div className="glass-panel p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all border border-slate-200 dark:border-white/5">
            <Search className="h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Rechercher un document..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 font-medium placeholder-gray-400"
              value={filter} onChange={e => setFilter(e.target.value)} />
            <button onClick={handleExportCSV} className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors" title="Exporter CSV">
                <FileSpreadsheet className="h-4 w-4" />
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {loading ? <div className="col-span-full text-center py-12 text-gray-400">Chargement...</div> : filteredDocuments.length === 0 ? <div className="col-span-full text-center py-12 text-gray-400 italic">Aucun document trouvé.</div> :
            filteredDocuments.map(docItem => (
                <div key={docItem.id} onClick={() => openInspector(docItem)} className="glass-panel rounded-[2rem] p-7 shadow-sm hover:shadow-apple transition-all duration-300 hover:-translate-y-1 cursor-pointer border border-white/50 dark:border-white/5 group flex flex-col">
                    <div className="flex justify-between items-start mb-5">
                        <div className="p-3 bg-blue-50 dark:bg-slate-800 rounded-2xl text-blue-600 shadow-inner">
                            <FileText className="h-6 w-6"/>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getStatusColor(docItem.status)}`}>{docItem.status}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight line-clamp-2">{docItem.title}</h3>
                    <div className="flex items-center text-xs font-medium text-slate-500 dark:text-slate-400 mb-6">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md mr-2">v{docItem.version}</span>
                        <span>{docItem.type}</span>
                    </div>
                    <div className="mt-auto pt-4 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-between items-center">
                        <div className="flex items-center text-xs text-slate-400 font-medium" title="Propriétaire">
                            <Users className="h-3.5 w-3.5 mr-1.5"/> {docItem.owner}
                        </div>
                        {docItem.url && <ExternalLink className="h-4 w-4 text-slate-300 hover:text-blue-500 transition-colors" />}
                    </div>
                </div>
            ))}
        </div>

        {/* Inspector */}
        {selectedDocument && (
            <div className="fixed inset-0 z-[100] overflow-hidden">
                <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setSelectedDocument(null)} />
                <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex pointer-events-none">
                    <div className="w-screen max-w-2xl pointer-events-auto">
                        <div className="h-full flex flex-col bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border-l border-white/20 dark:border-white/5 animate-slide-up">
                            <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-start justify-between bg-white/50 dark:bg-white/5">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">{selectedDocument.title}</h2>
                                    <p className="text-sm font-medium text-slate-500 mt-1">v{selectedDocument.version} • {selectedDocument.type}</p>
                                </div>
                                <div className="flex gap-2">
                                    {selectedDocument.url && (
                                        <a href={selectedDocument.url} target="_blank" rel="noreferrer" className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Ouvrir">
                                            <Eye className="h-5 w-5" />
                                        </a>
                                    )}
                                    {canEdit && !isEditing && (
                                        <button onClick={() => setIsEditing(true)} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button>
                                    )}
                                    {canEdit && isEditing && (
                                        <button onClick={handleUpdate} className="p-2.5 text-blue-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Save className="h-5 w-5" /></button>
                                    )}
                                    {canEdit && (
                                        <button onClick={() => initiateDelete(selectedDocument.id, selectedDocument.title)} className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button>
                                    )}
                                    <button onClick={() => setSelectedDocument(null)} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
                                </div>
                            </div>

                            <div className="px-8 border-b border-gray-100 dark:border-white/5 flex gap-8 bg-white/30 dark:bg-white/5">
                                {[
                                    { id: 'details', label: 'Détails', icon: File },
                                    { id: 'history', label: 'Historique', icon: History },
                                    { id: 'comments', label: 'Discussion', icon: MessageSquare },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setInspectorTab(tab.id as any)}
                                        className={`py-4 text-sm font-semibold flex items-center border-b-2 transition-all ${inspectorTab === tab.id ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        <tab.icon className={`h-4 w-4 mr-2.5 ${inspectorTab === tab.id ? 'text-blue-500' : 'opacity-70'}`} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">
                                {inspectorTab === 'details' && (
                                    <div className="space-y-8">
                                        {isEditing ? (
                                            <div className="space-y-6">
                                                <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Titre</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})}/></div>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Version</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={editForm.version} onChange={e => setEditForm({...editForm, version: e.target.value})}/></div>
                                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Type</label>
                                                        <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value as any})}>
                                                            {['Politique', 'Procédure', 'Preuve', 'Rapport', 'Autre'].map(t => <option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut</label>
                                                        <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value as any})}>
                                                            {['Brouillon', 'Publié', 'Obsolète'].map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Propriétaire</label>
                                                        <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none" value={editForm.owner} onChange={e => setEditForm({...editForm, owner: e.target.value})}>
                                                            {usersList.map(u => <option key={u.uid} value={u.displayName}>{u.displayName}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Prochaine révision</label><input type="date" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={editForm.nextReviewDate || ''} onChange={e => setEditForm({...editForm, nextReviewDate: e.target.value})}/></div>
                                            </div>
                                        ) : (
                                            <>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="p-5 bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1 tracking-wide">Propriétaire</span>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedDocument.owner}</span>
                                                </div>
                                                <div className="p-5 bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1 tracking-wide">Dernière MAJ</span>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{new Date(selectedDocument.updatedAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="p-6 bg-white dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Révision</h4>
                                                    {selectedDocument.nextReviewDate && (
                                                        <span className={`text-xs font-bold ${new Date(selectedDocument.nextReviewDate) < new Date() ? 'text-red-500' : 'text-emerald-500'}`}>
                                                            {new Date(selectedDocument.nextReviewDate).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <button onClick={sendReviewReminder} className="w-full py-3 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center border border-slate-200 dark:border-white/5">
                                                    <Bell className="h-3.5 w-3.5 mr-2"/> Envoyer rappel de révision
                                                </button>
                                            </div>

                                            <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-sm flex items-center justify-between">
                                                <div className="flex items-center text-blue-700 dark:text-blue-300 text-sm font-bold">
                                                    <LinkIcon className="h-4 w-4 mr-3"/> Fichier Joint
                                                </div>
                                                {selectedDocument.url ? (
                                                    <a href={selectedDocument.url} target="_blank" rel="noreferrer" className="text-xs font-bold bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm hover:text-blue-600 transition-colors">
                                                        Télécharger
                                                    </a>
                                                ) : <span className="text-xs text-gray-400 italic">Aucun fichier</span>}
                                            </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {inspectorTab === 'history' && (
                                    <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                        {docHistory.length === 0 ? <p className="text-sm text-gray-500 pl-6">Aucun historique.</p> :
                                        docHistory.map((log, i) => (
                                            <div key={i} className="relative">
                                                <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900">
                                                    <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                                                </span>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.details}</p>
                                                    <p className="text-[10px] text-gray-400 mt-1">Par: {log.userEmail}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {inspectorTab === 'comments' && (
                                    <div className="h-full flex flex-col">
                                        <Comments collectionName="documents" documentId={selectedDocument.id} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-850 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-blue-50/30 dark:bg-blue-900/10">
                        <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 tracking-tight">Nouveau Document</h2>
                    </div>
                    <form onSubmit={handleCreate} className="p-8 space-y-5 overflow-y-auto custom-scrollbar">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Titre</label>
                            <input required className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
                                value={newDocData.title} onChange={e => setNewDocData({...newDocData, title: e.target.value})} placeholder="Ex: PSSI"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Type</label>
                                <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none"
                                    value={newDocData.type} onChange={e => setNewDocData({...newDocData, type: e.target.value as any})}>
                                    {['Politique', 'Procédure', 'Preuve', 'Rapport', 'Autre'].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Version</label>
                                <input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
                                    value={newDocData.version} onChange={e => setNewDocData({...newDocData, version: e.target.value})}/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Propriétaire</label>
                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none" 
                                value={newDocData.owner} onChange={e => setNewDocData({...newDocData, owner: e.target.value})}>
                                <option value="">Sélectionner...</option>
                                {usersList.map(u => <option key={u.uid} value={u.displayName}>{u.displayName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Prochaine révision</label>
                            <input type="date" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
                                value={newDocData.nextReviewDate} onChange={e => setNewDocData({...newDocData, nextReviewDate: e.target.value})}/>
                        </div>
                        
                        <div className="pt-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Fichier</label>
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-full h-24 border-2 border-dashed border-gray-300 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                    <UploadCloud className="h-8 w-8 text-slate-400 mb-2 group-hover:scale-110 transition-transform" />
                                    <p className="text-xs text-slate-500">{fileToUpload ? fileToUpload.name : "Glisser ou cliquer pour uploader"}</p>
                                </div>
                                <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                            <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                            <button type="submit" disabled={uploading} className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:scale-105 transition-transform font-bold text-sm shadow-lg shadow-blue-500/20 flex items-center">
                                {uploading ? 'Upload...' : 'Créer'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};
