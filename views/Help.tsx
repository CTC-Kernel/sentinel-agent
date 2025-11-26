import React, { useState } from 'react';
import {
    BookOpen, HelpCircle, ChevronRight, Search, ShieldAlert,
    LayoutDashboard, MessageSquare, Send, Database, CheckCircle2,
    ChevronDown, ExternalLink
} from '../components/ui/Icons';
import { ContactModal } from '../components/ui/ContactModal';

const GUIDES = [
    {
        id: 'getting-started',
        title: 'Démarrage Rapide',
        icon: LayoutDashboard,
        color: 'text-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        steps: [
            "Complétez votre profil et les informations de votre organisation dans les Paramètres.",
            "Invitez vos collaborateurs depuis l'onglet 'Équipe'.",
            "Commencez par recenser vos actifs primordiaux dans le module 'Actifs'.",
            "Lancez votre première analyse de risques."
        ]
    },
    {
        id: 'risk-management',
        title: 'Gestion des Risques',
        icon: ShieldAlert,
        color: 'text-orange-500',
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        steps: [
            "Identifiez un actif (serveur, processus, donnée) à protéger.",
            "Associez-lui des menaces potentielles (ex: Vol, Incendie, Ransomware).",
            "Évaluez la probabilité et l'impact pour obtenir le Risque Brut.",
            "Sélectionnez des mesures de traitement (contrôles ISO) pour réduire le risque.",
            "Validez le Risque Résiduel obtenu."
        ]
    },
    {
        id: 'compliance',
        title: 'Conformité ISO 27001',
        icon: CheckCircle2,
        color: 'text-emerald-500',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        steps: [
            "Accédez au Tableau de Bord de Conformité pour voir votre progression.",
            "Passez en revue chaque contrôle de l'Annexe A.",
            "Définissez le statut (Applicable, Non Applicable, Implémenté).",
            "Liez des preuves (documents, captures) pour justifier la conformité.",
            "Générez votre Déclaration d'Applicabilité (SoA) en un clic."
        ]
    },
    {
        id: 'assets',
        title: 'Inventaire des Actifs',
        icon: Database,
        color: 'text-purple-500',
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        steps: [
            "Utilisez le bouton 'Ajouter' ou l'import CSV pour peupler votre inventaire.",
            "Qualifiez chaque actif selon les critères DIC (Disponibilité, Intégrité, Confidentialité).",
            "Assignez un propriétaire à chaque actif.",
            "Visualisez les dépendances entre actifs grâce à la cartographie."
        ]
    }
];

const FAQS = [
    {
        category: "Général",
        items: [
            { q: "Comment changer la langue de l'interface ?", a: "L'interface est actuellement disponible en Français et Anglais. Vous pouvez changer la langue depuis vos Paramètres Utilisateur." },
            { q: "Puis-je exporter mes données ?", a: "Oui, la plupart des modules (Actifs, Risques, Audits) proposent un export CSV ou PDF via le bouton 'Exporter' en haut à droite." }
        ]
    },
    {
        category: "Facturation & Abonnement",
        items: [
            { q: "Comment passer au plan supérieur ?", a: "Rendez-vous dans Paramètres > Abonnement et cliquez sur 'Changer de plan'. Le prorata sera calculé automatiquement." },
            { q: "Où trouver mes factures ?", a: "Vos factures sont envoyées par email et disponibles dans l'historique de facturation de votre espace Stripe, accessible depuis l'onglet Abonnement." }
        ]
    },
    {
        category: "Technique & Sécurité",
        items: [
            { q: "Mes données sont-elles chiffrées ?", a: "Oui, toutes les données sont chiffrées au repos (AES-256) et en transit (TLS 1.3). Nos serveurs sont situés en Europe (Francfort/Paris)." },
            { q: "Supportez-vous le SSO ?", a: "Le Single Sign-On (SAML/OIDC) est disponible uniquement sur le plan Enterprise. Contactez le support pour l'activer." }
        ]
    }
];

