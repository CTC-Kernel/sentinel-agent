import React from 'react';
import { motion } from 'framer-motion';
import { staggerContainerVariants } from '../ui/animationVariants';
import { BusinessProcess, BcpDrill } from '../../types';
import { ContinuitySummaryCard } from './dashboard/ContinuitySummaryCard';
import { ContinuityCharts } from './dashboard/ContinuityCharts';

interface ContinuityDashboardProps {
    processes: BusinessProcess[];
    drills: BcpDrill[];
    loading?: boolean;
}

export const ContinuityDashboard: React.FC<ContinuityDashboardProps> = ({ processes, drills }) => {


    return (
        <motion.div variants={staggerContainerVariants} initial="hidden" animate="visible" className="space-y-6 mb-8 animate-fade-in">

            {/* Top Row: Global Health & KPIs */}
            <ContinuitySummaryCard processes={processes} drills={drills} />

            {/* Charts Grid */}
            <ContinuityCharts processes={processes} drills={drills} />

        </motion.div>
    );
};
