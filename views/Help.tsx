import React, { useState, useMemo } from 'react';
import {
    BookOpen, HelpCircle, ChevronRight, Search, ShieldAlert,
    LayoutDashboard, MessageSquare, Database, CheckCircle2,
    ChevronDown, Lock, Users, FileText, Activity,
    Siren, Settings, Menu
} from '../components/ui/Icons';
import { ContactModal } from '../components/ui/ContactModal';

// --- Types ---
type ArticleSection = {
    title?: string;
    content: string | React.ReactNode;
};

type HelpArticle = {
    id: string;
    title: string;
    icon?: React.ElementType;
    description: string;
    sections: ArticleSection[];
};

type HelpCategory = {
    id: string;
    title: string;
    icon: React.ElementType;
    articles: HelpArticle[];
};

// --- Content Data ---
const HELP_CONTENT: HelpCategory[] = [
    {
        id: 'getting-started',
        title: 'Démarrage',
        icon: LayoutDashboard,
        articles: [
            {
                id: 'quick-start',
                title: 'Premiers Pas',
                description: "Configurez votre environnement Sentinel GRC en quelques minutes.",
                icon: BookOpen,
                sections: [
                    {
                        title: "1. Configuration de l'Organisation",
                        content: "Rendez-vous dans les Paramètres pour renseigner le nom de votre entreprise, votre secteur d'activité et vos préférences régionales. Ces informations seront utilisées pour les rapports."
                    },
                    {
                        title: "2. Invitation de l'Équipe",
                        content: "Dans l'onglet 'Équipe', invitez vos collaborateurs. Assignez-leur des rôles appropriés (Admin, Auditeur, Utilisateur) pour contrôler leurs accès."
                    },
                    {
                        title: "3. Initialisation des Actifs",
                        content: "Le module 'Actifs' est le cœur de votre analyse. Commencez par importer ou créer vos actifs primordiaux (Processus métier, Données critiques) et supports (Serveurs, Applications)."
                    }
                ]
            },
            {
                id: 'dashboard',
                title: 'Comprendre le Tableau de Bord',
                description: "Guide des indicateurs et widgets principaux.",
                icon: LayoutDashboard,
                sections: [
                    {
                        title: "Score de Conformité",
                        content: "Ce pourcentage reflète votre progression globale sur l'implémentation des contrôles ISO 27001. Il est calculé en temps réel."
                    },
                    {
                        title: "Radar de Maturité",
                        content: "Visualisez votre couverture par domaine (Organisationnel, Humain, Physique, Technologique). Idéal pour identifier les zones faibles."
                    },
                    {
                        title: "Flux d'Activité",
                        content: "Trace toutes les actions importantes (création de risque, modification de document) pour une auditabilité complète."
                    }
                ]
            }
        ]
    },
    {
        id: 'modules',
        title: 'Modules',
        icon: Database,
        articles: [
            {
                id: 'risks',
                title: 'Gestion des Risques (ISO 27005)',
                description: "Méthodologie et gestion du cycle de vie des risques.",
                icon: ShieldAlert,
                sections: [
                    {
                        title: "Méthodologie",
                        content: "Sentinel utilise l'approche ISO 27005 : Actif + Menace + Vulnérabilité = Risque. Le score est calculé selon la formule : (Probabilité x Impact) + Sensibilité de l'actif."
                    },
                    {
                        title: "Création d'un Risque",
                        content: "Depuis la vue Risques, cliquez sur '+ Nouveau Risque'. Sélectionnez l'actif concerné, la menace (ex: Ransomware) et évaluez les impacts CID (Confidentialité, Intégrité, Disponibilité)."
                    },
                    {
                        title: "Traitement du Risque",
                        content: "Pour chaque risque, définissez une stratégie (Réduire, Accepter, Eviter, Transférer). Associez des contrôles de l'Annexe A pour réduire le risque résiduel."
                    }
                ]
            },
            {
                id: 'compliance',
                title: 'Conformité & SoA',
                description: "Suivi de l'Annexe A et Déclaration d'Applicabilité.",
                icon: CheckCircle2,
                sections: [
                    {
                        title: "Les Contrôles",
                        content: "Le module Conformité liste les 93 contrôles de l'ISO 27001:2022. Pour chaque contrôle, définissez son statut (À faire, En cours, Implémenté)."
                    },
                    {
                        title: "Preuves",
                        content: "Associez des documents ou des captures d'écran à chaque contrôle pour prouver sa mise en œuvre lors de l'audit."
                    },
                    {
                        title: "SoA (Statement of Applicability)",
                        content: "Le SoA est généré automatiquement basé sur vos statuts. Vous pouvez l'exporter en PDF depuis le bouton 'Exporter SoA'."
                    }
                ]
            },
            {
                id: 'audits',
                title: 'Gestion des Audits',
                description: "Planification et suivi des audits internes/externes.",
                icon: Activity,
                sections: [
                    {
                        title: "Planification",
                        content: "Créez un audit, assignez un auditeur (interne ou externe) et définissez la portée (scope) et la date."
                    },
                    {
                        title: "Déroulement",
                        content: "L'auditeur peut saisir ses constats (Non-conformités majeures/mineures, Observations) directement dans l'outil."
                    },
                    {
                        title: "Rapport",
                        content: "Une fois l'audit terminé, un rapport formel est généré incluant le plan d'action correctif."
                    }
                ]
            },
            {
                id: 'incidents',
                title: 'Incidents de Sécurité',
                description: "Déclaration et réponse aux incidents.",
                icon: Siren,
                sections: [
                    {
                        title: "Déclaration",
                        content: "Tout utilisateur peut déclarer un incident via le bouton 'Déclarer un incident' ou le portail simplifié."
                    },
                    {
                        title: "Qualification",
                        content: "Le RSSI qualifie l'incident (Sévérité, Impact) et assigne un responsable."
                    },
                    {
                        title: "Playbooks",
                        content: "Suivez les playbooks intégrés (ex: Phishing, Malware) pour guider la réponse à incident étape par étape."
                    }
                ]
            }
        ]
    },
    {
        id: 'roles',
        title: 'Rôles & Permissions',
        icon: Lock,
        articles: [
            {
                id: 'rbac-matrix',
                title: 'Matrice des Rôles',
                description: "Détail des accès par profil utilisateur.",
                icon: Users,
                sections: [
                    {
                        title: "Vue d'ensemble",
                        content: (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm text-left text-slate-600 dark:text-slate-300">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-400">
                                        <tr>
                                            <th className="px-6 py-3">Fonctionnalité</th>
                                            <th className="px-6 py-3">Admin</th>
                                            <th className="px-6 py-3">RSSI</th>
                                            <th className="px-6 py-3">Auditeur</th>
                                            <th className="px-6 py-3">Utilisateur</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        <tr className="bg-white dark:bg-slate-900">
                                            <td className="px-6 py-4 font-medium">Gestion des Risques</td>
                                            <td className="px-6 py-4 text-emerald-500">Total</td>
                                            <td className="px-6 py-4 text-emerald-500">Total</td>
                                            <td className="px-6 py-4 text-blue-500">Lecture/Modif</td>
                                            <td className="px-6 py-4 text-slate-400">Lecture</td>
                                        </tr>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                                            <td className="px-6 py-4 font-medium">Audits</td>
                                            <td className="px-6 py-4 text-emerald-500">Total</td>
                                            <td className="px-6 py-4 text-emerald-500">Total</td>
                                            <td className="px-6 py-4 text-blue-500">Lecture/Création</td>
                                            <td className="px-6 py-4 text-slate-400">Lecture</td>
                                        </tr>
                                        <tr className="bg-white dark:bg-slate-900">
                                            <td className="px-6 py-4 font-medium">Incidents</td>
                                            <td className="px-6 py-4 text-emerald-500">Total</td>
                                            <td className="px-6 py-4 text-emerald-500">Total</td>
                                            <td className="px-6 py-4 text-slate-400">Lecture</td>
                                            <td className="px-6 py-4 text-blue-500">Création (Déclaration)</td>
                                        </tr>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                                            <td className="px-6 py-4 font-medium">Paramètres & Logs</td>
                                            <td className="px-6 py-4 text-emerald-500">Total</td>
                                            <td className="px-6 py-4 text-emerald-500">Total</td>
                                            <td className="px-6 py-4 text-red-500">Interdit</td>
                                            <td className="px-6 py-4 text-red-500">Interdit</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )
                    },
                    {
                        title: "Détails des Rôles",
                        content: (
                            <ul className="list-disc pl-5 space-y-2 mt-2">
                                <li><strong>Admin :</strong> Accès complet système, gestion des abonnements et des utilisateurs.</li>
                                <li><strong>RSSI :</strong> Responsable de la sécurité. Accès complet aux modules GRC, mais pas à la facturation.</li>
                                <li><strong>Auditeur :</strong> Peut voir et modifier les preuves, les risques et mener des audits. Ne peut pas supprimer d'éléments critiques.</li>
                                <li><strong>Utilisateur :</strong> Accès en lecture seule aux politiques et procédures. Peut déclarer des incidents.</li>
                            </ul>
                        )
                    }
                ]
            }
        ]
    },
    {
        id: 'admin',
        title: 'Administration',
        icon: Settings,
        articles: [
            {
                id: 'settings',
                title: 'Paramètres Généraux',
                description: "Configuration de l'organisation.",
                icon: Settings,
                sections: [
                    {
                        title: "Profil Organisation",
                        content: "Modifiez le logo, le nom et les coordonnées de votre entité. Ces éléments apparaissent sur les rapports PDF."
                    },
                    {
                        title: "Sécurité",
                        content: "Activez l'authentification à deux facteurs (2FA) pour tous les administrateurs (recommandé)."
                    }
                ]
            },
            {
                id: 'backup',
                title: 'Sauvegardes',
                description: "Politique de backup et restauration.",
                icon: Database,
                sections: [
                    {
                        title: "Automatique",
                        content: "Sentinel effectue une sauvegarde chiffrée quotidienne de toutes vos données."
                    },
                    {
                        title: "Manuelle",
                        content: "Vous pouvez déclencher un export JSON complet de vos données à tout moment depuis l'onglet 'Sauvegarde'."
                    }
                ]
            }
        ]
    }
];

