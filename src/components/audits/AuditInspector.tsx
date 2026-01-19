import React, { useState, useEffect } from 'react';
import { Audit, Control, Document as GRCDocument, Asset, Risk, Project, UserProfile } from '../../types';
import { useAuditDetails } from '../../hooks/audits/useAuditDetails';
import { InspectorLayout } from '../ui/InspectorLayout';
import { AlertOctagon, ClipboardCheck, FileText, Target, Trash2, CheckCheck, Loader2, History, ShieldCheck, Download } from 'lucide-react';
import { ResourceHistory } from '../shared/ResourceHistory';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { SingleAuditStats } from './SingleAuditStats';
import { useStore } from '../../store';
import { canDeleteResource } from '../../utils/permissions';
import { AuditForm } from './AuditForm';
import { ShareAuditDrawer } from './ShareAuditDrawer';
import { AssignPartnerDrawer } from './AssignPartnerDrawer';
import { toast } from '@/lib/toast';

// Sub-components
import { AuditFindings } from './inspector/AuditFindings';
import { AuditChecklist } from './inspector/AuditChecklist';
import { AuditCertification } from './inspector/AuditCertification';

interface AuditInspectorProps {
    audit: Audit;
    onClose: () => void;
    controls: Control[];
    documents: GRCDocument[];
    assets: Asset[];
    risks: Risk[];
    projects: Project[];
    usersList: UserProfile[];
    refreshAudits: () => void;
    canEdit: boolean;
    onDelete: (id: string, name: string) => void;
}

export const AuditInspector: React.FC<AuditInspectorProps> = ({
    audit, onClose, controls, documents, assets, risks, projects, usersList,
    refreshAudits, canEdit, onDelete
}) => {
    const { user, t } = useStore();
    const {
        findings, checklist, fetchDetails,
        handleAddFinding, handleDeleteFinding,
        generateChecklist, handleChecklistAnswer,
        validateAudit, generateAuditReport, handleExportPack,
        handleEvidenceUploadForFinding, updateAuditDetails,
        isGeneratingReport, isValidating
    } = useAuditDetails(audit, controls, documents, refreshAudits);

    const [activeTab, setActiveTab] = useState('details');
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    const tabs = [
        { id: 'details', label: t('audits.tabs.details'), icon: FileText },
        { id: 'findings', label: t('audits.tabs.findings'), icon: AlertOctagon },
        { id: 'checklist', label: t('audits.tabs.checklist'), icon: ClipboardCheck },
        { id: 'dashboard', label: t('audits.tabs.dashboard'), icon: Target },
        { id: 'certification', label: 'Certification / Externe', icon: ShieldCheck },
        { id: 'history', label: t('audits.tabs.history'), icon: History },
    ];

    return (
        <InspectorLayout
            isOpen={true}
            onClose={onClose}
            title={audit.name}
            subtitle={`${audit.type} • ${audit.status}`}
            width="max-w-6xl"
            actions={
                <div className="flex items-center gap-2">
                    {canDeleteResource(user, 'Audit') && (
                        <CustomTooltip content={t('audits.inspector.deleteConfirm')}>
                            <button type="button" onClick={() => onDelete(audit.id, audit.name)} aria-label={t('audits.inspector.deleteConfirm')} className="p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                                <Trash2 className="h-5 w-5" />
                            </button>
                        </CustomTooltip>
                    )}
                    <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-2" />

                    {audit.status !== 'Validé' && canEdit && (
                        <button
                            type="button"
                            onClick={validateAudit}
                            disabled={isValidating}
                            aria-label={t('audits.inspector.validate')}
                            className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isValidating ? 'opacity-75 cursor-wait' : ''}`}
                        >
                            {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                            <span className="hidden sm:inline">{t('audits.inspector.validate')}</span>
                        </button>
                    )}

                    <CustomTooltip content={t('audits.inspector.generateReport')}>
                        <button type="button" onClick={() => generateAuditReport([])} disabled={isGeneratingReport} aria-label={t('audits.inspector.generateReport')} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                            {isGeneratingReport ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                        </button>
                    </CustomTooltip>
                    <CustomTooltip content={t('audits.inspector.exportPack')}>
                        <button type="button" onClick={handleExportPack} aria-label={t('audits.inspector.exportPack')} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                            <Download className="h-5 w-5" />
                        </button>
                    </CustomTooltip>
                </div>
            }
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'details' && (
                <div className="p-6">
                    <AuditForm
                        existingAudit={audit}
                        onSubmit={async (data) => {
                            await updateAuditDetails(data);
                        }}
                        onCancel={onClose}
                        assets={assets}
                        risks={risks}
                        controls={controls}
                        projects={projects}
                        usersList={usersList}
                        readOnly={!canEdit}
                    />
                </div>
            )}
            <div className="space-y-6 max-w-7xl mx-auto">
                {activeTab === 'findings' && (
                    <AuditFindings
                        audit={audit}
                        controls={controls}
                        findings={findings}
                        canEdit={canEdit}
                        onAddFinding={handleAddFinding}
                        onDeleteFinding={handleDeleteFinding}
                        onUploadEvidence={handleEvidenceUploadForFinding}
                    />
                )}

                {activeTab === 'checklist' && (
                    <AuditChecklist
                        checklist={checklist}
                        canEdit={canEdit}
                        onGenerate={generateChecklist}
                        onAnswer={handleChecklistAnswer}
                    />
                )}

                {activeTab === 'dashboard' && (
                    <SingleAuditStats audit={audit} findings={findings} />
                )}

                {activeTab === 'certification' && (
                    <AuditCertification
                        canEdit={canEdit}
                        onOpenShareModal={() => setIsShareModalOpen(true)}
                        onOpenAssignModal={() => setIsAssignModalOpen(true)}
                    />
                )}

                {activeTab === 'history' && (
                    <ResourceHistory resourceId={audit.id} resourceType="Audit" />
                )}
            </div>

            <ShareAuditDrawer
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                auditId={audit.id}
                auditName={audit.name}
            />

            <AssignPartnerDrawer
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                auditId={audit.id}
                auditName={audit.name}
                onAssigned={() => {
                    toast.success('Partenaire assigné avec succès');
                }}
            />
        </InspectorLayout>
    );
};
