import React, { useState } from 'react';
import { Button } from '../ui/button';
import { DocumentFolder } from '../../types';
import { Folder, ChevronRight, ChevronDown, Plus, MoreVertical, Edit2, Trash2, FolderOpen, Loader2 } from '../ui/Icons';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const folderSchema = z.object({
    name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom est trop long')
});

type FolderFormData = z.infer<typeof folderSchema>;

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

    // Form validation for folder creation
    const { register, handleSubmit, formState: { errors }, reset } = useForm<FolderFormData>({
        resolver: zodResolver(folderSchema),
        defaultValues: { name: '' }
    });

    const toggleExpand = React.useCallback((folderId: string, e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        setExpandedFolders(prev =>
            prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
        );
    }, []);

    const onSubmitFolder = React.useCallback(async (data: FolderFormData) => {
        setIsCreatingFolder(true);
        try {
            await onCreateFolder(data.name, createParentId);
            reset();
            setShowCreateModal(false);
        } finally {
            setIsCreatingFolder(false);
        }
    }, [createParentId, onCreateFolder, reset]);

    const handleUpdateSubmit = React.useCallback((id: string) => {
        if (newFolderName.trim()) {
            onUpdateFolder(id, newFolderName.trim());
            setEditingFolderId(null);
            setNewFolderName('');
        }
    }, [newFolderName, onUpdateFolder]);

    const handleBackdropClick = React.useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setShowCreateModal(false);
        }
    }, []);

    const handleContextMenuBackdropClick = React.useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleConfirmDeleteClose = React.useCallback(() => {
        setConfirmDelete({ isOpen: false, id: '' });
    }, []);

    const handleConfirmDeleteAction = React.useCallback(async () => {
        setConfirmDelete(prev => ({ ...prev, loading: true }));
        try {
            await onDeleteFolder(confirmDelete.id);
            setConfirmDelete({ isOpen: false, id: '' });
        } finally {
            setConfirmDelete(prev => ({ ...prev, loading: false }));
        }
    }, [confirmDelete.id, onDeleteFolder]);

    const handleCreateRoot = React.useCallback(() => {
        setCreateParentId(undefined);
        setShowCreateModal(true);
    }, []);

    const handleSelectAll = React.useCallback(() => onSelectFolder(null), [onSelectFolder]);
    const handleSelectAllKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSelectFolder(null);
        }
    }, [onSelectFolder]);

    const handleContextMenuOpen = React.useCallback((e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({ id, x: e.clientX, y: e.clientY });
    }, []);

    const handleContextMenuCreateSub = React.useCallback(() => {
        if (!contextMenu) return;
        setCreateParentId(contextMenu.id);
        setShowCreateModal(true);
        setContextMenu(null);
    }, [contextMenu]);

    const handleContextMenuRename = React.useCallback(() => {
        if (!contextMenu) return;
        setEditingFolderId(contextMenu.id);
        const folder = folders.find(f => f.id === contextMenu.id);
        if (folder) {
            setNewFolderName(folder.name);
        }
        setContextMenu(null);
    }, [contextMenu, folders]);

    const handleContextMenuDelete = React.useCallback(() => {
        if (!contextMenu) return;
        setConfirmDelete({ isOpen: true, id: contextMenu.id });
        setContextMenu(null);
    }, [contextMenu]);

    const handleCreateModalClose = React.useCallback(() => {
        setShowCreateModal(false);
        reset();
    }, [reset]);
    const handleNewFolderNameChange = React.useCallback((val: string) => setNewFolderName(val), []);

    const rootFolders = React.useMemo(() => folders.filter(f => !f.parentId).sort((a, b) => a.name.localeCompare(b.name)), [folders]);

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">Dossiers</h3>
                <Button
                    aria-label="Créer un nouveau dossier racine"
                    onClick={handleCreateRoot}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-600 hover:text-brand-600"
                    title="Nouveau dossier racine"
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                <div
                    className={`flex items-center py-2 px-3 rounded-lg cursor-pointer mb-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${selectedFolderId === null ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'}`}
                    onClick={handleSelectAll}
                    tabIndex={0}
                    onKeyDown={handleSelectAllKeyDown}
                >
                    <div className="w-5 mr-1" /> {/* Spacer for alignment */}
                    <Folder className="h-4 w-4 mr-2 text-slate-500" />
                    <span className="text-sm font-medium">Tous les documents</span>
                </div>
                {rootFolders.map(f => (
                    <FolderNode
                        key={f.id}
                        folder={f}
                        folders={folders}
                        depth={0}
                        expandedFolders={expandedFolders}
                        selectedFolderId={selectedFolderId}
                        editingFolderId={editingFolderId}
                        newFolderName={newFolderName}
                        onSelect={onSelectFolder}
                        onExpand={toggleExpand}
                        onContextMenu={handleContextMenuOpen}
                        onNameChange={handleNewFolderNameChange}
                        onUpdateSubmit={handleUpdateSubmit}
                    />
                ))}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Escape' && setShowCreateModal(false)}
                    className="fixed inset-0 z-modal flex items-center justify-center bg-black/20 backdrop-blur-sm cursor-default"
                    onClick={handleBackdropClick}
                >
                    <div className="glass-premium p-4 sm:p-6 rounded-4xl shadow-2xl w-80 border border-white/20 relative overflow-hidden" onClick={e => e.stopPropagation()} role="presentation">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-white/10 dark:to-transparent pointer-events-none" />
                        <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white relative z-10">Nouveau Dossier</h3>
                        <form onSubmit={handleSubmit(onSubmitFolder)}>
                            <div>
                                <input
                                    {...register('name')}
                                    aria-label="Nom du nouveau dossier"
                                    type="text"
                                    placeholder="Nom du dossier"
                                    className={`w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border ${errors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
                                        } mb-1 focus:ring-2 focus-visible:ring-brand-500 outline-none`}
                                    autoFocus
                                />
                                {errors.name && (
                                    <p className="text-red-500 text-xs mb-3">{errors.name.message}</p>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 relative z-10">
                                <Button
                                    aria-label="Annuler la création"
                                    type="button"
                                    onClick={handleCreateModalClose}
                                    variant="ghost"
                                    disabled={isCreatingFolder}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    aria-label="Confirmer la création"
                                    type="submit"
                                    className="bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white shadow-lg shadow-brand-500/20 hover:scale-105"
                                    disabled={isCreatingFolder}
                                >
                                    {isCreatingFolder && <Loader2 className="animate-spin mr-2 h-4 w-4" />} Créer
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Escape' && setContextMenu(null)}
                        className="fixed inset-0 z-header cursor-default"
                        onClick={handleContextMenuBackdropClick}
                    />
                    <div
                        className="fixed z-modal glass-premium rounded-xl shadow-2xl border border-white/20 py-1 w-48 animate-scale-in overflow-hidden backdrop-blur-md"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <Button
                            aria-label="Nouveau sous-dossier"
                            onClick={handleContextMenuCreateSub}
                            variant="ghost"
                            className="w-full justify-start text-sm font-normal px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Nouveau sous-dossier
                        </Button>
                        <Button
                            aria-label="Renommer le dossier"
                            onClick={handleContextMenuRename}
                            variant="ghost"
                            className="w-full justify-start text-sm font-normal px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                        >
                            <Edit2 className="h-4 w-4 mr-2" /> Renommer
                        </Button>
                        <div className="h-px bg-slate-100 dark:bg-white/5 my-1" />
                        <Button
                            aria-label="Supprimer le dossier"
                            onClick={handleContextMenuDelete}
                            variant="ghost"
                            className="w-full justify-start text-sm font-normal px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                            <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                        </Button>
                    </div>
                </>
            )}

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={handleConfirmDeleteClose}
                onConfirm={handleConfirmDeleteAction}
                title="Supprimer le dossier ?"
                message="Tous les sous-dossiers seront également supprimés. Les documents seront déplacés à la racine."
                loading={confirmDelete.loading}
                closeOnConfirm={false}
            />
        </div>
    );
};

