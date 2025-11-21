
import React, { useEffect, useState, useRef } from 'react';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Asset, Criticality } from '../types';
import { Plus, Search, Filter, Server, Trash2, Edit, Upload } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';

export const Assets: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const { user, addToast } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // RBAC: Only Admin can edit/delete Assets
  const canEdit = user?.role === 'admin';

  // State for Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [currentAssetId, setCurrentAssetId] = useState<string | null>(null);

  const [newAsset, setNewAsset] = useState<Partial<Asset>>({
    name: '',
    type: 'Matériel',
    owner: '',
    confidentiality: Criticality.LOW,
    integrity: Criticality.LOW,
    availability: Criticality.LOW,
    location: ''
  });

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'assets'), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
      setAssets(data);
    } catch (err) {
      console.warn("Impossible de récupérer les actifs.");
      addToast("Erreur chargement actifs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const openModal = (asset?: Asset) => {
    if (!canEdit && !asset) return; // Double check for create
    if (asset) {
      setIsEditing(true);
      setCurrentAssetId(asset.id);
      setNewAsset(asset);
    } else {
      setIsEditing(false);
      setCurrentAssetId(null);
      setNewAsset({ name: '', type: 'Matériel', owner: '', confidentiality: Criticality.LOW, integrity: Criticality.LOW, availability: Criticality.LOW, location: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!newAsset.name) return;
    
    try {
      if (isEditing && currentAssetId) {
        // Update
        const { id, ...dataToUpdate } = newAsset as any;
        await updateDoc(doc(db, 'assets', currentAssetId), dataToUpdate);
        await logAction(user, 'UPDATE', 'Asset', `Modification actif: ${newAsset.name}`);
        addToast("Actif mis à jour", "success");
      } else {
        // Create
        await addDoc(collection(db, 'assets'), {
          ...newAsset,
          createdAt: new Date().toISOString()
        });
        await logAction(user, 'CREATE', 'Asset', `Ajout actif: ${newAsset.name}`);
        addToast("Actif ajouté", "success");
      }
      
      setShowModal(false);
      fetchAssets();
    } catch (error) {
      console.error("Error saving asset: ", error);
      addToast("Erreur lors de l'enregistrement", "error");
    }
  };

  const handleDeleteAsset = async (id: string, name: string) => {
      if (!canEdit) return;
      if(!confirm(`Confirmer la suppression de l'actif : ${name} ?`)) return;
      try {
          await deleteDoc(doc(db, 'assets', id));
          await logAction(user, 'DELETE', 'Asset', `Suppression actif: ${name}`);
          setAssets(prev => prev.filter(a => a.id !== id));
          addToast("Actif supprimé", "info");
      } catch(error) {
          addToast("Erreur lors de la suppression", "error");
      }
  };

  // CSV Import Logic
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!canEdit) return;
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
          const text = e.target?.result as string;
          if (!text) return;

          // Simple CSV parsing (assuming: Name,Type,Owner,CIA(Low/High...),Location)
          // Skip header
          const lines = text.split('\n').slice(1).filter(line => line.trim() !== '');
          
          if (lines.length === 0) {
              addToast("Fichier CSV vide ou invalide", "error");
              return;
          }

          setLoading(true);
          try {
              const batch = writeBatch(db);
              let count = 0;

              lines.forEach(line => {
                  const columns = line.split(',');
                  if (columns.length >= 3) {
                      const newRef = doc(collection(db, 'assets'));
                      batch.set(newRef, {
                          name: columns[0]?.trim() || 'Unknown',
                          type: (columns[1]?.trim() || 'Matériel') as any,
                          owner: columns[2]?.trim() || 'Unknown',
                          confidentiality: columns[3]?.trim() === 'Critique' ? Criticality.CRITICAL : Criticality.LOW, // Simplified mapping for demo
                          integrity: Criticality.LOW,
                          availability: Criticality.LOW,
                          location: columns[4]?.trim() || '',
                          createdAt: new Date().toISOString()
                      });
                      count++;
                  }
              });

              await batch.commit();
              await logAction(user, 'IMPORT', 'Asset', `Import CSV de ${count} actifs`);
              addToast(`${count} actifs importés avec succès`, "success");
              fetchAssets();
          } catch (error) {
              console.error(error);
              addToast("Erreur lors de l'import CSV", "error");
          } finally {
              setLoading(false);
              if(fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  const triggerFileInput = () => {
      fileInputRef.current?.click();
  };

  const getCriticalityColor = (level: Criticality) => {
    switch (level) {
      case Criticality.CRITICAL: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case Criticality.HIGH: return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case Criticality.MEDIUM: return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      default: return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    }
  };

  const filteredAssets = assets.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inventaire des Actifs</h1>
          <p className="text-slate-500 dark:text-slate-400">Gérer et classifier les actifs de l'organisation.</p>
        </div>
        {canEdit && (
            <div className="flex gap-2">
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button 
                    onClick={triggerFileInput}
                    className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-white border border-gray-300 dark:border-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    title="Format CSV: Nom,Type,Propriétaire,Criticité,Lieu"
                >
                    <Upload className="h-4 w-4 mr-2" />
                    Importer CSV
                </button>
                <button 
                  onClick={() => openModal()}
                  className="flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un Actif
                </button>
            </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Rechercher des actifs..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
          />
        </div>
        <button className="flex items-center px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
          <Filter className="h-4 w-4 mr-2" />
          Filtres
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3">Nom de l'actif</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Propriétaire</th>
                <th className="px-6 py-3">Niveau DIC</th>
                <th className="px-6 py-3">Localisation</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                 <tr><td colSpan={6} className="px-6 py-8 text-center">Chargement des actifs...</td></tr>
              ) : filteredAssets.length === 0 ? (
                 <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Aucun actif trouvé. Ajoutez-en un ou importez un CSV.</td></tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg mr-3">
                        <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      {asset.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{asset.type}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{asset.owner}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border border-current opacity-90 ${getCriticalityColor(asset.confidentiality)}`} title="Confidentialité">C</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border border-current opacity-90 ${getCriticalityColor(asset.integrity)}`} title="Intégrité">I</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border border-current opacity-90 ${getCriticalityColor(asset.availability)}`} title="Disponibilité">D</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{asset.location}</td>
                    <td className="px-6 py-4 text-right flex justify-end items-center space-x-2">
                        {canEdit && (
                            <>
                                <button 
                                    onClick={() => openModal(asset)}
                                    className="text-gray-400 hover:text-brand-600 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Modifier"
                                >
                                    <Edit className="h-4 w-4" />
                                </button>
                                <button 
                                    onClick={() => handleDeleteAsset(asset.id, asset.name)}
                                    className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Supprimer"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </>
                        )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-850 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-800">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{isEditing ? 'Modifier l\'actif' : 'Ajouter un nouvel actif'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom de l'actif</label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-white" 
                  value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} disabled={!canEdit} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                    <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-white dark:bg-slate-800"
                      value={newAsset.type} onChange={e => setNewAsset({...newAsset, type: e.target.value as any})} disabled={!canEdit}>
                      {['Matériel', 'Logiciel', 'Données', 'Service', 'Humain'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Propriétaire</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-white"
                       value={newAsset.owner} onChange={e => setNewAsset({...newAsset, owner: e.target.value})} disabled={!canEdit} />
                 </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                  {[
                    {label: 'Confidentialité', key: 'confidentiality'},
                    {label: 'Intégrité', key: 'integrity'},
                    {label: 'Disponibilité', key: 'availability'}
                  ].map(f => (
                    <div key={f.key}>
                       <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{f.label}</label>
                        <select className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-white dark:bg-slate-800"
                          value={(newAsset as any)[f.key]} onChange={e => setNewAsset({...newAsset, [f.key]: e.target.value as any})} disabled={!canEdit}>
                          {Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                  ))}
              </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Localisation</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-white"
                      value={newAsset.location} onChange={e => setNewAsset({...newAsset, location: e.target.value})} disabled={!canEdit} />
               </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Annuler</button>
                {canEdit && <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">{isEditing ? 'Mettre à jour' : 'Enregistrer'}</button>}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
