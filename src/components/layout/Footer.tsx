import React from 'react';
import { Lock, Twitter, Linkedin, Github, Heart } from '../ui/Icons';

export const Footer: React.FC = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="relative z-10 border-t border-white/5 bg-slate-950 pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-1">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-lg ring-1 ring-white/20">
                                <Lock className="h-4 w-4" />
                            </div>
                            <span className="text-xl font-bold text-white tracking-tight">Sentinel GRC</span>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            La plateforme de référence pour simplifier, centraliser et piloter votre conformité cybersécurité.
                        </p>
                        <div className="flex gap-4">
                            <SocialLink href="#" icon={<Twitter className="h-4 w-4" />} />
                            <SocialLink href="#" icon={<Linkedin className="h-4 w-4" />} />
                            <SocialLink href="#" icon={<Github className="h-4 w-4" />} />
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6">Produit</h4>
                        <ul className="space-y-3 text-sm text-slate-400">
                            <FooterLink>Fonctionnalités</FooterLink>
                            <FooterLink>Conformité ISO 27001</FooterLink>
                            <FooterLink>Gestion des Risques</FooterLink>
                            <FooterLink>Tarifs</FooterLink>
                            <FooterLink>Mises à jour</FooterLink>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6">Ressources</h4>
                        <ul className="space-y-3 text-sm text-slate-400">
                            <FooterLink>Documentation</FooterLink>
                            <FooterLink>Guide de démarrage</FooterLink>
                            <FooterLink>API Reference</FooterLink>
                            <FooterLink>Blog Sécurité</FooterLink>
                            <FooterLink>Communauté</FooterLink>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6">Légal</h4>
                        <ul className="space-y-3 text-sm text-slate-400">
                            <FooterLink>Confidentialité</FooterLink>
                            <FooterLink>Conditions d'utilisation</FooterLink>
                            <FooterLink>Sécurité</FooterLink>
                            <FooterLink>Cookies</FooterLink>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-slate-500 text-xs text-center md:text-left">
                        © {currentYear} Sentinel GRC. Tous droits réservés.
                    </p>
                    <p className="text-slate-500 text-xs flex items-center gap-1">
                        Fait avec <Heart className="h-3 w-3 text-red-500 fill-red-500" /> à Paris, France.
                    </p>
                </div>
            </div>
        </footer>
    );
};

const SocialLink = ({ href, icon }: { href: string; icon: React.ReactNode }) => (
    <a
        href={href}
        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-brand-500 hover:text-white transition-all duration-300 border border-white/5 hover:border-brand-400"
    >
        {icon}
    </a>
);

const FooterLink = ({ children }: { children: React.ReactNode }) => (
    <li>
        <a href="#" className="hover:text-brand-400 transition-colors duration-200 block w-fit">
            {children}
        </a>
    </li>
);
