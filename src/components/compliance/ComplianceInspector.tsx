import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Control, UserProfile, Asset, Supplier, Risk, Project, Document, Finding, Framework } from '../../types';
import { ScrollableTabs } from '../../components/ui/ScrollableTabs';
import { Loader2, Link, FileText, Paperclip, MessageSquare } from '../../components/ui/Icons';
import { DiscussionPanel } from '../collaboration/DiscussionPanel';
import { TimelineView } from '../shared/TimelineView';
import { ComplianceDetails } from './inspector/ComplianceDetails';
import { ComplianceEvidence } from './inspector/ComplianceEvidence';
import { ComplianceLinkedItems } from './inspector/ComplianceLinkedItems';

interface ComplianceInspectorProps {
    control: Control;
    canEdit: boolean;
    usersList: UserProfile[];
    assets: Asset[];
    suppliers: Supplier[];
    documents: Document[];
    risks: Risk[];
    projects: Project[];
    findings: Finding[];
    linkingToProjectId?: string | null;
    linkingToProjectName?: string | null;
    enabledFrameworks?: Framework[];
    handlers: {
        updating: boolean;
        handleStatusChange: (c: Control, s: Control['status']) => Promise<void>;
        handleAssign: (c: Control, uid: string) => Promise<void>;
        handleLinkAsset: (c: Control, aid: string) => Promise<void>;
        handleUnlinkAsset: (c: Control, aid: string) => Promise<void>;
        handleLinkSupplier: (c: Control, sid: string) => Promise<void>;
        handleUnlinkSupplier: (c: Control, sid: string) => Promise<void>;
        handleLinkProject: (c: Control, pid: string) => Promise<void>;
        handleUnlinkProject: (c: Control, pid: string) => Promise<void>;
        handleLinkDocument: (c: Control, did: string) => Promise<void>;
        handleUnlinkDocument: (c: Control, did: string) => Promise<void>;
        updateJustification: (c: Control, text: string) => Promise<void>;
        onUploadEvidence: (c: Control) => void;
        handleMapFramework?: (c: Control, f: Framework) => Promise<void>;
        handleUnmapFramework?: (c: Control, f: Framework) => Promise<void>;
    };
}

export const ComplianceInspector: React.FC<ComplianceInspectorProps> = ({
    control,
    canEdit,
    usersList,
    assets,
    suppliers,
    documents,
    risks,
    projects,
    findings,
    linkingToProjectId,
    linkingToProjectName,
    enabledFrameworks,
    handlers
}) => {
    type InspectorTabId = 'details' | 'evidence' | 'comments' | 'history' | 'linkedItems';
    const [activeTab, setActiveTab] = useState<InspectorTabId>('details');

    const { updating, handleLinkProject } = handlers;

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900/50">
            {/* Tabs Header */}
            <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100 dark:border-white/5">
                {linkingToProjectId && (
                    <div className="bg-brand-50/50 dark:bg-brand-900/10 px-6 py-3 border-b border-brand-100 dark:border-brand-900/30 flex items-center justify-between animate-fade-in">
                        <div className="flex items-center text-sm text-brand-700 dark:text-brand-300">
                            <Link className="h-4 w-4 mr-2" />
                            <span className="font-medium">Lier ce contrôle au projet <strong>{linkingToProjectName}</strong> ?</span>
                        </div>
                        <Button
                            aria-label={`Lier le contrôle au projet ${linkingToProjectName}`}
                            onClick={() => handleLinkProject(control, linkingToProjectId)}
                            disabled={updating || (Array.isArray(control.relatedProjectIds) ? control.relatedProjectIds : []).includes(linkingToProjectId)}
                            size="sm"
                            className="text-xs font-bold shadow-sm"
                        >
                            {updating ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Link className="h-3 w-3 mr-1.5" />}
                            {(Array.isArray(control.relatedProjectIds) ? control.relatedProjectIds : []).includes(linkingToProjectId) ? 'Déjà lié' : 'Lier maintenant'}
                        </Button>
                    </div>
                )}

                <ScrollableTabs
                    tabs={[
                        { id: 'details', label: 'Détails', icon: FileText },
                        { id: 'evidence', label: `Preuves (${control.evidenceIds?.length || 0})`, icon: Paperclip },
                        { id: 'linkedItems', label: 'Éléments Liés', icon: Link },
                        { id: 'comments', label: 'Discussion', icon: MessageSquare },
                        { id: 'history', label: 'Historique', icon: FileText },
                    ]}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as InspectorTabId)}
                />
            </div>

            <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                {activeTab === 'details' && (
                    <ComplianceDetails
                        control={control}
                        canEdit={canEdit}
                        usersList={usersList}
                        enabledFrameworks={enabledFrameworks}
                        handlers={handlers}
                    />
                )}

                {activeTab === 'evidence' && (
                    <ComplianceEvidence
                        control={control}
                        canEdit={canEdit}
                        documents={documents}
                        handlers={handlers}
                    />
                )}

                {activeTab === 'linkedItems' && (
                    <ComplianceLinkedItems
                        control={control}
                        canEdit={canEdit}
                        assets={assets}
                        suppliers={suppliers}
                        projects={projects}
                        risks={risks}
                        findings={findings}
                        handlers={handlers}
                    />
                )}

                {activeTab === 'comments' && (
                    <div className="max-w-3xl mx-auto">
                        <DiscussionPanel
                            collectionName="controls"
                            documentId={control.id}
                            title={`Discussion - ${control.code} ${control.name}`}
                            enableSearch={true}
                            enableFilters={true}
                            enableExport={true}
                            enableNotifications={true}
                        />
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="max-w-3xl mx-auto">
                        <TimelineView resourceId={control.id} resourceType="Control" />
                    </div>
                )}
            </div>
        </div>
    );
};

