import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, FileText, Scale } from './Icons';

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'mentions' | 'privacy' | 'terms' | 'cgv';
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, initialTab = 'mentions' }) => {
    const [activeTab, setActiveTab] = useState<'mentions' | 'privacy' | 'terms' | 'cgv'>(initialTab);

    if (!isOpen) return null;

    const tabs = [
        { id: 'mentions', label: 'Mentions Légales', icon: Scale },
        { id: 'privacy', label: 'Confidentialité', icon: Shield },
        { id: 'terms', label: 'CGU', icon: FileText },
        { id: 'cgv', label: 'CGV', icon: FileText },
    ] as const;

    return createPortal(
        <div className="fixed inset-0 z-max flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                role="presentation"
                aria-hidden="true"
            />

            <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-border/40 dark:border-slate-700/50 shadow-2xl shadow-black/20 dark:shadow-black/50 rounded-3xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
                {/* Header */}
                <div className="px-8 py-6 border-b border-border/40 dark:border-slate-700/50 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Informations Légales</h2>
                        <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">Transparence et conformité</p>
                    </div>
                    <button
                        aria-label="Fermer la fenêtre"
                        onClick={onClose}
                        className="p-2.5 text-slate-500 dark:text-slate-300 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 rounded-3xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-8 border-b border-border/40 dark:border-white/5 flex gap-8 overflow-x-auto no-scrollbar bg-white dark:bg-slate-900">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            aria-label={`Onglet ${tab.label}`}
                            aria-selected={activeTab === tab.id}
                            role="tab"
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 text-sm font-bold flex items-center border-b-2 transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${activeTab === tab.id
                                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                                : 'border-transparent text-muted-foreground hover:text-foreground dark:hover:text-slate-300'
                                }`}
                        >
                            <tab.icon className={`h-4 w-4 mr-2.5 ${activeTab === tab.id ? 'text-brand-500' : 'opacity-70'}`} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-slate-900">
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                        {activeTab === 'mentions' && (
                            <div className="space-y-6 animate-fade-in">
                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Éditeur du Service</h3>
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-border/40 dark:border-white/5 shadow-sm">
                                        <p className="font-medium">Cyber Threat Consulting</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">EURL au capital de 10 000 €</p>
                                        <p className="text-sm text-slate-600">SIRET 919 340 794 00024 - TVA FR54 919 340 794</p>
                                        <p className="text-sm text-slate-600">Siège social : Avenue Rosa Parks, 69009 Lyon</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">Contact : <a href="mailto:contact@cyber-threat-consulting.com" className="text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1">contact@cyber-threat-consulting.com</a></p>
                                        <p className="text-sm text-slate-600">Site web : <a href="https://cyber-threat-consulting.com" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1">cyber-threat-consulting.com</a></p>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Hébergement</h3>
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-border/40 dark:border-white/5 shadow-sm space-y-4">
                                        <div>
                                            <p className="font-medium">Google Cloud Platform</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Google Ireland Limited</p>
                                            <p className="text-sm text-slate-600">Gordon House, Barrow Street, Dublin 4, Irlande</p>
                                        </div>
                                        <div>
                                            <p className="font-medium">OVHcloud</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">OVH SAS</p>
                                            <p className="text-sm text-slate-600">2 rue Kellermann, 59100 Roubaix, France</p>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Directeur de la Publication</h3>
                                    <p className="text-slate-600 dark:text-muted-foreground">Monsieur le Gérant de Cyber Threat Consulting.</p>
                                </section>
                            </div>
                        )}

                        {activeTab === 'privacy' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-info-50 dark:bg-slate-900/20 p-4 rounded-3xl border border-info-100 dark:border-info-800 text-info-800 dark:text-info-200 text-sm font-medium mb-6">
                                    Conformément au RGPD, Sentinel GRC assure la protection de vos données personnelles.
                                </div>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">1. Collecte des Données</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        Nous collectons uniquement les données nécessaires au fonctionnement du service : identité professionnelle (nom, email, poste), logs de connexion et d'activité pour l'auditabilité (exigence ISO 27001).
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">2. Finalité du Traitement</h3>
                                    <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 dark:text-muted-foreground">
                                        <li>Gestion de l'accès sécurisé à la plateforme.</li>
                                        <li>Traçabilité des actions de gouvernance (Audit Trail).</li>
                                        <li>Notifications de sécurité et de conformité.</li>
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">3. Services Tiers</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-3">
                                        Pour assurer le bon fonctionnement et la qualité du service, nous utilisons les services tiers suivants :
                                    </p>
                                    <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 dark:text-muted-foreground">
                                        <li><strong>Firebase Analytics</strong> (Google) : Mesure d'audience anonymisée, activée uniquement après votre consentement explicite.</li>
                                        <li><strong>Sentry</strong> (Functional Software, Inc.) : Surveillance des erreurs techniques pour améliorer la stabilité. Collecte des informations techniques (type de navigateur, système d'exploitation) et traces d'erreurs. Aucune donnée personnelle identifiable n'est transmise intentionnellement.</li>
                                        <li><strong>N8N</strong> (Workflow Automation) : Automatisation des notifications et intégrations. Les données transitant sont limitées au strict nécessaire pour le traitement concerné.</li>
                                        <li><strong>Stripe</strong> (Stripe, Inc.) : Traitement sécurisé des paiements. Vos données de paiement ne sont jamais stockées sur nos serveurs.</li>
                                    </ul>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mt-3">
                                        Ces services sont sélectionnés pour leur conformité au RGPD et leur engagement en matière de protection des données.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">4. Vos Droits</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        Vous disposez d'un droit d'accès, de rectification, de portabilité et de suppression de vos données. Pour exercer ces droits, contactez notre DPO à <a href="mailto:contact@cyber-threat-consulting.com" className="text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1">contact@cyber-threat-consulting.com</a>.
                                    </p>
                                </section>
                            </div>
                        )}

                        {activeTab === 'terms' && (
                            <div className="space-y-6 animate-fade-in">
                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">1. Acceptation</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        L'utilisation de Sentinel GRC implique l'acceptation pleine et entière des présentes conditions générales d'utilisation.
                                        Tout accès ou utilisation du site vaut acceptation inconditionnelle et respect de l'ensemble des termes des présentes CGU.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">2. Accès au Service</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        Le service est réservé aux professionnels autorisés par leur organisation. L'utilisateur est responsable de la confidentialité de ses identifiants.
                                        L'éditeur met en œuvre tous les moyens pour assurer un accès de qualité au service 24h/24, 7j/7, mais n'est tenu à aucune obligation d'y parvenir.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">3. Propriété Intellectuelle</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        Tous les éléments de la plateforme (code, design, logos, bases de données) sont la propriété exclusive de Cyber Threat Consulting.
                                        Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">4. Responsabilité</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        Sentinel GRC est un outil d'aide à la décision. L'éditeur ne saurait être tenu responsable des décisions de gestion des risques prises sur la base des informations fournies par l'outil.
                                        L'éditeur ne pourra être tenu responsable des dommages directs et indirects causés au matériel de l'utilisateur, lors de l'accès au site.
                                    </p>
                                </section>
                            </div>
                        )}

                        {activeTab === 'cgv' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-success-50 dark:bg-success-900/20 p-4 rounded-3xl border border-success-100 dark:border-success-800 text-success-800 dark:text-success-200 text-sm font-medium mb-6">
                                    Conditions Générales de Vente (CGV) applicables aux abonnements SaaS Sentinel GRC.
                                </div>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">1. Objet</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles entre la société Cyber Threat Consulting (le "Prestataire") et toute personne morale (le "Client") souscrivant aux services de la plateforme Sentinel GRC.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">2. Abonnement et Services</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        Le service est fourni sous forme d'abonnement SaaS (Software as a Service). Les fonctionnalités accessibles dépendent du plan choisi (Discovery, Professional, Enterprise).
                                        L'abonnement permet un accès à la plateforme pour le nombre d'utilisateurs et d'actifs définis dans le plan.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">3. Durée et Renouvellement</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        Les abonnements sont souscrits pour une durée déterminée (mensuelle ou annuelle) et sont renouvelables par tacite reconduction pour la même durée, sauf dénonciation par l'une des parties avant la fin de la période en cours.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">4. Tarifs et Paiement</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        Les prix sont indiqués en euros et hors taxes. Le paiement s'effectue par prélèvement automatique via notre partenaire de paiement sécurisé (Stripe).
                                        Tout retard de paiement pourra entraîner la suspension de l'accès au service.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">5. Résiliation</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        Le Client peut résilier son abonnement à tout moment depuis son espace client. La résiliation prendra effet à la fin de la période d'abonnement en cours.
                                        Aucun remboursement ne sera effectué pour la période non consommée.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">6. Données Personnelles et Sécurité</h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        Cyber Threat Consulting s'engage à respecter la réglementation RGPD. Les données du Client sont hébergées de manière sécurisée et ne sont jamais revendues.
                                        Les détails sont disponibles dans notre Politique de Confidentialité.
                                    </p>
                                </section>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border/40 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                    <button
                        aria-label="Fermer la fenêtre"
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-3xl hover:scale-105 transition-transform shadow-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Headless UI handles FocusTrap and keyboard navigation
