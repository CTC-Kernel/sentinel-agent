import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { Loader2, FileText, ChevronRight, Shield, AlertOctagon, Upload, Lock, CheckCircle } from '../../components/ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { CertificateUploadSection } from './CertificateUploadSection';

// Types for the partial data we receive
interface SharedAuditData {
    audit: {
        id: string;
        name: string;
        status: string;
        type: string;
        date: string;
        description: string;
        scope?: string;
    };

    findings: {
        id: string;
        type: string;
        description: string;
        createdAt: string;
    }[];
    documents: {
        id: string;
        name: string;
        type: string;
        url: string;
        category: string;
    }[];
    permissions: string[];
    auditorEmail: string;
}

export const ExternalAuditPortal: React.FC = () => {
    const { t } = useTranslation();
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [auditData, setAuditData] = useState<SharedAuditData | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'certify' | 'controls'>('overview');

    useEffect(() => {
        const loadAudit = async () => {
            if (!token || token.length < 10) {
                setError(t('certifier.portal.invalidLink'));
                setLoading(false);
                return;
            }
            try {
                // Determine if we are in a dev environment and mocking is needed or if real call works
                // For now, assuming real call
                const getAuditFn = httpsCallable(functions, 'getSharedAuditData');
                const result = await getAuditFn({ token });
                setAuditData(result.data as SharedAuditData);
            } catch (_err: unknown) {
                let errorMessage = t('certifier.portal.defaultError');
                const err = _err as { code?: string; message?: string };

                if (err.code === 'not-found') errorMessage = t('certifier.portal.notFound');
                else if (err.code === 'permission-denied') errorMessage = t('certifier.portal.expiredOrInvalid');
                else if (err.message) errorMessage = err.message;

                setError(errorMessage);
                ErrorLogger.error(_err as Error, 'ExternalAuditPortal.load');
            } finally {
                setLoading(false);
            }
        };

        loadAudit();
    }, [token, t]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
                <p className="text-slate-500 font-medium">{t('certifier.portal.loading')}</p>
            </div>
        );
    }

    if (error || !auditData) {
        return (
            <div className="max-w-md mx-auto mt-20 text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Lock className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('certifier.portal.accessDenied')}</h1>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl text-red-800 dark:text-red-200 text-sm">
                    {error || t('certifier.portal.invalidLink')}
                </div>
                <p className="text-slate-500 text-sm">
                    {t('certifier.portal.contactAdmin')}
                </p>
            </div>
        );
    }

    const { audit, auditorEmail, permissions } = auditData;

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-brand-500/20 dark:bg-brand-400/15 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 text-brand-600 font-medium text-sm mb-2">
                                <span className="bg-brand-50 dark:bg-brand-900 px-2 py-1 rounded text-xs uppercase tracking-wider">{audit.type}</span>
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                                <span className="text-slate-500 dark:text-slate-400">{new Date(audit.date).toLocaleDateString()}</span>
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{audit.name}</h1>
                            <p className="text-slate-600 dark:text-slate-300 max-w-2xl">{audit.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className={`px-4 py-1.5 rounded-full text-sm font-bold border ${audit.status === 'Validé' ? 'bg-green-100 text-green-700 dark:text-green-400 border-green-200' :
                                audit.status === 'Planifié' ? 'bg-blue-100 text-blue-700 dark:text-blue-400 border-blue-200' :
                                    'bg-orange-100 text-orange-700 dark:text-orange-400 border-orange-200'
                                }`}>
                                {audit.status}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                {t('certifier.portal.invitedAs')} <span className="text-slate-600 dark:text-slate-300 font-medium">{auditorEmail}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-6 mt-8 border-b border-slate-100 dark:border-white/5">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        {t('certifier.portal.tabs.overview')}
                    </button>
                    <button
                        onClick={() => setActiveTab('findings')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'findings' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        {t('certifier.portal.tabs.findings')} <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 rounded-md text-xs">{auditData.findings.length}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('controls')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'controls' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        {t('certifier.portal.tabs.evidence')} <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 rounded-md text-xs">{auditData.documents?.length || 0}</span>
                    </button>
                    {permissions.includes('certify') && (
                        <button
                            onClick={() => setActiveTab('certify')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'certify' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            {t('certifier.portal.tabs.certification')}
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="space-y-6">
                {activeTab === 'overview' && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-sm">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            {t('certifier.portal.overview.scope')}
                        </h2>
                        <div className="prose dark:prose-invert max-w-none text-slate-600">
                            {/* Mock content if scope is empty for better UI */}
                            <p>{audit.scope || t('certifier.portal.overview.defaultScope')}</p>

                            <h3 className="text-md font-semibold mt-6 mb-2">{t('certifier.portal.overview.refDocs')}</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>{t('certifier.portal.overview.docs.pssi')}</li>
                                <li>{t('certifier.portal.overview.docs.charter')}</li>
                                <li>{t('certifier.portal.overview.docs.gdpr')}</li>
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'findings' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                            <h2 className="font-bold flex items-center gap-2">
                                <AlertOctagon className="w-5 h-5 text-orange-500" />
                                {t('certifier.portal.findings.title')}
                            </h2>
                            {permissions.includes('write_findings') && (
                                <button className="btn-primary text-xs px-3 py-1.5">
                                    {t('certifier.portal.findings.new')}
                                </button>
                            )}
                        </div>

                        {auditData.findings.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-white/10">
                                <AlertOctagon className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium">{t('certifier.portal.findings.empty')}</p>
                            </div>
                        ) : (
                            auditData.findings.map((f, i) => (
                                <div key={i || 'unknown'} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${f.type === 'Majeure' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'}`}>{f.type}</span>
                                        <span className="text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-slate-800 dark:text-slate-200">{f.description}</p>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'certify' && token && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-sm">
                        <CertificateUploadSection token={token} />
                    </div>
                )}

                {activeTab === 'controls' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-brand-500" />
                                {t('certifier.portal.evidence.title')}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-300 mb-6">{t('certifier.portal.evidence.subtitle')}</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {auditData.documents && auditData.documents.length > 0 ? (
                                    auditData.documents.map(doc => (
                                        <div key={doc.id || 'unknown'} className="p-4 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">{doc.type}</span>
                                            </div>
                                            <h4 className="font-medium text-sm text-slate-900 dark:text-white mb-1 truncate" title={doc.name}>{doc.name}</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-300 mb-3">{doc.category || t('certifier.portal.evidence.defaultCategory')}</p>

                                            <a
                                                href={doc.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full py-2 flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:bg-brand-50 dark:group-hover:bg-brand-800 group-hover:text-brand-600 group-hover:border-brand-200 transition-all"
                                            >
                                                <Upload className="w-4 h-4 rotate-180" /> {t('certifier.portal.evidence.download')}
                                            </a>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                                        {t('certifier.portal.evidence.empty')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
