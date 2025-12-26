import React, { useState } from 'react';
import { DocumentFolder } from '../../types';
import { Folder, ChevronRight, ChevronDown, Plus, MoreVertical, Edit2, Trash2, FolderOpen } from '../ui/Icons';
import { ConfirmModal } from '../ui/ConfirmModal';

interface FolderTreeProps {
    folders: DocumentFolder[];
    selectedFolderId: string | null;
    onSelectFolder: (folderId: string | null) => void;
    onCreateFolder: (name: string, parentId?: string) => Promise<void>;
    onUpdateFolder: (id: string, name: string) => void;
    onDeleteFolder: (id: string) => Promise<void>;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
    folders,
    selectedFolderId,
    onSelectFolder,
    onCreateFolder,
    onUpdateFolder,
    onDeleteFolder
}) => {
    const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createParentId, setCreateParentId] = useState<string | undefined>(undefined);
    const [contextMenu, setContextMenu] = useState<{ id: string, x: number, y: number } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, id: string, loading?: boolean }>({ isOpen: false, id: '' });
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    const toggleExpand = (folderId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedFolders(prev =>
            prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
        );
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newFolderName.trim()) {
            setIsCreatingFolder(true);
            try {
                await onCreateFolder(newFolderName.trim(), createParentId);
                setNewFolderName('');
                setShowCreateModal(false);
            } finally {
                setIsCreatingFolder(false);
            }
        }
    };

    const handleUpdateSubmit = (id: string) => {
        if (newFolderName.trim()) {
            onUpdateFolder(id, newFolderName.trim());
            setEditingFolderId(null);
            setNewFolderName('');
        }
    };

    const rootFolders = folders.filter(f => !f.parentId).sort((a, b) => a.name.localeCompare(b.name));

    const renderFolder = (folder: DocumentFolder, depth: number = 0) => {
        const children = folders.filter(f => f.parentId === folder.id).sort((a, b) => a.name.localeCompare(b.name));
        const isExpanded = expandedFolders.includes(folder.id);
        const isSelected = selectedFolderId === folder.id;
        const isEditing = editingFolderId === folder.id;

        return (
            <div key={folder.id} className="select-none">
                <div
                    className={`flex items-center py-2 px-3 rounded-lg cursor-pointer transition-colors group relative ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'}`}
                    style={{ paddingLeft: `${depth * 16 + 12}px` }}
                    onClick={() => onSelectFolder(folder.id)}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ id: folder.id, x: e.clientX, y: e.clientY });
                    }}
                >
                    <button
                        aria-label={isExpanded ? "Replier le dossier" : "Déplier le dossier"}
                        onClick={(e) => toggleExpand(folder.id, e)}
                        className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 mr-1 ${children.length === 0 ? 'invisible' : ''}`}
                    >
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>

                    {isEditing ? (
                        <input
                            aria-label="Renommer le dossier"
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onBlur={() => handleUpdateSubmit(folder.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateSubmit(folder.id)}
                            autoFocus
                            className="flex-1 bg-white dark:bg-slate-800 border border-blue-500 rounded px-2 py-0.5 text-sm"
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div className="flex items-center flex-1 overflow-hidden">
                            {isExpanded ? <FolderOpen className="h-4 w-4 mr-2 text-blue-500" /> : <Folder className="h-4 w-4 mr-2 text-blue-500" />}
                            <span className="truncate text-sm font-medium">{folder.name}</span>
                        </div>
                    )}

                    <button
                        aria-label="Options du dossier"
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-opacity"
                        onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({ id: folder.id, x: e.clientX, y: e.clientY });
                        }}
                    >
                        <MoreVertical className="h-3 w-3" />
                    </button>
                </div>

                {isExpanded && children.map(child => renderFolder(child, depth + 1))}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">Dossiers</h3>
                <button
                    aria-label="Créer un nouveau dossier racine"
                    onClick={() => {
                        setCreateParentId(undefined);
                        setShowCreateModal(true);
                    }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-600 hover:text-blue-600 transition-colors"
                    title="Nouveau dossier racine"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                <div
                    className={`flex items-center py-2 px-3 rounded-lg cursor-pointer mb-1 ${selectedFolderId === null ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'}`}
                    onClick={() => onSelectFolder(null)}
                >
                    <div className="w-5 mr-1" /> {/* Spacer for alignment */}
                    <Folder className="h-4 w-4 mr-2 text-slate-500" />
                    <span className="text-sm font-medium">Tous les documents</span>
                </div>
                {rootFolders.map(f => renderFolder(f))}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
                    <div className="glass-panel p-6 rounded-[2rem] shadow-2xl w-80 border border-white/20 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-white/10 dark:to-transparent pointer-events-none" />
                        <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white relative z-10">Nouveau Dossier</h3>
                        <form onSubmit={handleCreateSubmit}>
                            <input
                                aria-label="Nom du nouveau dossier"
                                type="text"
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                placeholder="Nom du dossier"
                                className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2 relative z-10">
                                <button aria-label="Annuler la création" type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors" disabled={isCreatingFolder}>Annuler</button>
                                <button aria-label="Confirmer la création" type="submit" className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center transition-all hover:scale-105 active:scale-95" disabled={isCreatingFolder}>
                                    {isCreatingFolder && <span className="animate-spin mr-2">⏳</span>} Créer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-header" onClick={() => setContextMenu(null)} />
                    <div
                        className="fixed z-modal glass-panel rounded-xl shadow-2xl border border-white/20 py-1 w-48 animate-scale-in overflow-hidden backdrop-blur-md"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <button
                            aria-label="Nouveau sous-dossier"
                            onClick={() => {
                                setCreateParentId(contextMenu.id);
                                setShowCreateModal(true);
                                setContextMenu(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Nouveau sous-dossier
                        </button>
                        <button
                            aria-label="Renommer le dossier"
                            onClick={() => {
                                setEditingFolderId(contextMenu.id);
                                const folder = folders.find(f => f.id === contextMenu.id);
                                if (folder) setNewFolderName(folder.name);
                                setContextMenu(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center"
                        >
                            <Edit2 className="h-4 w-4 mr-2" /> Renommer
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />
                        <button
                            aria-label="Supprimer le dossier"
                            onClick={() => {
                                setConfirmDelete({ isOpen: true, id: contextMenu.id });
                                setContextMenu(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                        >
                            <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                        </button>
                    </div>
                </>
            )}

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: '' })}
                onConfirm={async () => {
                    setConfirmDelete(prev => ({ ...prev, loading: true }));
                    try {
                        await onDeleteFolder(confirmDelete.id);
                        setConfirmDelete({ isOpen: false, id: '' });
                    } finally {
                        setConfirmDelete(prev => ({ ...prev, loading: false }));
                    }
                }}
                title="Supprimer le dossier ?"
                message="Tous les sous-dossiers seront également supprimés. Les documents seront déplacés à la racine."
                loading={confirmDelete.loading}
                closeOnConfirm={false}
            />
        </div>
    );
};