export const Help: React.FC = () => {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('getting-started');
    const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
    const [isContactOpen, setIsContactOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Filter content based on search
    const filteredContent = useMemo(() => {
        if (!search) return HELP_CONTENT;
        return HELP_CONTENT.map(cat => ({
            ...cat,
            articles: cat.articles.filter(art =>
                art.title.toLowerCase().includes(search.toLowerCase()) ||
                art.description.toLowerCase().includes(search.toLowerCase()) ||
                art.sections.some(s =>
                    (typeof s.content === 'string' && s.content.toLowerCase().includes(search.toLowerCase())) ||
                    (s.title && s.title.toLowerCase().includes(search.toLowerCase()))
                )
            )
        })).filter(cat => cat.articles.length > 0);
    }, [search]);

    const activeCategory = filteredContent.find(c => c.id === selectedCategory) || filteredContent[0];

    return (
        <div className="flex h-[calc(100vh-6rem)] animate-fade-in overflow-hidden rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">

            {/* Sidebar Navigation */}
            <div className={`
                absolute inset-y-0 left-0 z-20 w-72 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300
                md:relative md:translate-x-0
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-6 h-full flex flex-col">
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <HelpCircle className="w-6 h-6 text-blue-600" />
                            Centre d'Aide
                        </h2>
                    </div>

                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>

                    <nav className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                        {filteredContent.map(category => (
                            <button
                                key={category.id}
                                onClick={() => {
                                    setSelectedCategory(category.id);
                                    setSelectedArticle(null);
                                    setMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${selectedCategory === category.id
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <category.icon className="w-5 h-5" />
                                {category.title}
                                {selectedCategory === category.id && (
                                    <ChevronRight className="w-4 h-4 ml-auto" />
                                )}
                            </button>
                        ))}
                    </nav>

                    <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800">
                        <button
                            onClick={() => setIsContactOpen(true)}
                            className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            <MessageSquare className="w-4 h-4" />
                            Support
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 relative">
                {/* Mobile Header */}
                <div className="md:hidden p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">Menu</span>
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                        <Menu className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
                    {activeCategory ? (
                        <div className="max-w-4xl mx-auto space-y-8">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                                    <activeCategory.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{activeCategory.title}</h1>
                                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                                        {activeCategory.articles.length} articles disponibles
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-6">
                                {activeCategory.articles.map(article => (
                                    <div
                                        key={article.id}
                                        id={article.id}
                                        className={`group rounded-2xl border transition-all duration-300 overflow-hidden ${selectedArticle === article.id
                                            ? 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 ring-1 ring-blue-500/20'
                                            : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                                            }`}
                                    >
                                        <button
                                            onClick={() => setSelectedArticle(selectedArticle === article.id ? null : article.id)}
                                            className="w-full flex items-start gap-4 p-6 text-left"
                                        >
                                            <div className={`p-2 rounded-xl shrink-0 transition-colors ${selectedArticle === article.id
                                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                                }`}>
                                                {article.icon ? <article.icon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h3 className={`text-lg font-bold transition-colors ${selectedArticle === article.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-white'
                                                        }`}>
                                                        {article.title}
                                                    </h3>
                                                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${selectedArticle === article.id ? 'rotate-180 text-blue-500' : ''}`} />
                                                </div>
                                                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm leading-relaxed">
                                                    {article.description}
                                                </p>
                                            </div>
                                        </button>

                                        <div className={`grid transition-all duration-300 ease-in-out ${selectedArticle === article.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                            }`}>
                                            <div className="overflow-hidden">
                                                <div className="px-6 pb-6 pt-0 space-y-6">
                                                    <div className="h-px w-full bg-slate-200 dark:bg-slate-700/50 mb-6" />
                                                    {article.sections.map((section, idx) => (
                                                        <div key={idx} className="prose prose-slate dark:prose-invert max-w-none">
                                                            {section.title && (
                                                                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                                    {section.title}
                                                                </h4>
                                                            )}
                                                            <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pl-3.5 border-l-2 border-slate-100 dark:border-slate-800">
                                                                {section.content}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                            <Search className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium">Sélectionnez une catégorie ou effectuez une recherche</p>
                        </div>
                    )}
                </div>
            </div>

            <ContactModal
                isOpen={isContactOpen}
                onClose={() => setIsContactOpen(false)}
                subject="Support Sentinel GRC"
            />
        </div>
    );
};

