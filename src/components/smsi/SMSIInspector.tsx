
import React from 'react';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Milestone } from '../../types/ebios';
import { Badge } from '../ui/Badge';
import { PHASE_CONFIG, MILESTONE_STATUS_CONFIG } from './constants';
import { GlassCard } from '../ui/GlassCard';
import { Calendar, Users } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../utils/cn';

interface SMSIInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    milestone: Milestone | null;
    onStatusChange?: (id: string, status: Milestone['status']) => void;
}

export const SMSIInspector: React.FC<SMSIInspectorProps> = ({
    isOpen,
    onClose,
    milestone,
    onStatusChange
}) => {
    if (!milestone) return null;

    const phaseConfig = PHASE_CONFIG[milestone.phase];
    const statusConfig = MILESTONE_STATUS_CONFIG[milestone.status];
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
                        `bg-${statusConfig.color}-100 dark:bg-${statusConfig.color}-900/30`,
                        `text-${statusConfig.color}-700 dark:text-${statusConfig.color}-400`
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
                                    {milestone.responsibleId || 'Non assigné'}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-500 block mb-1">Phase PDCA</label>
                            <div className="flex items-center gap-2">
                                <phaseConfig.icon className={`w-4 h-4 text-${phaseConfig.color}-500`} />
                                <span className="text-gray-900 dark:text-white">{phaseConfig.label} - {phaseConfig.description}</span>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {onStatusChange && (
                    <GlassCard className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Actions</h3>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(MILESTONE_STATUS_CONFIG).map(([status, config]) => {
                                if (status === 'overdue') return null; // Don't allow manual setting to 'overdue'
                                const isActive = milestone.status === status;
                                const ConfigIcon = config.icon;
                                return (
                                    <Button
                                        key={status}
                                        variant={isActive ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => onStatusChange(milestone.id, status as Milestone['status'])}
                                        className={cn(
                                            isActive && `bg-${config.color}-500 hover:bg-${config.color}-600`
                                        )}
                                        disabled={isActive}
                                    >
                                        <ConfigIcon className="w-4 h-4 mr-2" />
                                        Marquer comme {config.label}
                                    </Button>
                                );
                            })}
                        </div>
                    </GlassCard>
                )}
            </div>
        </InspectorLayout>
    );
};
