
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, Command, LayoutDashboard, Siren, FolderKanban, Server, ShieldAlert, Building, Briefcase, FileText, Activity, Users, Settings, ArrowRight, Fingerprint, HelpCircle, HeartPulse, Plus, Zap } from '../ui/Icons';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';

interface CommandItem {
    id: string;
    title: string;
    subtitle?: string;
    icon: any;
    path?: string;
    action?: () => void;
    category: string;
}

const NAVIGATION_ITEMS: CommandItem[] = [
    { id: 'nav-dash', title: 'Tableau de bord', icon: LayoutDashboard, path: '/', category: 'Navigation' },
    { id: 'nav-inc', title: 'Incidents', icon: Siren, path: '/incidents', category: 'Navigation' },
    { id: 'nav-proj', title: 'Projets SSI', icon: FolderKanban, path: '/projects', category: 'Navigation' },
    { id: 'nav-asset', title: 'Actifs', icon: Server, path: '/assets', category: 'Navigation' },
    { id: 'nav-risk', title: 'Risques', icon: ShieldAlert, path: '/risks', category: 'Navigation' },
    { id: 'nav-cont', title: 'Continuité (PCA)', icon: HeartPulse, path: '/continuity', category: 'Navigation' },
    { id: 'nav-supp', title: 'Fournisseurs', icon: Building, path: '/suppliers', category: 'Navigation' },
    { id: 'nav-doc', title: 'Documents', icon: Briefcase, path: '/documents', category: 'Navigation' },
    { id: 'nav-comp', title: 'Conformité ISO', icon: FileText, path: '/compliance', category: 'Navigation' },
    { id: 'nav-priv', title: 'Confidentialité (RGPD)', icon: Fingerprint, path: '/privacy', category: 'Navigation' },
    { id: 'nav-audit', title: 'Audits', icon: Activity, path: '/audits', category: 'Navigation' },
    { id: 'nav-team', title: 'Équipe', icon: Users, path: '/team', category: 'Navigation' },
    { id: 'nav-help', title: 'Centre d\'aide', icon: HelpCircle, path: '/help', category: 'Navigation' },
    { id: 'nav-set', title: 'Paramètres', icon: Settings, path: '/settings', category: 'Navigation' },
];

