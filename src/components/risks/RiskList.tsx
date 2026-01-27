import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ShieldAlert } from '../ui/Icons';
import { DataTable } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { Risk, Asset, UserProfile } from '../../types';
import { slideUpVariants } from '../ui/animationVariants';
import { useRiskColumns } from './list/RiskColumns';

interface RiskListProps {
    risks: Risk[];
    loading: boolean;
    canEdit: boolean;
    assets: Asset[];
    users: UserProfile[];
    onEdit: (risk: Risk) => void;
    onDelete: (id: string, name: string) => void;
    onDuplicate?: (risk: Risk) => void;
    onBulkDelete: (ids: string[]) => void;
    onSelect: (risk: Risk) => void;
    duplicatingIds?: Set<string>;
    emptyStateTitle?: string;
    emptyStateDescription?: string;
    emptyStateActionLabel?: string;
    onEmptyStateAction?: () => void;
    searchQuery?: string;
}

export const RiskList = React.memo<RiskListProps>(({
    risks, loading, canEdit, assets, users, onEdit, onDelete, onDuplicate, onBulkDelete, onSelect,
    duplicatingIds = new Set(),
    emptyStateTitle, emptyStateDescription, emptyStateActionLabel, onEmptyStateAction,
    searchQuery = ''
}) => {
    const { t } = useTranslation();
    const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set());

    const handleDelete = React.useCallback(async (id: string, name: string) => {
        if (deletingIds.has(id)) return;
        setDeletingIds(prev => new Set(prev).add(id));
        try {
            await onDelete(id, name);
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }, [deletingIds, onDelete]);

    const columns = useRiskColumns({
        canEdit,
        assets,
        users,
        onEdit,
        onDelete: handleDelete,
        onDuplicate,
        deletingIds,
        duplicatingIds,
        searchQuery,
    });

    return (
        <motion.div variants={slideUpVariants} className="glass-premium w-full max-w-full rounded-3xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            <div className="relative z-10">
                <DataTable
                    columns={columns}
                    data={risks}
                    selectable={canEdit}
                    onRowClick={(risk) => onSelect(risk)}
                    searchable={false}
                    exportable={false}
                    loading={loading}
                    onBulkDelete={onBulkDelete}
                    emptyState={
                        <EmptyState
                            icon={ShieldAlert}
                            title={emptyStateTitle || t('common.noResults')}
                            description={emptyStateDescription || t('common.emptyChart.addData')}
                            actionLabel={emptyStateActionLabel || t('common.create')}
                            onAction={onEmptyStateAction || (() => window.dispatchEvent(new CustomEvent('open-risk-modal')))}
                            color="emerald"
                        />
                    }
                />
            </div>
        </motion.div>
    );
});