export const Help: React.FC = () => {
    const [search, setSearch] = useState('');
    const [openFaq, setOpenFaq] = useState<string | null>(null);
    const [isContactOpen, setIsContactOpen] = useState(false);

    const filteredGuides = GUIDES.filter(g =>
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.steps.some(s => s.toLowerCase().includes(search.toLowerCase()))
    );

    const filteredFaqs = FAQS.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
            item.q.toLowerCase().includes(search.toLowerCase()) ||
            item.a.toLowerCase().includes(search.toLowerCase())
        )
    })).filter(cat => cat.items.length > 0);

    return (
        <div className="max-w-7xl mx-auto space-y-12 animate-fade-in pb-20 pt-8 px-4 sm:px-6 lg:px-8">

            {/* Header Section */}
            <div className="text-center space-y-6 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

                <div className="relative z-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 shadow-2xl shadow-slate-900/20 mb-6 ring-4 ring-white dark:ring-slate-900">
                        <HelpCircle className="h-10 w-10" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white font-display tracking-tight mb-4">
                        Comment pouvons-nous vous aider ?
                    </h1>
                    <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        Explorez nos guides, trouvez des réponses rapides ou contactez nos experts.
                    </p>
                </div>

                {/* Search Bar */}
                <div className="max-w-2xl mx-auto mt-8 relative group z-20">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                    <div className="relative flex items-center glass-panel rounded-2xl p-2 shadow-xl">
                        <Search className="ml-4 h-6 w-6 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Rechercher un guide, une question, une fonctionnalité..."
                            className="w-full pl-4 pr-4 py-4 bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white placeholder-slate-400 text-lg font-medium outline-none"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Quick Guides Grid */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-3">
                    <BookOpen className="w-6 h-6 text-blue-500" />
                    Guides de Démarrage
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredGuides.map((guide) => (
                        <div key={guide.id} className="glass-panel p-6 rounded-[2rem] hover:-translate-y-1 hover:shadow-apple transition-all duration-300 group h-full flex flex-col">
                            <div className={`w-14 h-14 rounded-2xl ${guide.bg} flex items-center justify-center mb-6 ${guide.color} group-hover:scale-110 transition-transform duration-300`}>
                                <guide.icon className="h-7 w-7" />
                            </div>
                            <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-4">{guide.title}</h3>
                            <ul className="space-y-3 flex-1">
                                {guide.steps.map((step, idx) => (
                                    <li key={idx} className="flex items-start text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                        <div className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 mr-3 mt-0.5">
                                            {idx + 1}
                                        </div>
                                        {step}
                                    </li>
                                ))}
                            </ul>
                            <button className="mt-6 w-full py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 group/btn">
                                Lire le guide complet
                                <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* FAQ & Support Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* FAQ Column */}
                <div className="lg:col-span-2 space-y-8">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <HelpCircle className="w-6 h-6 text-purple-500" />
                        Questions Fréquentes
                    </h2>

                    {filteredFaqs.length === 0 ? (
                        <div className="text-center py-12 glass-panel rounded-[2.5rem]">
                            <p className="text-slate-500 font-medium">Aucun résultat trouvé pour "{search}"</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {filteredFaqs.map((category, catIdx) => (
                                <div key={catIdx} className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">{category.category}</h3>
                                    <div className="space-y-3">
                                        {category.items.map((item, itemIdx) => {
                                            const key = `${catIdx}-${itemIdx}`;
                                            const isOpen = openFaq === key;
                                            return (
                                                <div key={key} className="glass-panel rounded-2xl overflow-hidden transition-all duration-300 border border-white/60 dark:border-white/5 hover:shadow-md">
                                                    <button
                                                        onClick={() => setOpenFaq(isOpen ? null : key)}
                                                        className="w-full flex items-center justify-between p-5 text-left"
                                                    >
                                                        <span className={`font-bold text-base transition-colors ${isOpen ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                                            {item.q}
                                                        </span>
                                                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
                                                    </button>
                                                    <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                                        <div className="overflow-hidden">
                                                            <div className="px-5 pb-5 pt-0">
                                                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium border-t border-slate-100 dark:border-white/5 pt-4">
                                                                    {item.a}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Contact Card */}
                <div className="lg:col-span-1">
                    <div className="glass-panel p-8 rounded-[2.5rem] sticky top-24 border border-blue-100/50 dark:border-blue-500/10 shadow-xl shadow-blue-900/5">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-blue-600/30">
                            <MessageSquare className="h-6 w-6" />
                        </div>

                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Besoin d'aide supplémentaire ?</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                            Nos experts en cybersécurité sont là pour vous accompagner dans votre démarche de conformité.
                        </p>

                        <div className="space-y-4">
                            <button
                                onClick={() => setIsContactOpen(true)}
                                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group"
                            >
                                <Send className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                                Contacter le Support
                            </button>

                            <a
                                href="mailto:***REMOVED***"
                                className="w-full py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Envoyer un email
                            </a>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800" />
                                    ))}
                                </div>
                                <div className="text-xs">
                                    <p className="font-bold text-slate-900 dark:text-white">Support Premium</p>
                                    <p className="text-slate-500">Réponse sous 24h ouvrées</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ContactModal
                isOpen={isContactOpen}
                onClose={() => setIsContactOpen(false)}
                subject="Demande de support depuis le Centre d'Aide"
            />
        </div>
    );
};
