
import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Project, ProjectTask, Risk } from '../types';
import { Plus, CalendarDays, CheckSquare, MoreHorizontal, Clock, Trash2, FolderKanban, Search, Filter, ShieldAlert } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { user, addToast } = useStore();
  const [filter, setFilter] = useState('');

  // RBAC: Only Admin can create/delete projects. 
  // Auditors/Users are read-only here.
  const canEdit = user?.role === 'admin';

  // New Project Form State
  const [newProject, setNewProject] = useState<Partial<Project>>({
    name: '',
    description: '',
    manager: '',
    status: 'Planifié',
    dueDate: '',
    tasks: [],
    relatedRiskIds: []
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projSnap, riskSnap] = await Promise.all([
          getDocs(query(collection(db, 'projects'), orderBy('dueDate', 'asc'))),
          getDocs(query(collection(db, 'risks'), orderBy('score', 'desc')))
      ]);
      
      setProjects(projSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
      setRisks(riskSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Risk)));

    } catch (err) {
      addToast("Erreur chargement projets", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canEdit) return;
      try {
          await addDoc(collection(db, 'projects'), {
              ...newProject,
              progress: 0,
              tasks: [],
              createdAt: new Date().toISOString()
          });
          await logAction(user, 'CREATE', 'Project', `Nouveau projet: ${newProject.name}`);
          addToast("Projet créé avec succès", "success");
          setShowModal(false);
          setNewProject({ name: '', description: '', manager: '', status: 'Planifié', dueDate: '', tasks: [], relatedRiskIds: [] });
          fetchData();
      } catch(e) { addToast("Erreur création projet", "error"); }
  };

  const handleDeleteProject = async (id: string, name: string) => {
      if (!canEdit) return;
      if(!confirm("Supprimer ce projet ?")) return;
      try {
          await deleteDoc(doc(db, 'projects', id));
          setProjects(prev => prev.filter(p => p.id !== id));
          addToast("Projet supprimé", "info");
      } catch(e) { addToast("Erreur suppression", "error"); }
  };

  const addTask = async (projectId: string, taskTitle: string) => {
      if (!canEdit) return;
      if(!taskTitle.trim()) return;
      const project = projects.find(p => p.id === projectId);
      if(!project) return;

      const newTask: ProjectTask = { id: Date.now().toString(), title: taskTitle, status: 'A faire' };
      const updatedTasks = [...(project.tasks || []), newTask];
      
      const completed = updatedTasks.filter(t => t.status === 'Terminé').length;
      const progress = Math.round((completed / updatedTasks.length) * 100);

      try {
          await updateDoc(doc(db, 'projects', projectId), { tasks: updatedTasks, progress });
          setProjects(prev => prev.map(p => p.id === projectId ? { ...p, tasks: updatedTasks, progress } : p));
      } catch(e) { console.error(e); }
  };

  const toggleTaskStatus = async (projectId: string, taskId: string) => {
      if (!canEdit) return;
      const project = projects.find(p => p.id === projectId);
      if(!project) return;

      const updatedTasks = project.tasks.map(t => {
          if(t.id === taskId) return { ...t, status: t.status === 'Terminé' ? 'A faire' : 'Terminé' } as ProjectTask;
          return t;
      });

      const completed = updatedTasks.filter(t => t.status === 'Terminé').length;
      const progress = Math.round((completed / updatedTasks.length) * 100);

      try {
          await updateDoc(doc(db, 'projects', projectId), { tasks: updatedTasks, progress });
          setProjects(prev => prev.map(p => p.id === projectId ? { ...p, tasks: updatedTasks, progress } : p));
      } catch(e) { console.error(e); }
  };

  const toggleRiskSelection = (riskId: string) => {
      const currentIds = newProject.relatedRiskIds || [];
      if (currentIds.includes(riskId)) {
          setNewProject({ ...newProject, relatedRiskIds: currentIds.filter(id => id !== riskId) });
      } else {
          setNewProject({ ...newProject, relatedRiskIds: [...currentIds, riskId] });
      }
  };

  const getStatusColor = (s: string) => {
      switch(s) {
          case 'En cours': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
          case 'Terminé': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
          case 'Suspendu': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
          default: return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-400';
      }
  };

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Projets SSI</h1>
                <p className="text-slate-500 dark:text-slate-400">Pilotage des plans d'actions et mise en conformité.</p>
            </div>
            {canEdit && (
                <button onClick={() => setShowModal(true)} className="flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau Projet
                </button>
            )}
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4 bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <Search className="h-5 w-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Rechercher un projet..." 
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white"
            value={filter} onChange={e => setFilter(e.target.value)}
          />
          <button className="p-2 bg-gray-100 dark:bg-slate-800 rounded text-gray-500 hover:text-slate-900 dark:hover:text-white">
              <Filter className="h-4 w-4" />
          </button>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {loading ? (
                <div className="col-span-full text-center py-10 text-gray-500">Chargement des projets...</div>
            ) : filteredProjects.length === 0 ? (
                <div className="col-span-full text-center py-10 bg-white dark:bg-slate-850 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <FolderKanban className="h-10 w-10 text-gray-300 mx-auto mb-3"/>
                    <p className="text-gray-500">Aucun projet en cours.</p>
                </div>
            ) : (
                filteredProjects.map(project => (
                    <div key={project.id} className="bg-white dark:bg-slate-850 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${getStatusColor(project.status)}`}>
                                {project.status}
                            </span>
                            {canEdit && (
                                <div className="relative group">
                                    <button className="text-gray-400 hover:text-slate-900 dark:hover:text-white p-1"><MoreHorizontal className="h-5 w-5"/></button>
                                    <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-slate-800 rounded shadow-lg border dark:border-gray-700 hidden group-hover:block z-10">
                                        <button onClick={() => handleDeleteProject(project.id, project.name)} className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center">
                                            <Trash2 className="h-3 w-3 mr-2"/> Supprimer
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-1" title={project.name}>{project.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 h-10">{project.description}</p>
                        
                        {/* Linked Risks (Mini Badges) */}
                        {project.relatedRiskIds && project.relatedRiskIds.length > 0 && (
                            <div className="flex items-center gap-1 mb-4 overflow-x-auto no-scrollbar">
                                {project.relatedRiskIds.map(rid => {
                                    const r = risks.find(rk => rk.id === rid);
                                    return r ? (
                                        <span key={rid} className="flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-900/20 dark:border-rose-900/30 dark:text-rose-400" title={r.threat}>
                                            <ShieldAlert className="w-3 h-3 inline mr-1" />
                                            Risque {r.score}
                                        </span>
                                    ) : null;
                                })}
                            </div>
                        )}

                        {/* Progress Bar */}
                        <div className="mb-6">
                            <div className="flex justify-between text-xs mb-1.5 font-medium">
                                <span className="text-slate-600 dark:text-slate-300">Avancement</span>
                                <span className="text-brand-600">{project.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                                <div className="bg-brand-500 h-2 rounded-full transition-all duration-500" style={{ width: `${project.progress}%` }}></div>
                            </div>
                        </div>

                        <div className="flex items-center text-xs text-gray-500 mb-4 space-x-4">
                            <div className="flex items-center">
                                <CalendarDays className="h-3.5 w-3.5 mr-1.5"/>
                                {new Date(project.dueDate).toLocaleDateString()}
                            </div>
                            <div className="flex items-center">
                                <Clock className="h-3.5 w-3.5 mr-1.5"/>
                                {Math.ceil((new Date(project.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}j restants
                            </div>
                        </div>

                        {/* Tasks Quick View */}
                        <div className="border-t border-gray-100 dark:border-gray-800 pt-4 flex-1">
                            <h4 className="text-xs font-bold uppercase text-gray-400 mb-3 flex items-center justify-between">
                                Tâches ({project.tasks?.length || 0})
                            </h4>
                            <div className="space-y-2 max-h-[100px] overflow-y-auto custom-scrollbar pr-1">
                                {(project.tasks || []).map(task => (
                                    <div key={task.id} className={`flex items-start gap-2 group ${canEdit ? 'cursor-pointer' : ''}`} onClick={() => canEdit && toggleTaskStatus(project.id, task.id)}>
                                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${task.status === 'Terminé' ? 'bg-brand-500 border-brand-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                                            {task.status === 'Terminé' && <CheckSquare className="h-3 w-3" />}
                                        </div>
                                        <span className={`text-xs transition-all ${task.status === 'Terminé' ? 'text-gray-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {task.title}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {canEdit && (
                                <div className="mt-3 flex">
                                    <input 
                                        type="text" 
                                        placeholder="+ Ajouter une tâche..."
                                        className="w-full text-xs bg-gray-50 dark:bg-slate-800 border-none rounded px-2 py-1.5 focus:ring-1 focus:ring-brand-500 dark:text-white"
                                        onKeyDown={(e) => {
                                            if(e.key === 'Enter') {
                                                addTask(project.id, e.currentTarget.value);
                                                e.currentTarget.value = '';
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>

        {showModal && canEdit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-850 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-800 max-h-[90vh] flex flex-col">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nouveau Projet SSI</h2>
                    </div>
                    <form onSubmit={handleCreateProject} className="p-6 space-y-4 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-white">Nom du projet</label>
                                    <input required type="text" className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white"
                                        value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-white">Description / Objectif</label>
                                    <textarea className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white" rows={3}
                                        value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-white">Responsable</label>
                                        <input type="text" className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white"
                                            value={newProject.manager} onChange={e => setNewProject({...newProject, manager: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-white">Date d'échéance</label>
                                        <input type="date" required className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white"
                                            value={newProject.dueDate} onChange={e => setNewProject({...newProject, dueDate: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            {/* Risk Linking Section */}
                            <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
                                <label className="flex items-center text-xs font-bold uppercase tracking-wider text-brand-600 mb-3">
                                    <ShieldAlert className="h-4 w-4 mr-2"/>
                                    Risques traités par ce projet
                                </label>
                                <div className="flex-1 overflow-y-auto max-h-[250px] space-y-2 pr-1 custom-scrollbar">
                                    {risks.length === 0 ? <p className="text-xs text-gray-400">Aucun risque identifié.</p> : 
                                        risks.map(risk => (
                                            <label key={risk.id} className={`flex items-start space-x-3 p-2.5 rounded-lg cursor-pointer border transition-all ${newProject.relatedRiskIds?.includes(risk.id) ? 'bg-white dark:bg-slate-700 border-brand-200 dark:border-brand-700' : 'border-transparent hover:bg-white dark:hover:bg-slate-700'}`}>
                                                <input type="checkbox" className="mt-1 rounded text-brand-600" 
                                                    checked={newProject.relatedRiskIds?.includes(risk.id)}
                                                    onChange={() => toggleRiskSelection(risk.id)}
                                                />
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold dark:text-white line-clamp-1">{risk.threat}</p>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <span className="text-[10px] text-gray-500">{risk.strategy}</span>
                                                        <span className={`text-[10px] font-bold px-1.5 rounded ${risk.score >= 10 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>Score: {risk.score}</span>
                                                    </div>
                                                </div>
                                            </label>
                                        ))
                                    }
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-500">Annuler</button>
                            <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700">Créer le projet</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};
