import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { toast } from '@/lib/toast';
import { useStore } from '../../store';
import { useLocale } from '@/hooks/useLocale';
import {
    Download,
    BookOpen,
    HelpCircle,
    Headset,
    Monitor,
    Cpu,
    Terminal,
    ExternalLink,
    ChevronUp,
    ChevronDown
} from '../ui/Icons';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { EnrollmentTokenPanel } from '../agents/EnrollmentTokenPanel';

export interface PlatformInfo {
    displayName: string;
    available: boolean;
    downloadUrl: string;
    directUrl: string | null;
    checksum?: string;
    fileSize?: string;
}

export interface ReleaseInfo {
    product: string;
    currentVersion: string;
    releaseDate?: string;
    changelogUrl?: string;
    platforms: Record<string, PlatformInfo>;
    mobile?: {
        ios: { available: boolean; appStoreUrl: string; comingSoon: boolean };
        android: { available: boolean; playStoreUrl: string; comingSoon: boolean };
    };
}

interface EnrollAgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    enrollmentToken: string | null;
    releaseInfo: ReleaseInfo | null;
    loadingReleases: boolean;
}

// Download Button Component
interface DownloadButtonProps {
    platform: string;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    available?: boolean;
    loading?: boolean;
}

const DownloadButton: React.FC<DownloadButtonProps & { downloadUrl?: string }> = ({ label, sublabel, icon, available = true, loading = false, downloadUrl }) => {
    const { t } = useStore();
    const handleDownload = () => {
        if (loading) return;
        if (!available) {
            toast.info(t('settings.agents.toast.versionComingSoon', { defaultValue: "Cette version sera disponible prochainement" }));
            return;
        }
        if (downloadUrl) {
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = downloadUrl.split('/').pop() || 'agent.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(
                t('settings.agents.toast.downloadStarted', { defaultValue: "Téléchargement lancé" }),
                t('settings.agents.toast.downloadStartedDesc', { defaultValue: "Vérifiez votre dossier Téléchargements." })
            );
        }
    };

    return (
        <button
            onClick={handleDownload}
            disabled={loading}
            className={cn(
                "flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group text-left w-full border border-transparent hover:border-border/40 dark:hover:border-border/40",
                !available && !loading && "opacity-60",
                loading && "opacity-60 cursor-wait"
            )}
        >
            <div className="flex items-center gap-3">
                {icon}
                <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{label}</div>
                    <div className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">{sublabel}</div>
                </div>
            </div>
            {loading ? (
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            ) : available ? (
                <Download className="w-4 h-4 text-muted-foreground group-hover:text-brand-500 transition-colors" />
            ) : (
                <Badge variant="outline" className="text-[11px] border-amber-500/30 text-amber-600">
                    Bientôt
                </Badge>
            )}
        </button>
    );
};

// FAQ Item Component
interface FAQItemProps {
    question: string;
    answer: string;
    isOpen: boolean;
    onToggle: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, isOpen, onToggle }) => (
    <div className="border-b border-border/40 dark:border-white/5 last:border-b-0">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between py-3 text-left group"
        >
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                {question}
            </span>
            {isOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
            ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            )}
        </button>
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pb-3"
                >
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {answer}
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

