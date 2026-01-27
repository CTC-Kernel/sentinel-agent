/**
 * SMSIInspector.tsx
 * Inspector panel for viewing and managing SMSI milestones
 *
 * Story 20.2: Définition des Jalons
 * Story 20.4: Attribution des Responsables
 */

import React, { useMemo } from 'react';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Milestone } from '../../types/ebios';
import { Badge } from '../ui/Badge';
import { PHASE_CONFIG, MILESTONE_STATUS_CONFIG, PHASE_STYLES, MILESTONE_STATUS_STYLES } from './constants';
import { GlassCard } from '../ui/GlassCard';
import { Calendar, Users, Pencil, Trash2, Link, FileText, AlertTriangle } from '../ui/Icons';
import { Button } from '../ui/button';
import { cn } from '../../utils/cn';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useState } from 'react';

interface TeamMember {
    id: string;
    displayName: string;
    email: string;
}

interface LinkedItem {
    id: string;
    title: string;
    type: 'document' | 'control' | 'risk';
}

interface SMSIInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    milestone: Milestone | null;
    onStatusChange?: (id: string, status: Milestone['status']) => void;
    onEdit?: (milestone: Milestone) => void;
    onDelete?: (id: string) => Promise<void>;
    teamMembers?: TeamMember[];
    linkedItems?: LinkedItem[];
}

export const SMSIInspector: React.FC<SMSIInspectorProps> = ({
    isOpen,
    onClose,
    milestone,
    onStatusChange,
    onEdit,
    onDelete,
    teamMembers = [],
    linkedItems = []
}) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Get responsible person's display name - Story 20.4
    const responsibleName = useMemo(() => {
        if (!milestone?.responsibleId) return 'Non assigné';
        const member = teamMembers.find(m => m.id === milestone.responsibleId);
        return member?.displayName || member?.email || milestone.responsibleId;
    }, [milestone, teamMembers]);

    const handleDelete = async () => {
        if (!milestone || !onDelete) return;
        setIsDeleting(true);
        try {
            await onDelete(milestone.id);
            setShowDeleteConfirm(false);
            onClose();
        } finally {
            setIsDeleting(false);
        }
    };

    const isOverdue = milestone && milestone.status !== 'completed' && new Date(milestone.dueDate) < new Date();

    if (!milestone) return null;

    const phaseConfig = PHASE_CONFIG[milestone.phase];
    const statusConfig = MILESTONE_STATUS_CONFIG[milestone.status];
    const statusStyle = MILESTONE_STATUS_STYLES[milestone.status];
    const phaseStyle = PHASE_STYLES[milestone.phase];
    const StatusIcon = statusConfig.icon;

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={milestone.name}
            subtitle={milestone.phase ? `Phase ${phaseConfig.label}` : 'Programme SMSI'}
            width="max-w-2xl"
            statusBadge={
                <Badge
                    className={cn(
                        statusStyle.bg,
                        statusStyle.text
                    )}
                >
                    <div className="flex items-center gap-1.5">
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                    </div>
                </Badge>
            }
        >
            <div className="p-6 space-y-6">
                <GlassCard className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Informations</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-500 block mb-1">Description</label>
                            <p className="text-slate-900 dark:text-white">{milestone.description || 'Aucune description'}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-500 block mb-1">Échéance</label>
                                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                    {new Date(milestone.dueDate).toLocaleDateString()}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-500 block mb-1">Responsable</label>
                                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                                    <Users className="w-4 h-4 text-muted-foreground" />
                                    {responsibleName}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-500 block mb-1">Phase PDCA</label>
                            <div className="flex items-center gap-2">
                                {(() => {
                                    const PhaseIcon = phaseConfig.icon as React.ComponentType<{ className?: string }>;
                                    return <PhaseIcon className={cn("w-4 h-4", phaseStyle.text)} />;
                                })()}
                                <span className="text-slate-900 dark:text-white">{phaseConfig.label} - {phaseConfig.description}</span>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* Overdue Warning */}
                {isOverdue && (
                    <GlassCard className="p-4 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            <div>
                                <p className="font-medium text-red-700 dark:text-red-400">Jalon en retard</p>
                                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                                    Échéance dépassée depuis le {new Date(milestone.dueDate).toLocaleDateString('fr-FR')}
                                </p>
                            </div>
                        </div>
                    </GlassCard>
                )}

                {/* Linked Items */}
                {linkedItems.length > 0 && (
                    <GlassCard className="p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Link className="w-5 h-5" />
                            Éléments liés
                        </h3>
                        <div className="space-y-2">
                            {linkedItems.map(item => (
                                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-slate-700 dark:text-muted-foreground">{item.title}</span>
                                    <Badge variant="outline" size="sm" className="ml-auto capitalize">{item.type}</Badge>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                )}

                {(onStatusChange || onEdit || onDelete) && (
                    <GlassCard className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Actions</h3>
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                {onEdit && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEdit(milestone)}
                                        className="flex-1 justify-center"
                                    >
                                        <Pencil className="w-4 h-4 mr-2" />
                                        Modifier
                                    </Button>
                                )}
                                {onDelete && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>

                            {onStatusChange && (
                                <div>
                                    <label className="text-sm font-medium text-slate-500 block mb-2">Changer le statut</label>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(MILESTONE_STATUS_CONFIG).map(([status, config]) => {
                                            if (status === 'overdue') return null; // Don't allow manual setting to 'overdue'
                                            const isActive = milestone.status === status;
                                            const ConfigIcon = config.icon;
                                            const style = MILESTONE_STATUS_STYLES[status as Milestone['status']];
                                            return (
                                                <Button
                                                    key={status}
                                                    variant={isActive ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => onStatusChange(milestone.id, status as Milestone['status'])}
                                                    className={cn(
                                                        isActive && style.button
                                                    )}
                                                    disabled={isActive}
                                                >
                                                    <ConfigIcon className="w-4 h-4 mr-2" />
                                                    {config.label}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </GlassCard>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Supprimer le jalon"
                message={`Êtes-vous sûr de vouloir supprimer le jalon "${milestone.name}" ? Cette action est irréversible.`}
                confirmText="Supprimer"
                cancelText="Annuler"
                type="danger"
                loading={isDeleting}
            />
        </InspectorLayout>
    );
};
