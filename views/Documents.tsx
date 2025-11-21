
import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Document } from '../types';
import { Plus, Search, File, ExternalLink, Trash2, Link as LinkIcon, UploadCloud, Edit } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';

export const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const { user, addToast } = useStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Document>>({
    title: '',
    type: 'Politique',
    version: '1.0',
    status: 'Publié',
    url: '',
    owner: ''
  });

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'documents'), orderBy('updatedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
      setDocuments(data);
    } catch (err) {
      console.warn("Erreur fetch documents");
      addToast("Impossible de charger les documents", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocuments(); }, []);

  const openModal = (doc?: Document) => {
      if (doc) {
          setFormData(doc);
          setIsEditing(true);
      } else {
          setFormData({ title: '', type: 'Politique', version: '1.0', status: 'Publié', url: '', owner: '' });
          setIsEditing(false);
      }
      setSelectedFile(null);
      setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let downloadUrl = formData.url;

      // Upload File if selected
      if (selectedFile) {
          const storageRef = ref(storage, `documents/${Date.now()}_${selectedFile.name}`);
          const snapshot = await uploadBytes(storageRef, selectedFile);
          downloadUrl = await getDownloadURL(snapshot.ref);
      }

      const docData = {
          ...formData,
          url: downloadUrl,
          updatedAt: new Date().toISOString()
      };

      if (isEditing && formData.id) {
          await updateDoc(doc(db, 'documents', formData.id), docData);
          await logAction(user, 'UPDATE', 'Document', `Mise à jour: ${formData.title}`);
          addToast("Document mis à jour avec succès", "success");
      } else {
          await addDoc(collection(db, 'documents'), {
            ...docData,
            owner: user?.email || 'Unknown',
            createdAt: new Date().toISOString()
          });
          await logAction(user, 'CREATE', 'Document', `Ajout document: ${formData.title}`);
          addToast("Document ajouté avec succès", "success");
      }

      setShowModal(false);
      fetchDocuments();
    } catch (error) {
      console.error(error);
      addToast("Erreur lors de l'enregistrement", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
      if(!confirm("Supprimer ce document ?")) return;
      try {
          await deleteDoc(doc(db, 'documents', id));
          await logAction(user, 'DELETE', 'Document', `Suppression: ${title}`);
          setDocuments(prev => prev.filter(d => d.id !== id));
          addToast("Document supprimé", "info");
      } catch(e) { 
          addToast("Erreur lors de la suppression", "error");
      }
  };

  const filteredDocs = documents.filter(d => d.title.toLowerCase().includes(filter.toLowerCase()));

  const getTypeColor = (type: string) => {
      switch(type) {
          case 'Politique': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
          case 'Procédure': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
          case 'Preuve': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
          default: return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-400';
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestion Documentaire</h1>
          <p className="text-slate-500 dark:text-slate-400">Politiques, procédures et preuves documentaires.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Document
        </button>
      </div>

      <div className="flex items-center space-x-4 bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <Search className="h-5 w-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Rechercher..." 
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white"
            value={filter} onChange={e => setFilter(e.target.value)}
          />
      </div>

      <div className="bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase text-xs">
                <tr>
                    <th className="px-6 py-3">Titre</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Version</th>
                    <th className="px-6 py-3">Statut</th>
                    <th className="px-6 py-3">Lien</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                    <tr><td colSpan={6} className="text-center py-8">Chargement...</td></tr>
                ) : filteredDocs.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">Aucun document.</td></tr>
                ) : (
                    filteredDocs.map(doc => (
                        <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 group">
                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center">
                                <File className="h-4 w-4 mr-3 text-gray-400"/>
                                {doc.title}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${getTypeColor(doc.type)}`}>
                                    {doc.type}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-gray-500">{doc.version}</td>
                            <td className="px-6 py-4">
                                <span className={`text-xs font-medium ${doc.status === 'Publié' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {doc.status}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                {doc.url && (
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline flex items-center">
                                        <ExternalLink className="h-3 w-3 mr-1"/>
                                        Ouvrir
                                    </a>
                                )}
                            </td>
                            <td className="px-6 py-4 text-right flex justify-end items-center space-x-2">
                                <button onClick={() => openModal(doc)} className="text-gray-400 hover:text-brand-600 transition-colors">
                                    <Edit className="h-4 w-4"/>
                                </button>
                                <button onClick={() => handleDelete(doc.id, doc.title)} className="text-gray-400 hover:text-red-500 transition-colors">
                                    <Trash2 className="h-4 w-4"/>
                                </button>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>

      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-850 rounded-2xl p-6 w-full max-w-lg border border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-bold mb-4 dark:text-white">{isEditing ? 'Modifier le document' : 'Ajouter un document'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm mb-1 dark:text-white">Titre</label>
                        <input type="text" required className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white"
                        value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm mb-1 dark:text-white">Type</label>
                            <select className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white dark:bg-slate-800"
                                value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                                {['Politique', 'Procédure', 'Preuve', 'Rapport', 'Autre'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm mb-1 dark:text-white">Version</label>
                            <input type="text" className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white"
                                value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm mb-1 dark:text-white">Fichier ou URL</label>
                        <div className="space-y-2">
                            <div className="flex items-center justify-center w-full">
                                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-slate-900 hover:bg-gray-100 dark:border-gray-700">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        {selectedFile ? (
                                            <p className="text-sm text-brand-600 font-semibold">{selectedFile.name}</p>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <UploadCloud className="w-6 h-6 mb-1 text-gray-400" />
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Cliquez pour uploader un fichier</p>
                                            </div>
                                        )}
                                    </div>
                                    <input type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)} />
                                </label>
                            </div>
                            <div className="flex items-center text-xs text-gray-500 uppercase my-2 text-center"><span className="w-full border-t border-gray-200 dark:border-gray-700"></span><span className="px-2">OU</span><span className="w-full border-t border-gray-200 dark:border-gray-700"></span></div>
                             <div className="flex">
                                <div className="bg-gray-100 dark:bg-slate-800 px-3 py-2 border border-r-0 border-gray-300 dark:border-gray-700 rounded-l text-gray-500">
                                    <LinkIcon className="h-4 w-4"/>
                                </div>
                                <input type="url" placeholder="URL Externe (Sharepoint, Drive...)" className="w-full p-2 border rounded-r dark:bg-transparent dark:border-gray-700 dark:text-white"
                                value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-500">Annuler</button>
                        <button type="submit" disabled={uploading} className="px-4 py-2 bg-brand-600 text-white rounded flex items-center disabled:opacity-50">
                            {uploading && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>}
                            {isEditing ? 'Mettre à jour' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};