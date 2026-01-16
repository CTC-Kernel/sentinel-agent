
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { PDCAPhase, Milestone, SMSIProgram } from '../../types/ebios';
import {
    ChevronRight,
    AlertTriangle,
    Users
} from 'lucide-react';

import { PHASE_CONFIG } from './constants';

interface SMSIDashboardProps {
    program: SMSIProgram;
    getMilestonesByPhase: (phase: PDCAPhase) => Milestone[];
    getOverdueMilestones: () => Milestone[];
}

export const SMSIDashboard: React.FC<SMSIDashboardProps> = ({
    program,
    getMilestonesByPhase,
    getOverdueMilestones
}) => {
    const [selectedPhase, setSelectedPhase] = useState<PDCAPhase | null>(null);
    const overdueMilestones = getOverdueMilestones();

    return (
        <div className="space-y-6">
            {/* Alerts for Overdue Milestones */}
            {overdueMilestones.length > 0 && (
                <GlassCard className="p-4 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-red-700 dark:text-red-400">
                                {overdueMilestones.length} jalon{overdueMilestones.length > 1 ? 's' : ''} en retard
                            </h4>
                            <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                                {overdueMilestones.map(m => m.name).join(', ')}
                            </p>
                        </div>
                    </div>
                </GlassCard>
            )}

            {/* Progress Overview */}
            <GlassCard className="p-6">
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cycle PDCA</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pilotage du cycle de vie SMSI</p>
                </div>

                {/* PDCA Progress Ring */}
                <div className="flex items-center justify-center gap-4 py-6 flex-wrap">
                    {(['plan', 'do', 'check', 'act'] as PDCAPhase[]).map((phase, index) => {
                        const config = PHASE_CONFIG[phase];
                        const phaseData = program.phases[phase];
                        const Icon = config.icon;
                        const isCurrentPhase = program.currentPhase === phase;
                        const phaseMilestones = getMilestonesByPhase(phase);

                        return (
                            <React.Fragment key={phase}>
                                <motion.button
                                    onClick={() => setSelectedPhase(selectedPhase === phase ? null : phase)}
                                    className={cn(
                                        "relative flex flex-col items-center p-4 rounded-2xl border-2 transition-all",
                                        "w-36 min-h-[140px]",
                                        isCurrentPhase
                                            ? `border-${config.color}-500 bg-${config.color}-50 dark:bg-${config.color}-900/20`
                                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300",
                                        selectedPhase === phase && "ring-2 ring-offset-2 ring-blue-500"
                                    )}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {isCurrentPhase && (
                                        <div className={`absolute -top-2 -right-2 w-5 h-5 bg-${config.color}-500 rounded-full flex items-center justify-center`}>
                                            <ChevronRight className="w-3 h-3 text-white" />
                                        </div>
                                    )}

                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center mb-3",
                                        `bg-${config.color}-100 dark:bg-${config.color}-900/30`
                                    )}>
                                        <Icon className={`w-6 h-6 text-${config.color}-600 dark:text-${config.color}-400`} />
                                    </div>

                                    <span className={cn(
                                        "text-sm font-bold",
                                        isCurrentPhase
                                            ? `text-${config.color}-600 dark:text-${config.color}-400`
                                            : "text-gray-600 dark:text-gray-400"
                                    )}>
                                        {config.label}
                                    </span>

                                    <span className="text-xs text-gray-500 mt-1">
                                        {phaseData.progress}%
                                    </span>

                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                                        <span>{phaseMilestones.length} jalons</span>
                                    </div>
                                </motion.button>

                                {index < 3 && (
                                    <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 hidden md:block" />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </GlassCard>

            {/* Phase Details */}
            <AnimatePresence mode="wait">
                {selectedPhase && (
                    <motion.div
                        key={selectedPhase}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <PhaseDetailsPanel
                            phase={selectedPhase}
                            program={program}
                            milestones={getMilestonesByPhase(selectedPhase)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface PhaseDetailsPanelProps {
    phase: PDCAPhase;
    program: SMSIProgram;
    milestones: Milestone[];
}

const PhaseDetailsPanel: React.FC<PhaseDetailsPanelProps> = ({ phase, program, milestones }) => {
    const config = PHASE_CONFIG[phase];
    const phaseData = program.phases[phase];
    const Icon = config.icon;

    const completedMilestones = milestones.filter(m => m.status === 'completed').length;

    return (
        <GlassCard className={`p-6 border-${config.color}-200 dark:border-${config.color}-900`}>
            <div className="flex items-center gap-4">
                <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0",
                    `bg-${config.color}-100 dark:bg-${config.color}-900/30`
                )}>
                    <Icon className={`w-7 h-7 text-${config.color}-600 dark:text-${config.color}-400`} />
                </div>

                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Phase {config.label}</h3>
                        <Badge
                            status={
                                phaseData.status === 'completed' ? 'success' :
                                    phaseData.status === 'in_progress' ? 'info' : 'warning'
                            }
                        >
                            {phaseData.status === 'completed' ? 'Terminée' :
                                phaseData.status === 'in_progress' ? 'En cours' : 'Non démarrée'}
                        </Badge>
                    </div>

                    <p className="text-gray-600 dark:text-gray-400 mb-4">{config.description}</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{phaseData.progress}%</div>
                            <div className="text-sm text-gray-500">Progression</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{completedMilestones}/{milestones.length}</div>
                            <div className="text-sm text-gray-500">Jalons</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                {phaseData.responsibleId ? (
                                    <Users className="w-5 h-5 text-blue-500" />
                                ) : (
                                    <span className="text-gray-400">-</span>
                                )}
                            </div>
                            <div className="text-sm text-gray-500">Responsable</div>
                        </div>
                    </div>
                </div>
            </div>
        </GlassCard>
    );
};
