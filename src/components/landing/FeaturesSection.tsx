import React from 'react';
import { motion } from 'framer-motion';
import {
    BrainCircuit,
    Activity,
    Network,
    ShieldCheck,
    FileText,
    Zap,
    LayoutDashboard,
    Lock
} from '../ui/Icons';

const features = [
    {
        title: "Gouvernance Intelligente",
        description: "Pilotez votre conformité (ISO 27001, NIS2, DORA) avec une IA qui comprend votre contexte et suggère des contrôles adaptés.",
        icon: BrainCircuit,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        delay: 0
    },
    {
        title: "Gestion des Risques Vivante",
        description: "Oubliez les Excels statiques. Passez à la gestion des risques dynamique (EBIOS RM, ISO 27005) interconnectée à vos actifs.",
        icon: Activity,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        delay: 0.1
    },
    {
        title: "Cartographie Automatisée",
        description: "Vos actifs, processus, tiers et données cartographiés en temps réel pour une vision à 360° de votre surface d'attaque.",
        icon: Network,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        delay: 0.2
    },
    {
        title: "Audits Simplifiés",
        description: "Générez des rapports d'audit prêts pour la certification en un clic. Centralisez vos preuves et réduisez la charge administrative.",
        icon: FileText,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        delay: 0.3
    },
    {
        title: "Conformité Continue",
        description: "Suivez votre Statement of Applicability (SoA) et vos plans d'actions en temps réel. Soyez toujours prêt pour l'audit.",
        icon: ShieldCheck,
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        delay: 0.4
    },
    {
        title: "Tableaux de Bord COMEX",
        description: "Traduisez la technique en risques business. Des indicateurs clairs pour communiquer efficacement avec la direction.",
        icon: LayoutDashboard,
        color: "text-cyan-400",
        bg: "bg-cyan-500/10",
        delay: 0.5
    }
];

export const FeaturesSection: React.FC = () => {
    return (
        <section className="relative py-24 px-4 md:px-6 z-10">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-wider mb-4"
                    >
                        <Zap className="h-3 w-3" />
                        <span>Fonctionnalités Clés</span>
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight"
                    >
                        Tout ce dont vous avez besoin pour <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-blue-500">sécuriser votre futur</span>
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-slate-400 text-lg max-w-2xl mx-auto"
                    >
                        Une suite complète d'outils intégrés pour transformer la contrainte réglementaire en avantage compétitif.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, idx) => (
                        <FeatureCard key={idx} feature={feature} />
                    ))}
                </div>
            </div>
        </section>
    );
};

const FeatureCard = ({ feature }: { feature: typeof features[0] }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: feature.delay }}
            whileHover={{ y: -5 }}
            className="group relative p-1 rounded-3xl bg-gradient-to-b from-white/10 to-transparent hover:from-brand-500/20 hover:to-blue-500/20 transition-colors duration-500"
        >
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl rounded-[22px] m-[1px] p-6 h-[calc(100%-2px)] flex flex-col">
                <div className={`w-12 h-12 rounded-2xl ${feature.bg} ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="h-6 w-6" />
                </div>

                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-brand-400 transition-colors">
                    {feature.title}
                </h3>

                <p className="text-slate-400 text-sm leading-relaxed mb-4 flex-1">
                    {feature.description}
                </p>

                <div className="flex items-center text-xs font-bold text-slate-500 group-hover:text-white transition-colors duration-300">
                    <span className="mr-2">En savoir plus</span>
                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                </div>
            </div>
        </motion.div>
    );
};
