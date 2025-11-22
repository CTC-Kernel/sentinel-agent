
import React, { useState } from 'react';
import { BookOpen, HelpCircle, ChevronRight, Search, ShieldAlert, FileText, LayoutDashboard, MessageSquare, Send } from '../components/ui/Icons';
import { useStore } from '../store';
import { sendEmail } from '../services/emailService';

const FAQS = [
    {
        question: "Comment créer un nouvel actif ?",
        answer: "Allez dans le module 'Actifs', cliquez sur 'Ajouter un Actif' ou utilisez le bouton 'Importer CSV' pour ajouter plusieurs éléments à la fois. Assurez-vous de définir le niveau de criticité (DIC) correctement."
    },
    {
        question: "Quelle est la différence entre Risque Brut et Résiduel ?",
        answer: "Le Risque Brut est le niveau de risque avant la mise en place de mesures de sécurité. Le Risque Résiduel est le niveau restant après l'application des contrôles d'atténuation. ISO 27001 exige de gérer le risque résiduel."
    },
    {
        question: "Comment lier une preuve à un contrôle ISO ?",
        answer: "Dans le module 'Conformité DdA', cliquez sur l'icône de lien à côté d'un contrôle. Vous pourrez alors sélectionner un document existant (politique, capture d'écran) comme preuve."
    },
    {
        question: "Que faire en cas d'incident de sécurité ?",
        answer: "Déclarez-le immédiatement dans le module 'Incidents'. Qualifiez la sévérité et liez l'actif impacté. Le RSSI sera notifié et pourra suivre la résolution."
    },
    {
        question: "À quoi sert le module Confidentialité (RGPD) ?",
        answer: "Il sert à maintenir votre Registre des Activités de Traitement (Article 30 du RGPD). Vous devez y lister tout processus utilisant des données personnelles (Paie, Recrutement, CRM...)."
    }
];

export const Help: React.FC = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const [search, setSearch] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const { user, addToast } = useStore();

    const filteredFaqs = FAQS.filter(f => f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase()));

    const handleContactSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) return;
        setSending(true);
        try {
            await sendEmail(user, {
                to: 'contact@cyber-threat-consulting.com',
                subject: `[Support] ${subject}`,
                type: 'INVITATION', // Using a generic type for simplicity or create a new one
                html: `<div style="font-family:sans-serif;color:#333;"><h2>Demande de Support</h2><p><strong>De:</strong> ${user?.displayName} (${user?.email})</p><p><strong>Sujet:</strong> ${subject}</p><hr/><p>${message.replace(/\n/g, '<br/>')}</p></div>`
            });
            addToast("Message envoyé à Cyber Threat Consulting", "success");
            setSubject('');
            setMessage('');
        } catch(e) {
            addToast("Erreur lors de l'envoi", "error");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-fade-in pb-16 pt-6">
            <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-xl shadow-brand-500/30 mb-4 ring-4 ring-white dark:ring-slate-900">
                    <HelpCircle className="h-10 w-10" />
                </div>
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Centre d'Aide</h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    Documentation, guides et support par Cyber Threat Consulting.
                </p>
            </div>

            <div className="relative max-w-xl mx-auto group">
                 <div className="absolute -inset-1 bg-gradient-to-r from-brand-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                 <div className="relative flex items-center glass-panel rounded-2xl p-1">
                     <Search className="ml-4 h-5 w-5 text-slate-400" />
                     <input 
                        type="text" 
                        placeholder="Rechercher une réponse..." 
                        className="w-full pl-4 pr-4 py-3.5 bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                     />
                 </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                <div className="glass-panel p-8 rounded-[2.5rem] hover:-translate-y-1 transition-transform duration-300 cursor-pointer group">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-6 text-orange-500 group-hover:scale-110 transition-transform">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2">Gestion des Risques</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Méthodologie ISO 27005, évaluation EBIOS et traitement des menaces.</p>
                </div>
                <div className="glass-panel p-8 rounded-[2.5rem] hover:-translate-y-1 transition-transform duration-300 cursor-pointer group">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-6 text-blue-500 group-hover:scale-110 transition-transform">
                        <FileText className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2">Documents & Preuves</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Cycle de vie documentaire, versionning et liaison aux contrôles.</p>
                </div>
                <div className="glass-panel p-8 rounded-[2.5rem] hover:-translate-y-1 transition-transform duration-300 cursor-pointer group">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mb-6 text-purple-500 group-hover:scale-110 transition-transform">
                        <LayoutDashboard className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2">RGPD & Confidentialité</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Tenue du registre ROPA, durées de conservation et analyses d'impact.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white px-2 mb-6">Questions Fréquentes</h2>
                    {filteredFaqs.length === 0 ? (
                        <div className="text-center py-12 glass-panel rounded-[2rem]">
                            <p className="text-slate-500">Aucun résultat pour cette recherche.</p>
                        </div>
                    ) : (
                        filteredFaqs.map((faq, i) => (
                            <div key={i} className="glass-panel rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-lg border border-white/50 dark:border-white/5">
                                <button 
                                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                                    className="w-full flex items-center justify-between p-6 text-left"
                                >
                                    <span className="font-bold text-slate-800 dark:text-white text-lg pr-4">{faq.question}</span>
                                    <div className={`flex-shrink-0 p-2 rounded-full bg-slate-100 dark:bg-slate-800 transition-transform duration-300 ${openIndex === i ? 'rotate-90 bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-400' : 'text-slate-400'}`}>
                                        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                                    </div>
                                </button>
                                {openIndex === i && (
                                    <div className="px-6 pb-6 pt-0">
                                        <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                                {faq.answer}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="glass-panel rounded-[2.5rem] p-8 border border-white/50 dark:border-white/5 h-fit sticky top-24">
                    <div className="flex items-center mb-6">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center mr-4 shadow-lg">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Support Expert</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Cyber Threat Consulting</p>
                        </div>
                    </div>
                    <form onSubmit={handleContactSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Sujet</label>
                            <input required type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium dark:text-white" 
                                value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex: Question sur un contrôle"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Message</label>
                            <textarea required rows={4} className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium resize-none dark:text-white" 
                                value={message} onChange={e => setMessage(e.target.value)} placeholder="Détaillez votre demande..."/>
                        </div>
                        <button type="submit" disabled={sending} className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-all flex items-center justify-center disabled:opacity-70">
                            {sending ? 'Envoi...' : <><Send className="h-4 w-4 mr-2"/> Contacter le support</>}
                        </button>
                        <div className="text-center mt-4">
                            <p className="text-[10px] text-slate-400">contact@cyber-threat-consulting.com</p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