export const EnrollAgentModal: React.FC<EnrollAgentModalProps> = ({
    isOpen,
    onClose,
    enrollmentToken,
    releaseInfo,
    loadingReleases
}) => {
    const { config } = useLocale();
    const [activeTab, setActiveTab] = useState<'download' | 'docs' | 'faq' | 'support'>('download');
    const [openFAQ, setOpenFAQ] = useState<number | null>(null);

    // FAQ Data
    const faqItems = [
        {
            question: "Quelles données l'agent collecte-t-il ?",
            answer: "L'agent collecte uniquement des métadonnées de conformité : état du pare-feu, chiffrement disque, mises à jour système, antivirus actif. Aucune donnée personnelle, fichier ou historique de navigation n'est collecté."
        },
        {
            question: "L'agent ralentit-il mon ordinateur ?",
            answer: "Non. L'agent utilise moins de 1% du CPU et environ 50 Mo de RAM. Il effectue des vérifications périodiques (toutes les 15 minutes par défaut) et reste inactif le reste du temps."
        },
        {
            question: "Comment désinstaller l'agent ?",
            answer: "Windows : Panneau de configuration → Programmes → Désinstaller. macOS : Glissez l'application dans la Corbeille ou utilisez 'sentinel-agent uninstall'. Linux : 'sudo apt remove sentinel-agent' ou 'sudo rpm -e sentinel-agent'."
        },
    ];

    const systemRequirements = {
        windows: { os: "Windows 10/11 (64-bit)", ram: "50 Mo", disk: "100 Mo" },
        macos: { os: "macOS 11 Big Sur+", ram: "50 Mo", disk: "80 Mo" },
        linux: { os: "Ubuntu 20.04+, Debian 11+", ram: "40 Mo", disk: "60 Mo" }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Enrôlement d'un nouvel Agent"
            maxWidth="max-w-5xl"
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:divide-x divide-slate-200 dark:divide-white/10 min-h-[500px]">
                {/* LEFT COLUMN: Token & Install (5 cols) */}
                <div className="lg:col-span-5 p-6 bg-slate-50/50 dark:bg-white/5">
                    <EnrollmentTokenPanel enrollmentToken={enrollmentToken} />
                </div>

                {/* RIGHT COLUMN: Resources (7 cols) */}
                <div className="lg:col-span-7 p-6 flex flex-col h-full bg-white dark:bg-transparent">
                    {/* Tabs */}
                    <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-3xl mb-6">
                        {[
                            { id: 'download', label: 'Télécharger', icon: Download },
                            { id: 'docs', label: 'Docs', icon: BookOpen },
                            { id: 'faq', label: 'FAQ', icon: HelpCircle },
                            { id: 'support', label: 'Support', icon: Headset },
                        ].map((tab) => (
                            <button
                                key={tab.id || 'unknown'}
                                onClick={() => setActiveTab(tab.id as 'download' | 'docs' | 'faq' | 'support')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200",
                                    activeTab === tab.id
                                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                        : "text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
                                )}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        <AnimatePresence mode="popLayout">
                            {activeTab === 'download' && (
                                <motion.div
                                    key="download"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="space-y-5"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Dernière version</h3>
                                            {releaseInfo?.currentVersion && (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="text-[11px] bg-brand-50 border-brand-200 text-brand-600">
                                                        v{releaseInfo.currentVersion}
                                                    </Badge>
                                                    <span className="text-[11px] text-slate-400">
                                                        {releaseInfo.releaseDate && new Date(releaseInfo.releaseDate).toLocaleDateString(config.intlLocale)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {releaseInfo?.changelogUrl && (
                                            <a
                                                href={releaseInfo.changelogUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
                                            >
                                                Changelog <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <DownloadButton
                                            platform="windows"
                                            label="Windows"
                                            sublabel="INSTALLATEUR .MSI"
                                            icon={<Monitor className="w-5 h-5 text-blue-500" />}
                                            available={releaseInfo?.platforms?.windows?.available ?? false}
                                            downloadUrl={releaseInfo?.platforms?.windows?.downloadUrl}
                                            loading={loadingReleases}
                                        />
                                        <DownloadButton
                                            platform="macos"
                                            label="macOS"
                                            sublabel="INSTALLATEUR .PKG"
                                            icon={<Cpu className="w-5 h-5 text-slate-600 dark:text-slate-300" />}
                                            available={releaseInfo?.platforms?.macos?.available ?? false}
                                            downloadUrl={releaseInfo?.platforms?.macos?.downloadUrl}
                                            loading={loadingReleases}
                                        />
                                        <DownloadButton
                                            platform="linux_deb"
                                            label="Linux DEB"
                                            sublabel="DEBIAN / UBUNTU"
                                            icon={<Terminal className="w-5 h-5 text-orange-500" />}
                                            available={releaseInfo?.platforms?.linux_deb?.available ?? false}
                                            downloadUrl={releaseInfo?.platforms?.linux_deb?.downloadUrl}
                                            loading={loadingReleases}
                                        />
                                        <DownloadButton
                                            platform="linux_rpm"
                                            label="Linux RPM"
                                            sublabel="RHEL / FEDORA"
                                            icon={<Terminal className="w-5 h-5 text-red-500" />}
                                            available={releaseInfo?.platforms?.linux_rpm?.available ?? false}
                                            downloadUrl={releaseInfo?.platforms?.linux_rpm?.downloadUrl}
                                            loading={loadingReleases}
                                        />
                                        <DownloadButton
                                            platform="linux_appimage"
                                            label="Linux AppImage"
                                            sublabel="PORTABLE / UNIVERSEL"
                                            icon={<Terminal className="w-5 h-5 text-green-500" />}
                                            available={releaseInfo?.platforms?.linux_appimage?.available ?? false}
                                            downloadUrl={releaseInfo?.platforms?.linux_appimage?.downloadUrl}
                                            loading={loadingReleases}
                                        />
                                    </div>

                                    {/* System Requirements Mini Table */}
                                    <div className="mt-6 pt-4 border-t border-border/40 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Requis</h4>
                                        <div className="space-y-2 text-[11px]">
                                            {Object.entries(systemRequirements).map(([os, req]) => (
                                                <div key={os || 'unknown'} className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-white/5 last:border-0">
                                                    <span className="font-medium text-slate-700 dark:text-slate-300 capitalize flex items-center gap-2">
                                                        {os === 'windows' && <Monitor className="w-3 h-3" />}
                                                        {os === 'macos' && <Cpu className="w-3 h-3" />}
                                                        {os === 'linux' && <Terminal className="w-3 h-3" />}
                                                        {os}
                                                    </span>
                                                    <span className="text-muted-foreground">{req.os} • {req.ram} RAM</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'faq' && (
                                <motion.div
                                    key="faq"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="space-y-2"
                                >
                                    {faqItems.map((item, index) => (
                                        <FAQItem
                                            key={index || 'unknown'}
                                            question={item.question}
                                            answer={item.answer}
                                            isOpen={openFAQ === index}
                                            onToggle={() => setOpenFAQ(openFAQ === index ? null : index)}
                                        />
                                    ))}
                                </motion.div>
                            )}

                            {/* Other tabs placeholders could be added here similar to AgentManagement content if needed, 
                                but keeping it focused for the modal */
                            }
                            {(activeTab === 'docs' || activeTab === 'support') && (
                                <motion.div
                                    key="other"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="flex flex-col items-center justify-center py-10 text-center"
                                >
                                    <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-full mb-3">
                                        {activeTab === 'docs' ? <BookOpen className="w-8 h-8 text-slate-400" /> : <Headset className="w-8 h-8 text-slate-400" />}
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                        {activeTab === 'docs' ? 'Documentation Complète' : 'Support Technique'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mb-4">
                                        {activeTab === 'docs'
                                            ? "Consultez notre documentation en ligne pour des guides détaillés."
                                            : "Notre équipe est là pour vous aider en cas de problème."}
                                    </p>
                                    <Button variant="outline" size="sm" onClick={() => window.open('https://docs.sentinel-grc.com', '_blank')}>
                                        Ouvrir {activeTab === 'docs' ? 'la documentation' : 'le centre d\'aide'}
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