interface FolderNodeProps {
    folder: DocumentFolder;
    folders: DocumentFolder[];
    depth: number;
    expandedFolders: string[];
    selectedFolderId: string | null;
    editingFolderId: string | null;
    newFolderName: string;
    onSelect: (id: string | null) => void;
    onExpand: (id: string, e: React.MouseEvent | React.KeyboardEvent) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onNameChange: (name: string) => void;
    onUpdateSubmit: (id: string) => void;
}

const FolderNode = React.memo(({
    folder,
    folders,
    depth,
    expandedFolders,
    selectedFolderId,
    editingFolderId,
    newFolderName,
    onSelect,
    onExpand,
    onContextMenu,
    onNameChange,
    onUpdateSubmit
}: FolderNodeProps) => {
    const children = React.useMemo(() => folders.filter(f => f.parentId === folder.id).sort((a, b) => a.name.localeCompare(b.name)), [folders, folder.id]);
    const isExpanded = expandedFolders.includes(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const isEditing = editingFolderId === folder.id;

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSelect(folder.id);
        } else if (e.key === 'ArrowRight' && !isExpanded) {
            onExpand(folder.id, e);
        } else if (e.key === 'ArrowLeft' && isExpanded) {
            onExpand(folder.id, e);
        }
    }, [folder.id, isExpanded, onSelect, onExpand]);

    const handleContextMenuFn = React.useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        onContextMenu(e, folder.id);
    }, [folder.id, onContextMenu]);

    const handleExpandClick = React.useCallback((e: React.MouseEvent) => onExpand(folder.id, e), [folder.id, onExpand]);
    const handleSelectClick = React.useCallback(() => onSelect(folder.id), [folder.id, onSelect]);
    const handleUpdateBlur = React.useCallback(() => onUpdateSubmit(folder.id), [folder.id, onUpdateSubmit]);
    const handleUpdateKeyDown = React.useCallback((e: React.KeyboardEvent) => e.key === 'Enter' && onUpdateSubmit(folder.id), [folder.id, onUpdateSubmit]);
    const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value), [onNameChange]);
    const handleMoreClick = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onContextMenu(e, folder.id);
    }, [folder.id, onContextMenu]);

    return (
        <div className="select-none">
            <div
                className={`flex items-center py-2 px-3 rounded-lg cursor-pointer transition-colors group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isSelected ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'}`}
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
                onClick={handleSelectClick}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onContextMenu={handleContextMenuFn}
            >
                <Button
                    aria-label={isExpanded ? "Replier le dossier" : "Déplier le dossier"}
                    onClick={handleExpandClick}
                    variant="ghost"
                    size="icon"
                    className={`h-6 w-6 rounded mr-1 ${children.length === 0 ? 'invisible' : ''}`}
                >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </Button>

                {isEditing ? (
                    <input value={newFolderName} onChange={handleInputChange} onBlur={handleUpdateBlur} onKeyDown={handleUpdateKeyDown}
                        aria-label="Renommer le dossier"
                        type="text"
                        autoFocus
                        className="flex-1 bg-white dark:bg-slate-800 border border-brand-500 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus-visible:ring-brand-500"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <div className="flex items-center flex-1 overflow-hidden">
                        {isExpanded ? <FolderOpen className="h-4 w-4 mr-2 text-brand-500" /> : <Folder className="h-4 w-4 mr-2 text-brand-500" />}
                        <span className="truncate text-sm font-medium">{folder.name}</span>
                    </div>
                )}

                <Button
                    aria-label="Options du dossier"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded"
                    variant="ghost"
                    size="icon"
                    onClick={handleMoreClick}
                >
                    <MoreVertical className="h-3 w-3" />
                </Button>
            </div>

            {isExpanded && children.map(child => (
                <FolderNode
                    key={child.id}
                    folder={child}
                    folders={folders}
                    depth={depth + 1}
                    expandedFolders={expandedFolders}
                    selectedFolderId={selectedFolderId}
                    editingFolderId={editingFolderId}
                    newFolderName={newFolderName}
                    onSelect={onSelect}
                    onExpand={onExpand}
                    onContextMenu={onContextMenu}
                    onNameChange={onNameChange}
                    onUpdateSubmit={onUpdateSubmit}
                />
            ))}
        </div>
    );
});
