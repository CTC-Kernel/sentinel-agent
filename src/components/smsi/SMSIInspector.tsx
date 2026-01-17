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
import { Calendar, Users, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../utils/cn';

interface TeamMember {
    id: string;
    displayName: string;
    email: string;
}

interface SMSIInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    milestone: Milestone | null;
    onStatusChange?: (id: string, status: Milestone['status']) => void;
    onEdit?: (milestone: Milestone) => void;
    teamMembers?: TeamMember[];
}

export const SMSIInspector: React.FC<SMSIInspectorProps> = ({
    isOpen,
    onClose,
    milestone,
    onStatusChange,
    onEdit,
    teamMembers = []
}) => {
    if (!milestone) return null;

    const phaseConfig = PHASE_CONFIG[milestone.phase];
    const statusConfig = MILESTONE_STATUS_CONFIG[milestone.status];
    const statusStyle = MILESTONE_STATUS_STYLES[milestone.status];
    const phaseStyle = PHASE_STYLES[milestone.phase];
    const StatusIcon = statusConfig.icon;

    // Get responsible person's display name - Story 20.4
    const responsibleName = useMemo(() => {
        if (!milestone.responsibleId) return 'Non assigné';
        const member = teamMembers.find(m => m.id === milestone.responsibleId);
        return member?.displayName || member?.email || milestone.responsibleId;
    }, [milestone.responsibleId, teamMembers]);

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
                            <label className="text-sm font-medium text-gray-500 block mb-1">Description</label>
                            <p className="text-gray-900 dark:text-white">{milestone.description || 'Aucune description'}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-500 block mb-1">Échéance</label>
                                <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    {new Date(milestone.dueDate).toLocaleDateString()}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-500 block mb-1">Responsable</label>
                                <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                                    <Users className="w-4 h-4 text-gray-400" />
                                    {responsibleName}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-500 block mb-1">Phase PDCA</label>
                            <div className="flex items-center gap-2">
                                <phaseConfig.icon className={cn("w-4 h-4", phaseStyle.text)} />
                                <span className="text-gray-900 dark:text-white">{phaseConfig.label} - {phaseConfig.description}</span>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {(onStatusChange || onEdit) && (
                    <GlassCard className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Actions</h3>
                        <div className="space-y-4">
                            {onEdit && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onEdit(milestone)}
                                    className="w-full justify-start"
                                >
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Modifier le jalon
                                </Button>
                            )}

                            {onStatusChange && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500 block mb-2">Changer le statut</label>
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
        </InspectorLayout>
    );
};
