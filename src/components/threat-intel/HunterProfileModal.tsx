import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Shield, Activity, Globe, Award, TrendingUp, Calendar, Target, Zap } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { HunterProfileService, HunterProfile as HunterProfileData } from '../../services/HunterProfileService';
import { ErrorLogger } from '../../services/errorLogger';

interface HunterProfile {
    name: string;
    rank: number;
    count?: number;
    avatar?: string;
    role?: string;
    organization?: string;
    joinDate?: string;
    totalContributions?: number;
    verifiedThreats?: number;
    averageResponseTime?: string;
    expertise?: string[];
    achievements?: {
        icon: React.ReactNode;
        title: string;
        description: string;
        date: string;
    }[];
    stats?: {
        threatsThisMonth: number;
        accuracyRate: number;
        reputationScore: number;
        collaborations: number;
    };
    recentActivity?: {
        type: 'threat' | 'verification' | 'collaboration';
        title: string;
        date: string;
        impact: string;
    }[];
}

interface HunterProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    hunterName: string;
}

const mockHunterProfiles: Record<string, HunterProfile> = {
    'Sentinel Team': {
        name: 'Sentinel Team',
        rank: 1,
        role: 'Threat Intelligence Team',
        organization: 'Sentinel GRC',
        joinDate: '2023-01-15',
        totalContributions: 147,
        verifiedThreats: 142,
        averageResponseTime: '8 min',
        expertise: ['Ransomware', 'APT', 'Zero-Day', 'Malware Analysis'],
        achievements: [
            {
                icon: <Award className="h-5 w-5 text-yellow-500" />,
                title: 'MVP 2024',
                description: 'Meilleure équipe de l\'année',
                date: '2024-12-01'
            },
            {
                icon: <Shield className="h-5 w-5 text-emerald-500" />,
                title: 'Guardian Award',
                description: '100 menaces critiques bloquées',
                date: '2024-10-15'
            }
        ],
        stats: {
            threatsThisMonth: 23,
            accuracyRate: 98,
            reputationScore: 4.9,
            collaborations: 89
        },
        recentActivity: [
            {
                type: 'threat',
                title: 'BlackCat Ransomware Campaign',
                date: '2024-01-18',
                impact: 'Critical - 12 organizations affected'
            },
            {
                type: 'verification',
                title: 'Verified CVE-2024-1234',
                date: '2024-01-17',
                impact: 'High - Remote code execution vulnerability'
            }
        ]
    },
    'CyberAlliance': {
        name: 'CyberAlliance',
        rank: 2,
        role: 'Security Research Collective',
        organization: 'CyberAlliance Foundation',
        joinDate: '2023-03-20',
        totalContributions: 98,
        verifiedThreats: 89,
        averageResponseTime: '15 min',
        expertise: ['Phishing', 'Social Engineering', 'Network Security'],
        achievements: [
            {
                icon: <Target className="h-5 w-5 text-blue-500" />,
                title: 'Precision Expert',
                description: '96% de taux de précision',
                date: '2024-11-20'
            }
        ],
        stats: {
            threatsThisMonth: 15,
            accuracyRate: 96,
            reputationScore: 4.7,
            collaborations: 50
        },
        recentActivity: [
            {
                type: 'threat',
                title: 'Sophisticated Phishing Campaign',
                date: '2024-01-17',
                impact: 'High - Financial sector targeted'
            }
        ]
    },
    'ThreatHunter': {
        name: 'ThreatHunter',
        rank: 3,
        role: 'APT Research Group',
        organization: 'ThreatHunter Labs',
        joinDate: '2023-05-10',
        totalContributions: 76,
        verifiedThreats: 68,
        averageResponseTime: '22 min',
        expertise: ['APT Analysis', 'State-Sponsored Attacks', 'Cyber Espionage'],
        achievements: [
            {
                icon: <Shield className="h-5 w-5 text-orange-500" />,
                title: 'APT Specialist',
                description: 'Expert en analyse de menaces persistantes',
                date: '2024-10-05'
            }
        ],
        stats: {
            threatsThisMonth: 12,
            accuracyRate: 94,
            reputationScore: 4.5,
            collaborations: 34
        },
        recentActivity: [
            {
                type: 'threat',
                title: 'APT29 Spearphishing Campaign',
                date: '2024-01-16',
                impact: 'Critical - Government entities targeted'
            }
        ]
    },
    'Community': {
        name: 'Community',
        rank: 4,
        role: 'Community Contributors',
        organization: 'Global Security Community',
        joinDate: '2023-02-01',
        totalContributions: 56,
        verifiedThreats: 48,
        averageResponseTime: '30 min',
        expertise: ['Vulnerability Research', 'Bug Bounty', 'Security Testing'],
        stats: {
            threatsThisMonth: 8,
            accuracyRate: 88,
            reputationScore: 4.2,
            collaborations: 25
        },
        recentActivity: [
            {
                type: 'threat',
                title: 'Zero-day in popular CI/CD tool',
                date: '2024-01-15',
                impact: 'High - Development pipelines affected'
            }
        ]
    },
    'CryptoDef': {
        name: 'CryptoDef',
        rank: 5,
        role: 'Cryptocurrency Security Team',
        organization: 'CryptoDefense Alliance',
        joinDate: '2023-04-15',
        totalContributions: 45,
        verifiedThreats: 40,
        averageResponseTime: '25 min',
        expertise: ['Cryptocurrency', 'Blockchain Security', 'Smart Contracts'],
        stats: {
            threatsThisMonth: 6,
            accuracyRate: 92,
            reputationScore: 4.3,
            collaborations: 18
        },
        recentActivity: [
            {
                type: 'threat',
                title: 'Lazarus Group Crypto Heist',
                date: '2024-01-14',
                impact: 'Critical - $2M in crypto assets stolen'
            }
        ]
    }
};

