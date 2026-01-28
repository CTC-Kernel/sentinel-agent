import React from 'react';
import {
    Shield,
    Lock,
    Activity,
    Layers,
    FileText,
    Users,
    Bell,
    Search,
    MoreHorizontal,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    ShieldAlert
} from '../ui/Icons';

export const LandingDashboardMockup: React.FC = () => {
    return (
        <div className="w-full h-full bg-slate-900/80 backdrop-blur-sm rounded-[1.5rem] overflow-hidden flex text-sans shadow-2xl ring-1 ring-white/10 select-none text-[11px] sm:text-xs md:text-sm font-medium">
            {/* Sidebar Mockup */}
            <div className="w-16 sm:w-20 md:w-64 bg-slate-950/50 backdrop-blur-md flex flex-col border-r border-white/5 flex-shrink-0 relative">
                <div className="p-4 md:p-6 flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-3xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg shadow-brand-500/30 flex-shrink-0 ring-1 ring-white/20">
                        <Lock className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-bold text-lg hidden md:block tracking-tight">Sentinel</span>
                </div>

                <div className="flex-1 space-y-1 px-3">
                    {[
                        { icon: Activity, label: 'Tableau de bord', active: true },
                        { icon: Layers, label: 'Actifs & Inventaire', active: false },
                        { icon: ShieldAlert, label: 'Registre des Risques', active: false },
                        { icon: CheckCircle2, label: 'Conformité ISO', active: false },
                        { icon: FileText, label: 'Audits & Rapports', active: false },
                        { icon: Users, label: 'Équipe & Rôles', active: false },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-3xl transition-all ${item.active
                                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25'
                                : 'hover:bg-white/5 hover:text-slate-200'
                                }`}
                        >
                            <item.icon className={`h-5 w-5 ${item.active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                            <span className="font-medium hidden md:block">{item.label}</span>
                        </div>
                    ))}
                </div>

                {/* User Profile Snippet */}
                <div className="p-4 border-t border-white/5 mt-auto">
                    <div className="flex items-center gap-3 bg-white/5 p-2 rounded-3xl border border-white/5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-400 to-purple-500 border-2 border-slate-800"></div>
                        <div className="hidden md:block overflow-hidden">
                            <div className="font-bold text-slate-200 truncate">Thibault L.</div>
                            <div className="text-xs text-slate-500 dark:text-slate-300 truncate">Admin (RSSI)</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Mockup */}
            <div className="flex-1 flex flex-col bg-slate-950/30 relative">
                {/* Top Bar */}
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-white/5 backdrop-blur-sm">
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <span className="hidden sm:inline hover:text-white transition-colors cursor-default">Pilotage</span>
                        <span className="hidden sm:inline text-slate-600">/</span>
                        <span className="font-bold text-slate-100">Vue d'ensemble</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-border/40 text-slate-400 hover:bg-white/10 transition-colors">
                            <Search className="h-3.5 w-3.5" />
                            <span className="text-xs">Rechercher...</span>
                            <span className="text-[11px] border border-border/40 px-1.5 py-0.5 rounded ml-4 text-slate-500">⌘K</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-border/40 flex items-center justify-center text-slate-400 relative hover:text-white transition-colors hover:bg-white/10">
                            <Bell className="h-4 w-4" />
                            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900 shadow-sm"></span>
                        </div>
                    </div>
                </div>

                {/* Dashboard Content */}
                <div className="flex-1 p-6 overflow-hidden relative">
                    {/* Header */}
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Tableau de Bord SSI</h1>
                            <p className="text-slate-500 font-normal">Vue synthétique de votre posture de sécurité.</p>
                        </div>
                        <div className="hidden sm:flex gap-3">
                            <div className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-border/40 rounded-lg text-xs font-medium text-slate-300 shadow-sm transition-colors cursor-default">
                                30 derniers jours
                            </div>
                            <div className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-brand-500/25 transition-all cursor-default flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5" />
                                Générer rapport
                            </div>
                        </div>
                    </div>

                    {/* Widgets Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {/* Widget 1 */}
                        <div className="bg-white/5 p-5 rounded-2xl border border-border/40 hover:border-white/20 transition-colors group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-green-50 rounded-lg text-green-400 ring-1 ring-green-500/20">
                                    <Shield className="h-5 w-5" />
                                </div>
                                <span className="text-green-400 text-xs font-bold bg-green-50 px-2 py-0.5 rounded-full ring-1 ring-green-500/20">+12%</span>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1 tracking-tight">84%</div>
                            <div className="text-slate-500 text-xs font-medium">Score de Conformité</div>
                            <div className="mt-4 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 w-[84%] shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                            </div>
                        </div>

                        {/* Widget 2 */}
                        <div className="bg-white/5 p-5 rounded-2xl border border-border/40 hover:border-white/20 transition-colors group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-yellow-50 rounded-lg text-yellow-400 ring-1 ring-yellow-500/20">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <span className="text-yellow-400 text-xs font-bold bg-yellow-50 px-2 py-0.5 rounded-full ring-1 ring-yellow-500/20">-2</span>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1 tracking-tight">3</div>
                            <div className="text-slate-500 text-xs font-medium">Risques Critiques</div>
                        </div>

                        {/* Widget 3 */}
                        <div className="bg-white/5 p-5 rounded-2xl border border-border/40 hover:border-white/20 transition-colors group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-400 ring-1 ring-blue-500/20">
                                    <Layers className="h-5 w-5" />
                                </div>
                                <span className="text-slate-500 hover:text-white transition-colors">
                                    <MoreHorizontal className="h-4 w-4" />
                                </span>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1 tracking-tight">248</div>
                            <div className="text-slate-500 text-xs font-medium">Actifs Protégés</div>
                        </div>

                        {/* Widget 4 */}
                        <div className="bg-white/5 p-5 rounded-2xl border border-border/40 hover:border-white/20 transition-colors group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 ring-1 ring-purple-500/20">
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1 tracking-tight">98.2%</div>
                            <div className="text-slate-500 text-xs font-medium">SLA Disponibilité</div>
                        </div>
                    </div>

                    {/* Main Chart Area Mockup */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 auto-rows-fr">
                        <div className="lg:col-span-2 bg-white/5 rounded-2xl border border-border/40 p-6 flex flex-col relative overflow-hidden min-h-[250px]">
                            {/* Grid lines background */}
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

                            <div className="flex justify-between items-center mb-6 relative z-10">
                                {/* Heading hierarchy: h2 for chart title (follows h1) */}
                                <h2 className="font-bold text-white">Évolution de la maturité ISO 27001</h2>
                                <div className="flex gap-4 text-xs">
                                    <span className="flex items-center gap-1.5 text-muted-foreground"><div className="w-2 h-2 rounded-full bg-slate-600"></div>Cible</span>
                                    <span className="flex items-center gap-1.5 text-muted-foreground"><div className="w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>Actuel</span>
                                </div>
                            </div>
                            <div className="flex-1 flex items-end justify-between gap-4 px-2 pb-2 relative z-10">
                                {[40, 55, 45, 60, 75, 65, 80, 70, 85, 90, 82, 88].map((h, i) => (
                                    <div key={`bar-${i}`} className="w-full bg-white/5 rounded-t-sm relative group h-full flex items-end overflow-hidden">
                                        <div
                                            className="w-full bg-brand-100 group-hover:bg-brand-200 transition-all duration-500 rounded-t-sm relative"
                                            style={{ height: `${h}%` }}
                                        >
                                            <div
                                                className="absolute bottom-0 w-full bg-gradient-to-t from-brand-600 to-brand-400 rounded-t-sm shadow-[0_-5px_15px_-5px_rgba(99,102,241,0.5)]"
                                                style={{ height: '4px', opacity: 0.8 }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-1 bg-white/5 rounded-2xl border border-border/40 p-6 flex flex-col relative overflow-hidden min-h-[250px]">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/25 dark:bg-brand-400/15 blur-[50px] rounded-full pointer-events-none"></div>

                            <h3 className="font-bold text-white mb-6 relative z-10">Répartition</h3>
                            <div className="flex-1 flex items-center justify-center relative scale-110">
                                <div className="w-28 h-28 rounded-full border-[12px] border-green-500 border-r-brand-500 border-b-yellow-500 border-l-slate-800 -rotate-45 shadow-[0_0_20px_-5px_rgba(0,0,0,0.5)]"></div>
                                <div className="absolute flex flex-col items-center">
                                    <span className="text-2xl font-bold text-white">124</span>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-300 uppercase font-bold tracking-wider">Total</span>
                                </div>
                            </div>
                            <div className="mt-6 flex flex-col gap-2 relative z-10">
                                <div className="flex justify-between text-xs items-center">
                                    <span className="flex items-center gap-2 text-muted-foreground"><div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>En cours</span>
                                    <span className="font-bold text-slate-200">45%</span>
                                </div>
                                <div className="flex justify-between text-xs items-center">
                                    <span className="flex items-center gap-2 text-muted-foreground"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>Clôturé</span>
                                    <span className="font-bold text-slate-200">32%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Faux overlay to indicate interactivity isn't real on the landing page if needed, OR just nice glass overlay for 'Premium' feel */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-50/20 via-transparent to-transparent pointer-events-none"></div>
                </div>
            </div>
        </div>
    );
};