export const CommandPalette: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [queryStr, setQueryStr] = useState('');
    const [filteredItems, setFilteredItems] = useState<CommandItem[]>([]);
    const [dbItems, setDbItems] = useState<CommandItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const navigate = useNavigate();
    const { user } = useStore();

    // Define Quick Actions
    // Define Quick Actions
    const ACTION_ITEMS: CommandItem[] = React.useMemo(() => [
        { id: 'act-inc', title: 'Déclarer un Incident', subtitle: 'Créer une nouvelle alerte de sécurité', icon: Siren, category: 'Actions', action: () => navigate('/incidents') },
        { id: 'act-asset', title: 'Ajouter un Actif', subtitle: 'Enregistrer un nouvel équipement ou logiciel', icon: Plus, category: 'Actions', action: () => navigate('/assets') },
        { id: 'act-risk', title: 'Nouveau Risque', subtitle: 'Identifier une nouvelle menace', icon: ShieldAlert, category: 'Actions', action: () => navigate('/risks') },
        { id: 'act-user', title: 'Inviter Utilisateur', subtitle: 'Ajouter un membre à l\'équipe', icon: Users, category: 'Actions', action: () => navigate('/team') },
        { id: 'act-audit', title: 'Planifier Audit', subtitle: 'Créer un nouvel audit de conformité', icon: Activity, category: 'Actions', action: () => navigate('/audits') },
    ], [navigate]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
            if (isOpen) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIndex(prev => (prev + 1) % filteredItems.length);
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
                }
                if (e.key === 'Enter' && filteredItems.length > 0) {
                    e.preventDefault();
                    const item = filteredItems[selectedIndex];
                    if (item.action) {
                        item.action();
                    } else if (item.path) {
                        navigate(item.path);
                    }
                    setIsOpen(false);
                    setQueryStr('');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredItems, selectedIndex, navigate]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [queryStr]);

    // Fetch searchable items securely (scoped to organization)
    useEffect(() => {
        if (isOpen && dbItems.length === 0 && user?.organizationId) {
            const fetchSearchableItems = async () => {
                setLoading(true);
                const orgId = user.organizationId;
                try {
                    const items: CommandItem[] = [];

                    // Fetch Assets
                    const assetsSnap = await getDocs(query(collection(db, 'assets'), where('organizationId', '==', orgId), limit(10)));
                    assetsSnap.forEach(doc => items.push({
                        id: `asset-${doc.id}`,
                        title: doc.data().name,
                        subtitle: `Actif • ${doc.data().type}`,
                        icon: Server,
                        path: '/assets',
                        category: 'Données'
                    }));

                    // Fetch Risks
                    const risksSnap = await getDocs(query(collection(db, 'risks'), where('organizationId', '==', orgId), limit(10)));
                    risksSnap.forEach(doc => items.push({
                        id: `risk-${doc.id}`,
                        title: doc.data().threat,
                        subtitle: `Risque • Score: ${doc.data().score}`,
                        icon: ShieldAlert,
                        path: '/risks',
                        category: 'Données'
                    }));

                    // Fetch Controls (ISO)
                    const ctrlSnap = await getDocs(query(collection(db, 'controls'), where('organizationId', '==', orgId), limit(20)));
                    ctrlSnap.forEach(doc => items.push({
                        id: `ctrl-${doc.id}`,
                        title: `${doc.data().code} - ${doc.data().name}`,
                        subtitle: `Contrôle • ${doc.data().status}`,
                        icon: FileText,
                        path: '/compliance',
                        category: 'Conformité'
                    }));

                    // Fetch Documents
                    const docsSnap = await getDocs(query(collection(db, 'documents'), where('organizationId', '==', orgId), limit(10)));
                    docsSnap.forEach(doc => items.push({
                        id: `doc-${doc.id}`,
                        title: doc.data().title,
                        subtitle: `Document • ${doc.data().version}`,
                        icon: Briefcase,
                        path: '/documents',
                        category: 'Fichiers'
                    }));

                    // Fetch Projects
                    const projsSnap = await getDocs(query(collection(db, 'projects'), where('organizationId', '==', orgId), limit(5)));
                    projsSnap.forEach(doc => items.push({
                        id: `proj-${doc.id}`,
                        title: doc.data().name,
                        subtitle: `Projet • ${doc.data().status}`,
                        icon: FolderKanban,
                        path: '/projects',
                        category: 'Gestion'
                    }));

                    // Fetch Incidents
                    const incSnap = await getDocs(query(collection(db, 'incidents'), where('organizationId', '==', orgId), limit(5)));
                    incSnap.forEach(doc => items.push({
                        id: `inc-${doc.id}`,
                        title: doc.data().title,
                        subtitle: `Incident • ${doc.data().severity}`,
                        icon: Siren,
                        path: '/incidents',
                        category: 'Alertes'
                    }));

                    setDbItems(items);
                } catch (error) {
                    ErrorLogger.error(error, 'CommandPalette.fetchSearchableItems');
                } finally {
                    setLoading(false);
                }
            };
            fetchSearchableItems();
        }
    }, [isOpen, user?.organizationId, dbItems.length]);

    useEffect(() => {
        if (!queryStr) {
            setFilteredItems([...ACTION_ITEMS, ...NAVIGATION_ITEMS].slice(0, 10));
            return;
        }
        const lowerQuery = queryStr.toLowerCase();

        const actionResults = ACTION_ITEMS.filter(item =>
            item.title.toLowerCase().includes(lowerQuery)
        );

        const navResults = NAVIGATION_ITEMS.filter(item =>
            item.title.toLowerCase().includes(lowerQuery)
        );

        const dbResults = dbItems.filter(item =>
            item.title.toLowerCase().includes(lowerQuery) ||
            (item.subtitle && item.subtitle.toLowerCase().includes(lowerQuery))
        );

        const allResults = [...actionResults, ...navResults, ...dbResults].slice(0, 12);

        // Add "See all results" option if there is a query
        if (queryStr.trim().length > 0) {
            allResults.push({
                id: 'search-all',
                title: `Voir tous les résultats pour "${queryStr}"`,
                subtitle: 'Recherche avancée...',
                icon: Search,
                category: 'Recherche',
                action: () => navigate(`/search?q=${encodeURIComponent(queryStr)}`)
            });
        }

        setFilteredItems(allResults);
    }, [queryStr, dbItems, navigate, ACTION_ITEMS]);

    const handleSelect = (item: CommandItem) => {
        if (item.action) {
            item.action();
        } else if (item.path) {
            navigate(item.path);
        }
        setIsOpen(false);
        setQueryStr('');
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
                onClick={() => setIsOpen(false)}
            />

            <div className="relative w-full max-w-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col border border-white/20 dark:border-white/10 ring-1 ring-black/5">
                <div className="flex items-center px-4 py-4 border-b border-gray-200/50 dark:border-white/10">
                    <Search className="h-5 w-5 text-slate-400 mr-3" />
                    <input
                        type="text"
                        placeholder="Rechercher ou exécuter une commande..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-lg text-slate-900 dark:text-white placeholder-slate-400 outline-none font-medium"
                        value={queryStr}
                        onChange={e => setQueryStr(e.target.value)}
                        autoFocus
                    />
                    <div className="hidden sm:flex items-center gap-2">
                        {loading && <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>}
                        <kbd className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-white/10 rounded-md text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider shadow-sm border border-gray-200 dark:border-white/5">
                            ESC
                        </kbd>
                    </div>
                </div>

                <div className="overflow-y-auto p-2 max-h-[60vh] custom-scrollbar">
                    {filteredItems.length === 0 && !loading ? (
                        <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm flex flex-col items-center">
                            <Command className="h-8 w-8 mb-3 opacity-30" />
                            Aucun résultat trouvé pour "{queryStr}".
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredItems.map((item, index) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`w-full flex items-center px-4 py-3.5 rounded-xl group transition-all duration-200 ${index === selectedIndex
                                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30 scale-[1.01]'
                                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg mr-4 transition-colors ${index === selectedIndex
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-gray-200 dark:border-white/5'
                                        }`}>
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <span className="font-bold block text-sm">{item.title}</span>
                                        {item.subtitle && <span className={`text-xs block mt-0.5 ${index === selectedIndex ? 'text-white/80' : 'text-slate-400'}`}>{item.subtitle}</span>}
                                    </div>
                                    <div className="flex items-center">
                                        <span className={`text-[10px] uppercase tracking-wider font-bold mr-3 px-2 py-0.5 rounded-md ${index === selectedIndex
                                            ? 'bg-white/20 text-white'
                                            : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                                            }`}>{item.category}</span>
                                        <ArrowRight className={`h-4 w-4 transition-transform duration-300 ${index === selectedIndex ? 'text-white translate-x-1' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-4 py-3 bg-gray-50/80 dark:bg-black/40 border-t border-gray-200/50 dark:border-white/5 flex justify-between items-center text-[10px] font-medium text-slate-400 uppercase tracking-wider backdrop-blur-sm">
                    <span className="flex items-center"><Zap className="h-3 w-3 mr-1.5 text-amber-500" /> Sentinel GRC</span>
                    <div className="flex gap-4 items-center">
                        <span className="flex items-center"><ArrowRight className="h-3 w-3 mr-1" /> Sélectionner</span>
                        <span className="flex items-center"><Command className="h-3 w-3 mr-1" /> K pour ouvrir</span>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
