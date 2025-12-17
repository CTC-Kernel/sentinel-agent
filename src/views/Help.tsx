import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { staggerContainerVariants } from '../components/ui/animationVariants';
import { SEO } from '../components/SEO';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import {
    Search,
    HelpCircle,
    MessageSquare,
    Menu,
    ChevronRight,
    ChevronDown,
    FileText,
    Shield,
    Zap,
    BookOpen,
    Settings
} from 'lucide-react';
import { ContactModal } from '../components/ui/ContactModal';
import { FeedbackModal } from '../components/ui/FeedbackModal';

interface Section {
    title?: string;
    content: string;
}

interface Article {
    id: string;
    title: string;
    description: string;
    icon?: any;
    sections: Section[];
}

interface Category {
    id: string;
    title: string;
    icon: any;
    articles: Article[];
}

const HELP_DATA: Category[] = [
    {
        id: 'getting-started',
        title: 'Démarrage Rapide',
        icon: Zap,
        articles: [
            {
                id: 'intro',
                title: 'Introduction à Sentinel GRC',
                description: 'Découvrez les fonctionnalités principales de votre plateforme.',
                icon: BookOpen,
                sections: [
                    {
                        title: 'Vue d\'ensemble',
                        content: 'Sentinel GRC est votre centre de commande pour la gouvernance cyber. Il vous permet de gérer vos risques, votre conformité et vos audits en un seul endroit.'
                    },
                    {
                        title: 'Tableau de bord',
                        content: 'Le tableau de bord vous donne une vue synthétique de votre posture de sécurité en temps réel.'
                    }
                ]
            },
            {
                id: 'first-steps',
                title: 'Premiers pas',
                description: 'Configurez votre compte et invitez vos collaborateurs.',
                sections: [
                    {
                        content: 'Commencez par compléter votre profil dans les paramètres, puis configurez les informations de votre organisation.'
                    }
                ]
            }
        ]
    },
    {
        id: 'risks',
        title: 'Gestion des Risques',
        icon: Shield,
        articles: [
            {
                id: 'create-risk',
                title: 'Créer une analyse de risque',
                description: 'Méthodologie EBIOS RM et ISO 27005.',
                sections: [
                    {
                        title: 'Nouvelle analyse',
                        content: 'Pour démarrer une nouvelle analyse, rendez-vous dans le module Risques et cliquez sur "Nouvelle Analyse".'
                    }
                ]
            }
        ]
    },
    {
        id: 'compliance',
        title: 'Conformité',
        icon: FileText,
        articles: [
            {
                id: 'iso-27001',
                title: 'Suivi ISO 27001',
                description: 'Gérer votre déclaration d\'applicabilité (SoA).',
                sections: [
                    {
                        content: 'Le module Conformité vous permet de suivre l\'implémentation des mesures de sécurité de l\'annexe A de l\'ISO 27001.'
                    }
                ]
            }
        ]
    },
    {
        id: 'settings',
        title: 'Paramètres',
        icon: Settings,
        articles: [
            {
                id: 'account',
                title: 'Mon Compte',
                description: 'Gérer vos préférences et votre sécurité.',
                sections: [
                    {
                        content: 'Vous pouvez modifier votre mot de passe et activer l\'authentification à deux facteurs depuis la page Paramètres.'
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isContactOpen, setIsContactOpen] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

    const filteredContent = useMemo(() => {
        if (!search) return HELP_DATA;

        return HELP_DATA.map(category => ({
            ...category,
            articles: category.articles.filter(article =>
                article.title.toLowerCase().includes(search.toLowerCase()) ||
                article.description.toLowerCase().includes(search.toLowerCase())
            )
        })).filter(category => category.articles.length > 0);
    }, [search]);

    const activeCategory = useMemo(() =>
        filteredContent.find(c => c.id === selectedCategory) || filteredContent[0],
        [filteredContent, selectedCategory]);

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="p-6 md:p-8 max-w-[1920px] mx-auto space-y-8 pb-20 relative min-h-screen animate-fade-in"
        >
            <MasterpieceBackground />
            <SEO title="Centre d'Aide" description="Documentation et support Sentinel GRC" />
            <div className="flex h-[calc(100vh-8rem)] animate-fade-in overflow-hidden rounded-[2.5rem] glass-panel border border-slate-200 dark:border-slate-800 shadow-2xl">

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
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
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
                                        ? 'bg-blue-50 dark:bg-slate-900 dark:bg-slate-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
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

                        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
                            <button
                                onClick={() => setIsFeedbackOpen(true)}
                                className="w-full py-3 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 rounded-xl text-sm font-bold border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-all flex items-center justify-center gap-2"
                            >
                                <MessageSquare className="w-4 h-4" />
                                Donner mon avis
                            </button>
                            <button
                                onClick={() => setIsContactOpen(true)}
                                className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                            >
                                <HelpCircle className="w-4 h-4" />
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
                                    <div className="p-3 bg-blue-50 dark:bg-slate-900 dark:bg-slate-900/20 rounded-2xl">
                                        <activeCategory.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{activeCategory.title}</h1>
                                        <p className="text-slate-600 dark:text-slate-400 mt-1">
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
                                                ? 'bg-blue-50/30 dark:bg-slate-900/10 border-blue-200 dark:border-blue-800 ring-1 ring-blue-500/20'
                                                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                                                }`}
                                        >
                                            <button
                                                onClick={() => setSelectedArticle(selectedArticle === article.id ? null : article.id)}
                                                className="w-full flex items-start gap-4 p-6 text-left"
                                            >
                                                <div className={`p-2 rounded-xl shrink-0 transition-colors ${selectedArticle === article.id
                                                    ? 'bg-blue-100 dark:bg-slate-900/40 text-blue-600 dark:text-blue-400'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-blue-50 dark:bg-slate-900 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                                    }`}>
                                                    {article.icon ? <article.icon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className={`text-lg font-bold transition-colors ${selectedArticle === article.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-white'
                                                            }`}>
                                                            {article.title}
                                                        </h3>
                                                        <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${selectedArticle === article.id ? 'rotate-180 text-blue-500' : ''}`} />
                                                    </div>
                                                    <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm leading-relaxed">
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
                            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
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

                <FeedbackModal
                    isOpen={isFeedbackOpen}
                    onClose={() => setIsFeedbackOpen(false)}
                />
            </div>
        </motion.div>
    );
};
