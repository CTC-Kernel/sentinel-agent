
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, Command, LayoutDashboard, Siren, FolderKanban, Server, ShieldAlert, Building, Briefcase, FileText, Activity, Users, Settings, ArrowRight, Fingerprint, HelpCircle, HeartPulse, Plus, Zap } from '../ui/Icons';
import { useLocale } from '../../hooks/useLocale';
import { useLayoutData } from '../../hooks/layout/useLayoutData';
import { validateUrl } from '../../utils/urlValidation';

type IconComponent = React.ComponentType<{ className?: string }>;

interface CommandItem {
 id: string;
 title: string;
 subtitle?: string;
 icon: IconComponent;
 path?: string;
 action?: () => void;
 category: string;
}

export const CommandPalette: React.FC = () => {
 const [isOpen, setIsOpen] = useState(false);
 const [queryStr, setQueryStr] = useState('');
 const [selectedIndex, setSelectedIndex] = useState(0);
 const navigate = useNavigate();
 const { t } = useLocale();
 // Only load search data when command palette is open (deferred loading)
 const { assets, risks, documents, incidents, projects, loading } = useLayoutData({
 enableSearch: isOpen,
 enableNotifications: false, // CommandPalette doesn't need notifications
 });

 const NAVIGATION_ITEMS: CommandItem[] = React.useMemo(() => [
 { id: 'nav-dash', title: t('commandPalette.nav.dashboard'), icon: LayoutDashboard, path: '/', category: t('commandPalette.categories.navigation') },
 { id: 'nav-inc', title: t('commandPalette.nav.incidents'), icon: Siren, path: '/incidents', category: t('commandPalette.categories.navigation') },
 { id: 'nav-proj', title: t('commandPalette.nav.projects'), icon: FolderKanban, path: '/projects', category: t('commandPalette.categories.navigation') },
 { id: 'nav-asset', title: t('commandPalette.nav.assets'), icon: Server, path: '/assets', category: t('commandPalette.categories.navigation') },
 { id: 'nav-risk', title: t('commandPalette.nav.risks'), icon: ShieldAlert, path: '/risks', category: t('commandPalette.categories.navigation') },
 { id: 'nav-cont', title: t('commandPalette.nav.continuity'), icon: HeartPulse, path: '/continuity', category: t('commandPalette.categories.navigation') },
 { id: 'nav-supp', title: t('commandPalette.nav.suppliers'), icon: Building, path: '/suppliers', category: t('commandPalette.categories.navigation') },
 { id: 'nav-doc', title: t('commandPalette.nav.documents'), icon: Briefcase, path: '/documents', category: t('commandPalette.categories.navigation') },
 { id: 'nav-comp', title: t('commandPalette.nav.compliance'), icon: FileText, path: '/compliance', category: t('commandPalette.categories.navigation') },
 { id: 'nav-priv', title: t('commandPalette.nav.privacy'), icon: Fingerprint, path: '/privacy', category: t('commandPalette.categories.navigation') },
 { id: 'nav-audit', title: t('commandPalette.nav.audits'), icon: Activity, path: '/audits', category: t('commandPalette.categories.navigation') },
 { id: 'nav-team', title: t('commandPalette.nav.team'), icon: Users, path: '/team', category: t('commandPalette.categories.navigation') },
 { id: 'nav-help', title: t('commandPalette.nav.help'), icon: HelpCircle, path: '/help', category: t('commandPalette.categories.navigation') },
 { id: 'nav-set', title: t('commandPalette.nav.settings'), icon: Settings, path: '/settings', category: t('commandPalette.categories.navigation') },
 ], [t]);

 const ACTION_ITEMS: CommandItem[] = React.useMemo(() => [
 { id: 'act-inc', title: t('commandPalette.actions.declareIncident'), subtitle: t('commandPalette.actions.declareIncidentSub'), icon: Siren, category: t('commandPalette.categories.actions'), action: () => navigate('/incidents') },
 { id: 'act-asset', title: t('commandPalette.actions.addAsset'), subtitle: t('commandPalette.actions.addAssetSub'), icon: Plus, category: t('commandPalette.categories.actions'), action: () => navigate('/assets') },
 { id: 'act-risk', title: t('commandPalette.actions.newRisk'), subtitle: t('commandPalette.actions.newRiskSub'), icon: ShieldAlert, category: t('commandPalette.categories.actions'), action: () => navigate('/risks') },
 { id: 'act-user', title: t('commandPalette.actions.inviteUser'), subtitle: t('commandPalette.actions.inviteUserSub'), icon: Users, category: t('commandPalette.categories.actions'), action: () => navigate('/team') },
 { id: 'act-audit', title: t('commandPalette.actions.planAudit'), subtitle: t('commandPalette.actions.planAuditSub'), icon: Activity, category: t('commandPalette.categories.actions'), action: () => navigate('/audits') },
 ], [navigate, t]);

 // Transform hook data into searchable command items
 const dbItems = useMemo(() => {
 const items: CommandItem[] = [];

 // Add Assets (limit 10)
 assets.slice(0, 10).forEach(asset => items.push({
 id: `asset-${asset.id}`,
 title: asset.name,
 subtitle: `${t('sidebar.assets')} • ${asset.type}`,
 icon: Server,
 path: '/assets',
 category: t('commandPalette.categories.recent')
 }));

 // Add Risks (limit 10)
 risks.slice(0, 10).forEach(risk => items.push({
 id: `risk-${risk.id}`,
 title: risk.threat,
 subtitle: `${t('sidebar.dashboard')} • Score: ${risk.score}`,
 icon: ShieldAlert,
 path: '/risks',
 category: t('commandPalette.categories.recent')
 }));

 // Add Documents (limit 10)
 documents.slice(0, 10).forEach(doc => items.push({
 id: `doc-${doc.id}`,
 title: doc.title,
 subtitle: `${t('sidebar.documents')} • ${doc.version || 'v1.0'}`,
 icon: Briefcase,
 path: '/documents',
 category: t('commandPalette.categories.recent')
 }));

 // Add Projects (limit 5)
 projects.slice(0, 5).forEach(project => items.push({
 id: `proj-${project.id}`,
 title: project.name,
 subtitle: `${t('sidebar.projects')} • ${project.status}`,
 icon: FolderKanban,
 path: '/projects',
 category: t('commandPalette.categories.management')
 }));

 // Add Incidents (limit 5)
 incidents.slice(0, 5).forEach(incident => items.push({
 id: `inc-${incident.id}`,
 title: incident.title,
 subtitle: `${t('sidebar.incidents')} • ${incident.severity}`,
 icon: Siren,
 path: '/incidents',
 category: t('commandPalette.categories.alerts')
 }));

 return items;
 }, [assets, risks, documents, projects, incidents, t]);

 const filteredItems = useMemo(() => {
 if (!queryStr) {
 return [...ACTION_ITEMS, ...NAVIGATION_ITEMS].slice(0, 10);
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

 if (queryStr.trim().length > 0) {
 const searchAllOption: CommandItem = {
 id: 'search-all-explicit',
 title: t('commandPalette.searchInSentinel').replace('{query}', queryStr),
 subtitle: t('commandPalette.advancedSearch'),
 icon: Search,
 category: t('commandPalette.categories.global'),
 action: () => navigate(`/search?q=${encodeURIComponent(queryStr)}`)
 };
 allResults.unshift(searchAllOption);
 }

 return allResults;
 }, [queryStr, dbItems, navigate, ACTION_ITEMS, NAVIGATION_ITEMS, t]);

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
 const count = filteredItems.length;
 if (e.key === 'ArrowDown') {
  e.preventDefault();
  if (count === 0) return;
  setSelectedIndex(prev => (prev + 1) % count);
 }
 if (e.key === 'ArrowUp') {
  e.preventDefault();
  if (count === 0) return;
  setSelectedIndex(prev => (prev - 1 + count) % count);
 }
 if (e.key === 'Enter' && count > 0) {
  e.preventDefault();
  const item = filteredItems[selectedIndex];
  if (item.action) {
  item.action();
  } else if (item.path) {
  const safeUrl = validateUrl(item.path); if (safeUrl) navigate(safeUrl); // validateUrl checked
  }
  setIsOpen(false);
  setQueryStr('');
  setSelectedIndex(0);
 }
 }
 };

 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [isOpen, filteredItems, selectedIndex, navigate]);

 const handleSelect = (item: CommandItem) => {
 if (item.action) {
 item.action();
 } else if (item.path) {
 const safeUrl = validateUrl(item.path); if (safeUrl) navigate(safeUrl); // validateUrl checked
 }
 setIsOpen(false);
 setQueryStr('');
 setSelectedIndex(0);
 };

 if (!isOpen) return null;

 return createPortal(
 <div className="fixed inset-0 z-max flex items-start justify-center pt-[5vh] sm:pt-[10vh] md:pt-[15vh] px-2 sm:px-4">
 <button
 className="absolute inset-0 bg-[var(--overlay-bg)] backdrop-blur-md transition-opacity duration-300 border-0 cursor-pointer"
 onClick={() => setIsOpen(false)}
 aria-label={t('layout.commandPalette.closeAriaLabel', { defaultValue: 'Fermer la palette de commandes' })}
 onKeyDown={(e) => {
  if (e.key === 'Escape') setIsOpen(false);
 }}
 />

 <div className="relative w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl glass-premium rounded-3xl sm:rounded-4xl shadow-2xl overflow-hidden animate-scale-in flex flex-col border border-border/40 ring-1 ring-black/5 pointer-events-none">
 <div className="pointer-events-auto flex items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-border/40 relative z-decorator">
  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
  <Search className="h-5 w-5 text-primary mr-4 font-bold" />
  <input value={queryStr} onChange={e => { setQueryStr(e.target.value); setSelectedIndex(0); }}
  type="text"
  placeholder={t('commandPalette.placeholder')}
  className="flex-1 bg-transparent border-none focus:ring-0 text-lg text-foreground placeholder-muted-foreground outline-none font-medium h-auto py-0"
  aria-label={t('layout.commandPalette.searchAriaLabel', { defaultValue: 'Rechercher une commande' })}
  />
  <div className="hidden sm:flex items-center gap-2">
  {loading && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>}
  <kbd className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-lg text-[11px] font-bold text-muted-foreground tracking-wider shadow-sm border border-border/40 font-mono">
  ESC
  </kbd>
  </div>
 </div>

 <div className="overflow-y-auto p-2 sm:p-3 max-h-[50vh] sm:max-h-[60vh] custom-scrollbar relative z-decorator">
  {filteredItems.length === 0 && !loading ? (
  <div className="p-16 text-center text-muted-foreground text-sm flex flex-col items-center">
  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
  <Command className="h-8 w-8 opacity-40" />
  </div>
  <p className="font-medium">{t('commandPalette.noResults')} "{queryStr}"</p>
  </div>
  ) : (
  <div className="space-y-1.5">
  {filteredItems.map((item, index) => (
  <button
   key={item.id || 'unknown'}
   onClick={() => handleSelect(item)}
   onMouseEnter={() => setSelectedIndex(index)}
   className={`w-full flex items-center px-4 py-3.5 rounded-3xl group transition-all duration-200 ${index === selectedIndex
   ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-[1.01] ring-1 ring-white/20'
   : 'text-muted-foreground hover:bg-muted/50'
   }`}
  >
   <div className={`p-2.5 rounded-3xl mr-4 transition-colors ${index === selectedIndex
   ? 'bg-white/20 text-white'
   : 'bg-muted text-muted-foreground border border-border/40'
   }`}>
   <item.icon className="h-5 w-5" />
   </div>
   <div className="flex-1 text-left">
   <span className="font-bold block text-sm">{item.title}</span>
   {item.subtitle && <span className={`text-xs block mt-0.5 ${index === selectedIndex ? 'text-white/80' : 'text-muted-foreground'}`}>{item.subtitle}</span>}
   </div>
   <div className="flex items-center">
   <span className={`text-[11px] uppercase tracking-wider font-bold mr-3 px-2 py-0.5 rounded-md ${index === selectedIndex
   ? 'bg-white/20 text-white border border-white/20'
   : 'bg-muted text-muted-foreground border border-border/40'
   }`}>{item.category}</span>
   <ArrowRight className={`h-4 w-4 transition-transform duration-300 ${index === selectedIndex ? 'text-white translate-x-1' : 'text-muted-foreground/40 opacity-0 group-hover:opacity-70'}`} />
   </div>
  </button>
  ))}
  </div>
  )}
 </div>

 <div className="px-6 py-3 bg-muted/50 border-t border-border/40 flex justify-between items-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider backdrop-blur-md relative z-decorator">
  <span className="flex items-center gap-2">
  <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
  <span className="font-bold">Sentinel GRC Pro</span>
  </span>
  <div className="flex gap-4 items-center">
  <span className="flex items-center gap-1.5"><ArrowRight className="h-3 w-3" /> {t('commandPalette.select')}</span>
  <span className="flex items-center gap-1.5"><Command className="h-3 w-3" /> {t('commandPalette.open')}</span>
  </div>
 </div>
 </div>
 </div>,
 document.body
 );
};