interface RecentActivity {
  type: 'threat' | 'verification' | 'collaboration';
  title: string;
  date: string;
  impact: string;
}

interface Achievement {
  icon: React.ReactNode;
  title: string;
  description: string;
  date: string;
}

export const HunterProfileModal: React.FC<HunterProfileModalProps> = ({ isOpen, onClose, hunterName }) => {
    const [hunterProfile, setHunterProfile] = useState<HunterProfileData | null>(null);

    useEffect(() => {
        const fetchHunterProfile = async () => {
            if (!hunterName || !isOpen) {
                setHunterProfile(null);
                return;
            }

            try {
                const profile = await HunterProfileService.getHunterProfileByName(hunterName);
                setHunterProfile(profile);
            } catch (error) {
                ErrorLogger.error(error, 'HunterProfileModal.fetchHunterProfile');
                setHunterProfile(null);
            } finally {
                // Loading state removed
            }
        };

        fetchHunterProfile();
    }, [hunterName, isOpen]);

    const stats = hunterProfile?.stats || {
        threatsThisMonth: 0,
        accuracyRate: 85,
        reputationScore: 4.0,
        collaborations: 0
    };

    const expertise = hunterProfile?.expertise || [];
    const recentActivity = hunterProfile?.stats?.recentActivity || [];
    const achievements = hunterProfile?.achievements || [];

    return (
        <Transition appear show={isOpen} as={React.Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={React.Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-70"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-70"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={React.Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-70 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-70 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-3xl bg-white dark:bg-slate-900 p-0 text-left align-middle shadow-2xl transition-all">
                                <div className="relative">
                                    {/* Header */}
                                    <div className="relative h-32 bg-gradient-to-br from-brand-600 to-purple-700">
                                        <button
                                            onClick={onClose}
                                            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                                        >
                                            <X className="h-5 w-5 text-white" />
                                        </button>
                                        <div className="absolute -bottom-12 left-8">
                                            <div className={`relative w-24 h-24 rounded-3xl flex items-center justify-center font-bold text-white shadow-2xl text-2xl ${
                                                (hunterProfile?.user?.displayName || hunterName) === 'Sentinel Team' ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 
                                                (hunterProfile?.user?.displayName || hunterName) === 'CyberAlliance' ? 'bg-gradient-to-br from-slate-300 to-slate-500' : 
                                                (hunterProfile?.user?.displayName || hunterName) === 'ThreatHunter' ? 'bg-gradient-to-br from-orange-600 to-orange-800' : 
                                                'bg-brand-500'
                                            }`}>
                                                {(mockHunterProfiles[hunterProfile?.user?.displayName || hunterName]?.rank || 4) <= 3 ? mockHunterProfiles[hunterProfile?.user?.displayName || hunterName]?.rank : (hunterProfile?.user?.displayName || hunterName).charAt(0)}
                                                {(mockHunterProfiles[hunterProfile?.user?.displayName || hunterName]?.rank || 4) <= 3 && (
                                                    <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-900 rounded-full p-1">
                                                            <Shield className={`h-4 w-4 ${
                                                                (mockHunterProfiles[hunterProfile?.user?.displayName || hunterName]?.rank || 4) === 1 ? 'text-yellow-500' : 
                                                                (mockHunterProfiles[hunterProfile?.user?.displayName || hunterName]?.rank || 4) === 2 ? 'text-slate-400' : 
                                                                'text-orange-700'
                                                            }`} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-8 pt-16 pb-8">
                                        <div className="flex items-start justify-between mb-6">
                                            <div>
                                                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
                                                    {hunterProfile?.user?.displayName || hunterName}
                                                </h2>
                                                <div className="flex items-center gap-4 text-slate-600 dark:text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Shield className="h-4 w-4" />
                                                        {hunterProfile?.user?.role || 'Security Analyst'}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Globe className="h-4 w-4" />
                                                        {hunterProfile?.user?.organizationName || 'Sentinel GRC'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-3xl font-black text-brand-600 dark:text-brand-400">
                                                    #{mockHunterProfiles[hunterProfile?.user?.displayName || hunterName]?.rank || 4}
                                                </div>
                                                <div className="text-sm text-slate-500 dark:text-muted-foreground">Classement</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                            {/* Main Info */}
                                            <div className="lg:col-span-2 space-y-6">
                                                {/* Stats Grid */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-white/5">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Activity className="h-4 w-4 text-brand-500" />
                                                            <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Contributions</div>
                                                        </div>
                                                        <div className="text-2xl font-black text-slate-900 dark:text-white">{hunterProfile?.stats?.totalContributions || 0}</div>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-white/5">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Shield className="h-4 w-4 text-emerald-500" />
                                                            <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Verifiées</div>
                                                        </div>
                                                        <div className="text-2xl font-black text-slate-900 dark:text-white">{hunterProfile?.stats?.verifiedThreats || 0}</div>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-white/5">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Zap className="h-4 w-4 text-yellow-500" />
                                                            <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Réponse</div>
                                                        </div>
                                                        <div className="text-2xl font-black text-slate-900 dark:text-white">{hunterProfile?.stats?.averageResponseTime || 0} min</div>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-white/5">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <TrendingUp className="h-4 w-4 text-purple-500" />
                                                            <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Ce mois</div>
                                                        </div>
                                                        <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.threatsThisMonth}</div>
                                                    </div>
                                                </div>

                                                {/* Expertise */}
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                                        <Target className="h-5 w-5 text-brand-500" />
                                                        Expertise
                                                    </h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {expertise.map((skill: string, index: number) => (
                                                            <Badge key={index} status="info" variant="soft">
                                                                {skill}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Recent Activity */}
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                                        <Calendar className="h-5 w-5 text-brand-500" />
                                                        Activité Récente
                                                    </h3>
                                                    <div className="space-y-3">
                                                        {recentActivity.map((activity: RecentActivity, index: number) => (
                                                            <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/5">
                                                                <div className={`p-2 rounded-lg ${
                                                                    activity.type === 'threat' ? 'bg-red-100 text-red-600 dark:text-red-400 dark:bg-red-900/20' :
                                                                    activity.type === 'verification' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20' :
                                                                    'bg-blue-100 text-blue-600 dark:text-blue-400 dark:bg-blue-900/20'
                                                                }`}>
                                                                    <Activity className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="font-medium text-slate-900 dark:text-white">{activity.title}</div>
                                                                    <div className="text-sm text-slate-500 dark:text-muted-foreground">{activity.date}</div>
                                                                    <div className="text-xs text-muted-foreground dark:text-slate-400 mt-1">{activity.impact}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sidebar */}
                                            <div className="space-y-6">
                                                {/* Performance Metrics */}
                                                <div className="bg-gradient-to-br from-brand-50 to-purple-50 dark:from-brand-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-brand-200 dark:border-brand-800">
                                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Performance</h3>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <div className="flex justify-between text-sm mb-1">
                                                                <span className="text-slate-600 dark:text-muted-foreground">Précision</span>
                                                                <span className="font-bold text-slate-900 dark:text-white">{stats.accuracyRate}%</span>
                                                            </div>
                                                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                                                <div 
                                                                    className="bg-gradient-to-r from-brand-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                                                                    style={{ width: `${stats.accuracyRate}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between text-sm mb-1">
                                                                <span className="text-slate-600 dark:text-muted-foreground">Réputation</span>
                                                                <span className="font-bold text-slate-900 dark:text-white">{stats.reputationScore}/5.0</span>
                                                            </div>
                                                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                                                <div 
                                                                    className="bg-gradient-to-r from-emerald-500 to-green-500 h-2 rounded-full transition-all duration-500"
                                                                    style={{ width: `${(stats.reputationScore / 5) * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-slate-600 dark:text-muted-foreground">Collaborations</span>
                                                                <span className="font-bold text-slate-900 dark:text-white">{stats.collaborations}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Achievements */}
                                                {achievements.length > 0 && (
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                                            <Award className="h-5 w-5 text-yellow-500" />
                                                            Réalisations
                                                        </h3>
                                                        <div className="space-y-3">
                                                            {achievements.map((achievement: Achievement, index: number) => (
                                                                <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/5">
                                                                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900">
                                                                        {achievement.icon}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-medium text-slate-900 dark:text-white text-sm">{achievement.title}</div>
                                                                        <div className="text-xs text-slate-500 dark:text-muted-foreground">{achievement.description}</div>
                                                                        <div className="text-xs text-muted-foreground dark:text-slate-400 mt-1">{achievement.date}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Member Since */}
                                                <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/5">
                                                    <div className="text-sm text-slate-500 dark:text-muted-foreground mb-1">Membre depuis</div>
                                                    <div className="font-bold text-slate-900 dark:text-white">{new Date(hunterProfile?.user?.createdAt || '2023-01-01').toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};
