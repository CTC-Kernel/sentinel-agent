
import React from 'react';
import { PremiumCard } from '../ui/PremiumCard';
import { Button } from '../ui/button';
import { Plus } from '../ui/Icons';
import { Milestone, PDCAPhase } from '../../types/ebios';
import { cn } from '../../utils/cn';
import { motion } from 'framer-motion';
import { Badge } from '../ui/Badge';
import { PHASE_CONFIG, MILESTONE_STATUS_CONFIG, PHASE_STYLES, MILESTONE_STATUS_STYLES } from './constants';
import { useLocale } from '@/hooks/useLocale';

interface SMSIMilestoneListProps {
    milestones: Milestone[];
    onSelect?: (milestone: Milestone) => void;
    onAddMilestone?: () => void;
    filterPhase?: PDCAPhase;
}

export const SMSIMilestoneList: React.FC<SMSIMilestoneListProps> = ({
    milestones,
    onSelect,
    onAddMilestone,
    filterPhase
}) => {
    const displayedMilestones = filterPhase
        ? milestones.filter(m => m.phase === filterPhase)
        : milestones;

    return (
        <PremiumCard glass className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">
                    Jalons du programme
                    {filterPhase && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                            ({PHASE_CONFIG[filterPhase].label})
                        </span>
                    )}
                </h3>
                <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={onAddMilestone}
                >
                    <Plus className="w-4 h-4" />
                    Ajouter un jalon
                </Button>
            </div>

            {displayedMilestones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    {filterPhase
                        ? `Aucun jalon pour la phase ${PHASE_CONFIG[filterPhase].label}.`
                        : 'Aucun jalon défini. Ajoutez des jalons pour suivre l\'avancement du programme.'
                    }
                </div>
            ) : (
                <div className="space-y-3">
                    {displayedMilestones.map((milestone) => (
                        <MilestoneCard key={milestone.id || 'unknown'} milestone={milestone} onClick={() => onSelect?.(milestone)} />
                    ))}
                </div>
            )}
        </PremiumCard>
    );
};

interface MilestoneCardProps {
    milestone: Milestone;
    onClick?: () => void;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({ milestone, onClick }) => {
    const { config } = useLocale();
    const phaseConfig = PHASE_CONFIG[milestone.phase];
    const statusConfig = MILESTONE_STATUS_CONFIG[milestone.status];
    const phaseStyle = PHASE_STYLES[milestone.phase];
    const statusStyle = MILESTONE_STATUS_STYLES[milestone.status];
    const StatusIcon = statusConfig.icon;
    const PhaseIcon = phaseConfig.icon as React.ComponentType<{ className?: string }>;

    const dueDate = new Date(milestone.dueDate);
    const isOverdue = milestone.status !== 'completed' && dueDate < new Date();

    return (
        <motion.div
            className={cn(
                "glass-premium flex items-center gap-4 p-4 rounded-3xl border transition-all hover:scale-105 cursor-pointer",
                isOverdue
                    ? "border-error-border bg-error-bg/50"
                    : "hover:border-primary-500/30"
            )}
            whileHover={{ x: 4 }}
            onClick={onClick}
        >
            <div className={cn(
                "w-10 h-10 rounded-3xl flex items-center justify-center flex-shrink-0",
                phaseStyle.iconBg
            )}>
                <PhaseIcon className={cn("w-5 h-5", phaseStyle.iconText)} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground truncate">{milestone.name}</h4>
                    <Badge variant="outline" size="sm">
                        {phaseConfig.label}
                    </Badge>
                </div>
                {milestone.description && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{milestone.description}</p>
                )}
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right hidden sm:block">
                    <div className={cn(
                        "text-sm font-medium",
                        isOverdue ? "text-error-text" : "text-muted-foreground"
                    )}>
                        {dueDate.toLocaleDateString(config.intlLocale)}
                    </div>
                    <div className="text-xs text-muted-foreground">Échéance</div>
                </div>

                <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium",
                    statusStyle.bg,
                    statusStyle.text
                )}>
                    <StatusIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">{statusConfig.label}</span>
                </div>
            </div>
        </motion.div>
    );
};
