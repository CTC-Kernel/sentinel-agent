import React, { useState } from 'react';
import { SEO } from '../components/SEO';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { motion } from 'framer-motion';

import { useAudits } from '../hooks/audits/useAudits';
import { AuditsHeader } from '../components/audits/AuditsHeader';
import { AuditsList } from '../components/audits/AuditsList';
import { Drawer } from '../components/ui/Drawer';
import { AuditForm } from '../components/audits/AuditForm';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useStore } from '../store';
import { AuditInspector } from '../components/audits/AuditInspector';
import { Audit } from '../types';

export const Audits: React.FC = () => {
    const {
        audits, loading, canEdit, canDelete, controls, documents, assets, risks, usersList, projects,
        handleDeleteAudit, handleGeneratePlan, handleCreateAudit, handleUpdateAudit,
        refreshAudits, handleExportCSV, handleExportCalendar
    } = useAudits();

    const { user } = useStore();

    // Local UI State
    const [creationMode, setCreationMode] = useState(false);
    const [editingAudit, setEditingAudit] = useState<Audit | null>(null);
    const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Handle "View" or "Edit" Logic
    const handleEdit = (audit: Audit) => {
        setEditingAudit(audit);
        setCreationMode(true);
    };

    const handleDelete = (audit: Audit) => {
        setConfirmData({
            isOpen: true,
            title: "Supprimer l'audit ?",
            message: "Cette action est irréversible et supprimera tous les constats associés.",
            onConfirm: () => handleDeleteAudit(audit.id, audit.name)
        });
    };

    const handleOpen = (audit: Audit) => {
        setSelectedAudit(audit);
    };

    const onFormSubmit = async (data: any) => {
        if (editingAudit) {
            await handleUpdateAudit(editingAudit.id, data);
        } else {
            await handleCreateAudit(data);
        }
        setCreationMode(false);
        setEditingAudit(null);
    };

    // Role-based Title
    const role = user?.role || 'user';
    let auditsTitle = "Programme d'Audit";
    let auditsSubtitle = "Planification, exécution et suivi des audits internes et externes.";
    if (role === 'admin' || role === 'rssi') { auditsTitle = "Programme d'Audit & Conformité"; auditsSubtitle = "Orchestrez les audits ISO 27001, le suivi des écarts et les plans d'actions associés."; }
    else if (role === 'direction') { auditsTitle = 'Vue Exécutive des Audits'; auditsSubtitle = "Suivez l'état des audits, les non-conformités et les risques associés pour la direction."; }

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="space-y-6">
            <MasterpieceBackground />
            <SEO title="Audits & Conformité" description="Gestion des audits de sécurité" />

            <AuditsHeader
                title={auditsTitle}
                subtitle={auditsSubtitle}
                onNewAudit={() => { setEditingAudit(null); setCreationMode(true); }}
                onGeneratePlan={handleGeneratePlan}
                onExportCSV={handleExportCSV}
                onExportCalendar={handleExportCalendar}
                canEdit={canEdit}
                auditsCount={audits.length}
            />

            <motion.div variants={slideUpVariants} className="glass-panel p-6 rounded-2xl border border-glass-border">
                <AuditsList
                    audits={audits}
                    isLoading={loading}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onOpen={handleOpen}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />
            </motion.div>

            {/* Creation/Edit Drawer */}
            <Drawer
                isOpen={creationMode}
                onClose={() => { setCreationMode(false); setEditingAudit(null); }}
                title={editingAudit ? "Modifier l'audit" : "Nouvel Audit"}
            >
                <AuditForm
                    initialData={editingAudit || undefined}
                    onSubmit={onFormSubmit}
                    onCancel={() => { setCreationMode(false); setEditingAudit(null); }}
                    isLoading={loading}
                    assets={assets}
                    risks={risks}
                    controls={controls}
                    projects={projects}
                    usersList={usersList}
                />
            </Drawer>

            {/* Inspection Drawer */}
            <Drawer
                isOpen={!!selectedAudit}
                onClose={() => setSelectedAudit(null)}
                title={selectedAudit?.name || "Détails de l'audit"}
                width="max-w-6xl"
            >
                {selectedAudit && (
                    <AuditInspector
                        audit={selectedAudit}
                        onClose={() => setSelectedAudit(null)}
                        controls={controls}
                        documents={documents}
                        refreshAudits={refreshAudits}
                        canEdit={canEdit}
                    />
                )}
            </Drawer>

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />
        </motion.div >
    );
};
