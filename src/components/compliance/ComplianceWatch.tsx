import React, { useState } from 'react';
import { Search, ExternalLink, Filter, Calendar, Globe } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface RegulationItem {
    id: string;
    title: string;
    description: string;
    date: string;
    source: 'EUR-Lex' | 'ANSSI' | 'CNIL' | 'ISO';
    tags: string[];
    url: string;
}

const MOCK_REGULATIONS: RegulationItem[] = [
    {
        id: '1',
        title: 'Règlement (UE) 2022/2554 (DORA)',
        description: 'Règlement sur la résilience opérationnelle numérique du secteur financier. Impose des exigences strictes en matière de gestion des risques TIC.',
        date: '2023-01-16',
        source: 'EUR-Lex',
        tags: ['Finance', 'Cybersécurité', 'Résilience'],
        url: 'https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32022R2554'
    },
    {
        id: '2',
        title: 'Directive (UE) 2022/2555 (NIS 2)',
        description: 'Mesures destinées à assurer un niveau élevé commun de cybersécurité dans l\'ensemble de l\'Union.',
        date: '2022-12-27',
        source: 'EUR-Lex',
        tags: ['Cybersécurité', 'Infrastructures critiques'],
        url: 'https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32022L2555'
    },
    {
        id: '3',
        title: 'IA Act - Règlement sur l\'Intelligence Artificielle',
        description: 'Cadre juridique harmonisé pour l\'IA dans l\'UE. Classification des systèmes IA selon le niveau de risque.',
        date: '2024-03-13',
        source: 'EUR-Lex',
        tags: ['IA', 'Conformité', 'Risque'],
        url: '#'
    },
    {
        id: '4',
        title: 'Guide d\'hygiène informatique (ANSSI)',
        description: 'Renforcement de la sécurité des systèmes d\'information. Bonnes pratiques essentielles.',
        date: '2024-01-01',
        source: 'ANSSI',
        tags: ['Mise à jour', 'Bonnes pratiques'],
        url: 'https://www.ssi.gouv.fr/'
    },
    {
        id: '5',
        title: 'ISO/IEC 27001:2022 - Amendement 1',
        description: 'Mise à jour des contrôles de sécurité de l\'information relative aux changements climatiques.',
        date: '2024-02-23',
        source: 'ISO',
        tags: ['ISO', 'Climat'],
        url: 'https://www.iso.org/standard/27001'
    }
];

export const ComplianceWatch: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSource, setSelectedSource] = useState<string | 'ALL'>('ALL');

    const filteredItems = MOCK_REGULATIONS.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSource = selectedSource === 'ALL' || item.source === selectedSource;
        return matchesSearch && matchesSource;
    });

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Globe className="w-6 h-6 text-brand-500" />
                            Veille Réglementaire
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">Suivi des évolutions normatives et légales (EUR-Lex, ANSSI, ISO).</p>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Rechercher une régulation..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={selectedSource}
                                onChange={(e) => setSelectedSource(e.target.value)}
                                className="pl-9 pr-8 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                            >
                                <option value="ALL">Toutes sources</option>
                                <option value="EUR-Lex">EUR-Lex</option>
                                <option value="ANSSI">ANSSI</option>
                                <option value="ISO">ISO</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-4">
                {filteredItems.map(item => (
                    <div key={item.id} className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-white/10 hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge className={
                                        item.source === 'EUR-Lex' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                            item.source === 'ANSSI' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    }>
                                        {item.source}
                                    </Badge>
                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(item.date).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-500 transition-colors">
                                    <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                                        {item.title}
                                    </a>
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                                    {item.description}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {item.tags.map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-slate-100 dark:bg-white/5 rounded text-xs font-medium text-slate-600 dark:text-slate-400">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/10 hover:text-brand-600 transition-colors"
                            >
                                <ExternalLink className="w-5 h-5" />
                            </a>
                        </div>
                    </div>
                ))}

                {filteredItems.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        <p>Aucun résultat trouvé pour cette recherche.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
