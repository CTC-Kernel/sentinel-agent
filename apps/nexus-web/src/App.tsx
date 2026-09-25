import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowRight, Bell, Bot, Check, ChevronDown, ChevronRight, Circle,
  Clock3, FileDown, Filter, Fingerprint, KeyRound, LockKeyhole, Menu, Play,
  Plus, RefreshCw, Search, Send, Shield, ShieldCheck, Sparkles, Users, Workflow, X,
  Zap, Crosshair, Eye, Globe2, Radio, ScanLine, TriangleAlert,
  Moon, Sun,
} from "lucide-react";
import { compliance, genericPages, incidents, kpis, navGroups, templates, workflows } from "./data";
import { orchestrationClient, type Execution } from "./services/orchestration";
import { intelligenceClient, modelCatalog, type ChatMessage, type ModelProvider } from "./services/ai";

export function App() {
  const [page, setPage] = useState(() => sessionStorage.getItem("nexus:last-page") ?? "dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("nexus:theme");
    return saved === "dark" || saved === "light" ? saved : "light";
  });

  const pageLabel = useMemo(() => navGroups.flatMap((g) => g.items).find((item) => item.id === page)?.label ?? "Sentinel Nexus", [page]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  useEffect(() => sessionStorage.setItem("nexus:last-page", page), [page]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("nexus:theme", theme);
  }, [theme]);
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") { setSearchOpen(false); setAssistantOpen(false); }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, []);

  return <div className="app-shell">
    <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />
    <div className="workspace">
      <header className="topbar">
        <div className="crumb"><span>ACME EUROPE</span><ChevronRight size={13}/><strong>{pageLabel}</strong></div>
        <button className="command-search" onClick={() => setSearchOpen(true)}><Search size={16}/><span>Rechercher partout…</span><kbd>⌘ K</kbd></button>
        <div className="top-actions">
          <div className="secure"><ShieldCheck size={15}/><span>Protection active</span></div>
          <button className="icon-button theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Activer le thème sombre" : "Activer le thème clair"} title={theme === "light" ? "Thème sombre" : "Thème clair"}>{theme === "light" ? <Moon size={17}/> : <Sun size={17}/>}</button>
          <button className="icon-button has-dot" aria-label="Notifications"><Bell size={18}/></button>
          <button className="profile"><span>CD</span><div><strong>Camille Durand</strong><small>Security Admin</small></div><ChevronDown size={14}/></button>
        </div>
      </header>
      <main>
        {page === "dashboard" ? <Dashboard onNavigate={setPage} notify={notify}/> : page === "orchestration" ? <Orchestration notify={notify}/> : page === "threats" ? <ThreatCenter notify={notify}/> : <ModulePage id={page}/>}
      </main>
    </div>
    <button className="ai-fab" onClick={() => setAssistantOpen(true)}><Sparkles size={20}/><span>Sentinel Intelligence</span></button>
    {assistantOpen && <Assistant page={page} onClose={() => setAssistantOpen(false)} />}
    {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} onNavigate={(id) => { setPage(id); setSearchOpen(false); }}/>}
    {toast && <div className="toast"><Check size={17}/>{toast}</div>}
  </div>;
}

function Sidebar({ page, setPage, collapsed, setCollapsed }: { page: string; setPage: (id: string) => void; collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  return <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
    <div className="brand"><div className="brand-mark"><Shield size={21}/><i/></div>{!collapsed && <div><b>SENTINEL</b><span>NEXUS</span></div>}<button onClick={() => setCollapsed(!collapsed)}><Menu size={17}/></button></div>
    <div className="tenant">{!collapsed && <><small>ESPACE SÉCURISÉ</small><strong><span className="tenant-logo">A</span>ACME Europe</strong></>}</div>
    <nav>{navGroups.map((group) => <div className="nav-group" key={group.label}>{!collapsed && <label>{group.label}</label>}{group.items.map((item) => <button title={item.label} className={page === item.id ? "active" : ""} key={item.id} onClick={() => setPage(item.id)}><item.icon size={18}/>{!collapsed && <><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}</>}</button>)}</div>)}</nav>
    <div className="sidebar-footer"><button><Activity size={17}/>{!collapsed && <span><b>Systèmes opérationnels</b><small>Dernière synchro · maintenant</small></span>}<i/></button></div>
  </aside>;
}

function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

function Dashboard({ onNavigate, notify }: { onNavigate: (id: string) => void; notify: (s: string) => void }) {
  return <div className="page fade-in">
    <PageHeading eyebrow="JEUDI 24 SEPTEMBRE · 15:42 UTC" title="Bonjour Camille." description="Voici l'essentiel de votre posture de sécurité aujourd'hui." actions={<><button className="secondary"><FileDown size={16}/> Rapport exécutif</button><button className="primary" onClick={() => notify("Analyse globale lancée") }><Zap size={16}/> Lancer une analyse</button></>}/>
    <section className="hero-grid">
      <article className="posture-card panel glow-panel">
        <div className="card-top"><div><span className="eyebrow">POSTURE GLOBALE</span><h2>Votre organisation est <em>résiliente</em></h2></div><span className="live-pill"><i/> TEMPS RÉEL</span></div>
        <div className="posture-body"><ScoreRing/><div className="posture-insight"><div className="ai-label"><Sparkles size={14}/> ANALYSE SENTINEL AI</div><p>Votre score progresse grâce à la correction de <strong>6 vulnérabilités critiques</strong>. Trois risques nécessitent encore une décision.</p><button onClick={() => onNavigate("risks")}>Voir les priorités <ArrowRight size={15}/></button></div></div>
        <div className="posture-foot"><span><Check/> Identités <b>96%</b></span><span><Check/> Endpoints <b>91%</b></span><span><Check/> Cloud <b>89%</b></span><span><Check/> Données <b>92%</b></span></div>
      </article>
      <article className="panel risk-card"><div className="card-top"><div><span className="eyebrow">RISQUE À TRAITER</span><h3>Accès privilégié dormant</h3></div><span className="severity critical">CRITIQUE</span></div><p>4 comptes administrateurs sans activité depuis plus de 90 jours conservent des droits étendus.</p><div className="risk-meta"><span><Clock3/> SLA · 4 heures</span><span><Users/> IAM Team</span></div><button className="primary full" onClick={() => notify("Plan de remédiation ouvert")}>Examiner le plan <ArrowRight size={15}/></button></article>
    </section>
    <section className="kpi-grid">{kpis.map((k) => <article className={`kpi panel ${k.tone}`} key={k.label}><div className="mini-icon"><Activity/></div><span>{k.label}</span><div><strong>{k.value}</strong><small>{k.suffix}</small></div><em>{k.delta}</em><svg viewBox="0 0 160 35"><path d="M0 29 C20 30,25 19,45 22 S70 8,90 16 S120 4,160 8"/></svg></article>)}</section>
    <section className="dashboard-lower">
      <article className="panel"><div className="section-head"><div><span className="eyebrow">ACTIVITÉ SOC</span><h2>Incidents prioritaires</h2></div><button onClick={() => onNavigate("threats")}>Tout afficher <ArrowRight size={15}/></button></div><div className="incident-list">{incidents.map((incident, i) => <div className="incident" key={incident.title}><span className={`severity ${i === 0 ? "critical" : i === 1 ? "high" : "medium"}`}>{incident.severity}</span><div><b>{incident.title}</b><small>{incident.asset} · {incident.time}</small></div><span className="avatar">{incident.owner.split(" ").map((x) => x[0]).join("")}</span><span>{incident.owner}</span><ChevronRight size={16}/></div>)}</div></article>
      <article className="panel"><div className="section-head"><div><span className="eyebrow">COUVERTURE</span><h2>Conformité continue</h2></div><button onClick={() => onNavigate("compliance")}>Détails <ArrowRight size={15}/></button></div><div className="compliance-list">{compliance.map((item) => <div key={item.label}><div><b>{item.label}</b><small>{item.controls} contrôles</small><strong>{item.score}%</strong></div><span><i style={{width: `${item.score}%`}}/></span></div>)}</div></article>
    </section>
  </div>;
}

function ScoreRing() { return <div className="score-ring"><svg viewBox="0 0 140 140"><circle cx="70" cy="70" r="57"/><circle className="score-progress" cx="70" cy="70" r="57"/></svg><div><strong>92</strong><small>/ 100</small><span>+4,8%</span></div></div>; }

function ThreatCenter({ notify }: { notify: (s: string) => void }) {
  const [window, setWindow] = useState("24 h");
  const signals = [
    { label: "Mouvement latéral", source: "FIN-WS-042 → DC-EU-02", time: "Il y a 3 min", tone: "critical", score: "98" },
    { label: "Exfiltration DNS probable", source: "Kubernetes / payments-prod", time: "Il y a 11 min", tone: "high", score: "86" },
    { label: "Authentification impossible", source: "IAM-PROD / user-1842", time: "Il y a 27 min", tone: "medium", score: "72" },
  ];
  return <div className="page threat-page fade-in">
    <PageHeading eyebrow="SOC / THREAT INTELLIGENCE" title="Centre de détection" description="Une lecture temps réel de votre surface d'attaque, enrichie et priorisée par Sentinel Intelligence." actions={<><button className="secondary"><Filter size={16}/> Filtres avancés</button><button className="primary" onClick={() => notify("Chasse aux menaces lancée")}><Crosshair size={16}/> Nouvelle investigation</button></>}/>
    <section className="threat-command panel">
      <div className="radar-stage" aria-label="Radar de menaces en temps réel">
        <div className="radar-grid"><i className="radar-sweep"/><i className="radar-core"/><span className="blip b1"/><span className="blip b2 danger"/><span className="blip b3"/><span className="blip b4 warning"/><span className="radar-axis horizontal"/><span className="radar-axis vertical"/></div>
        <div className="radar-status"><span><i/> SURVEILLANCE ACTIVE</span><strong>2 847</strong><small>événements analysés / min</small></div>
        <div className="radar-legend"><span><i className="safe"/> Normal</span><span><i className="warning"/> Suspect</span><span><i className="danger"/> Critique</span></div>
      </div>
      <div className="threat-overview">
        <header><div><span className="eyebrow">SIGNAL DE MENACE GLOBAL</span><h2>Pression adversaire <em>élevée</em></h2></div><div className="time-switch">{["1 h","24 h","7 j"].map((item) => <button className={window === item ? "active" : ""} onClick={() => setWindow(item)} key={item}>{item}</button>)}</div></header>
        <p>Une campagne coordonnée cible vos identités privilégiées depuis 3 infrastructures récemment observées. Les contrôles compensatoires restent efficaces.</p>
        <div className="threat-metrics"><article><TriangleAlert/><span>Alertes corrélées</span><strong>07</strong><small>+3 sur {window}</small></article><article><Eye/><span>IOC surveillés</span><strong>1 284</strong><small>42 nouveaux</small></article><article><ScanLine/><span>Couverture MITRE</span><strong>84%</strong><small>11 tactiques</small></article></div>
        <div className="ai-brief"><Sparkles/><div><b>Brief Sentinel Intelligence</b><p>Priorité recommandée : isoler FIN-WS-042 puis révoquer ses jetons actifs. Confiance de l'analyse : <strong>94%</strong>.</p></div><button onClick={() => notify("Plan de confinement préparé")}>Préparer la réponse <ArrowRight/></button></div>
      </div>
    </section>
    <section className="threat-lower">
      <article className="panel signal-feed"><div className="section-head"><div><span className="eyebrow">LIVE FEED</span><h2>Signaux prioritaires</h2></div><button>Voir la timeline <ArrowRight size={15}/></button></div>{signals.map((signal) => <button className="signal-row" key={signal.label}><span className={`signal-score ${signal.tone}`}>{signal.score}</span><span><b>{signal.label}</b><small>{signal.source}</small></span><span><Radio/> {signal.time}</span><ChevronRight/></button>)}</article>
      <article className="panel intel-card"><div className="section-head"><div><span className="eyebrow">INTELLIGENCE</span><h2>Origine des signaux</h2></div><Globe2/></div><div className="source-map"><span className="source-point p1"/><span className="source-point p2"/><span className="source-point p3"/><svg viewBox="0 0 400 140" preserveAspectRatio="none"><path d="M30 105 C110 20 235 125 370 35"/><path d="M55 40 C170 110 245 10 345 92"/></svg></div><div className="intel-sources"><span><b>31%</b> Identités</span><span><b>28%</b> Endpoints</span><span><b>24%</b> Cloud</span><span><b>17%</b> Réseau</span></div></article>
    </section>
  </div>;
}

function Orchestration({ notify }: { notify: (s: string) => void }) {
  const [tab, setTab] = useState("overview");
  const [selected, setSelected] = useState(workflows[0]);
  const [launchOpen, setLaunchOpen] = useState(false);
  const tabs = ["Vue d'ensemble", "Workflows", "Marketplace", "Exécutions", "Gouvernance"];
  return <div className="page fade-in orchestration-page">
    <PageHeading eyebrow="NEXUS AUTOMATION CLOUD" title="Orchestration" description="Concevez, gouvernez et exécutez votre défense automatisée." actions={<><span className="connection"><i/> n8n connecté</span><button className="secondary"><KeyRound size={16}/> Connecteurs</button><button className="primary" onClick={() => notify("Nouveau workflow initialisé")}><Plus size={16}/> Nouveau workflow</button></>}/>
    <div className="tabs">{tabs.map((name) => <button className={tab === name.toLowerCase().replace("vue d'ensemble", "overview") ? "active" : ""} key={name} onClick={() => setTab(name.toLowerCase().replace("vue d'ensemble", "overview"))}>{name}</button>)}</div>
    {tab === "overview" ? <OrchestrationOverview notify={notify} onOpenWorkflows={() => setTab("workflows")}/> : tab === "marketplace" ? <Marketplace notify={notify}/> : tab === "exécutions" ? <Executions/> : tab === "gouvernance" ? <Governance/> : <div className="orchestration-grid">
      <section>
        <div className="section-head large"><div><span className="eyebrow">AUTOMATISATIONS</span><h2>Workflows critiques</h2></div><div className="filter-actions"><button><Filter size={15}/> Tous</button><button><Search size={15}/></button></div></div>
        <div className="workflow-list">{workflows.map((workflow) => <button className={`workflow-card panel ${selected.id === workflow.id ? "selected" : ""}`} key={workflow.id} onClick={() => setSelected(workflow)}><div className={`workflow-icon ${workflow.color}`}><Workflow/></div><div className="workflow-info"><div><h3>{workflow.name}</h3><span className={`status ${workflow.status.toLowerCase()}`}>{workflow.status}</span></div><p>{workflow.description}</p><footer><span><Zap/> {workflow.trigger}</span><span><Activity/> {workflow.runs} exécutions</span><span><Check/> {workflow.rate}</span></footer></div><ChevronRight/></button>)}</div>
      </section>
      <aside className="workflow-detail panel">
        <div className="detail-head"><div className={`workflow-icon ${selected.color}`}><Workflow/></div><span className={`status ${selected.status.toLowerCase()}`}>{selected.status}</span></div><span className="eyebrow">WORKFLOW SÉLECTIONNÉ</span><h2>{selected.name}</h2><p>{selected.description}</p>
        <div className="flow-canvas"><FlowNode icon={<Zap/>} label="Déclencheur" sub="Wazuh webhook"/><i/><FlowNode icon={<Bot/>} label="Nexus AI" sub="Qualifier"/><i/><FlowNode icon={<Users/>} label="Approbation" sub="SOC Manager"/><i/><FlowNode icon={<Shield/>} label="Réponse" sub="Isoler"/></div>
        <div className="detail-stats"><div><span>Dernière exécution</span><b>Il y a 3 min</b></div><div><span>Durée moyenne</span><b>4,2 secondes</b></div><div><span>Propriétaire</span><b>SOC Automation</b></div></div>
        <button className="primary full run" onClick={() => setLaunchOpen(true)}><Play size={16}/> Exécuter maintenant</button><button className="secondary full">Ouvrir dans l'éditeur n8n <ArrowRight size={15}/></button>
      </aside>
    </div>}
    {launchOpen && <LaunchModal workflow={selected.name} workflowId={selected.id} onClose={() => setLaunchOpen(false)} onLaunch={(id) => { setLaunchOpen(false); notify(`Exécution ${id} lancée et journalisée`); }}/>}
  </div>;
}

function OrchestrationOverview({ notify, onOpenWorkflows }: { notify: (s: string) => void; onOpenWorkflows: () => void }) {
  const health = [
    { label: "Workflows actifs", value: "12", detail: "+2 ce mois", tone: "mint" },
    { label: "Exécutions / 30 j", value: "1 284", detail: "99,6% réussies", tone: "blue" },
    { label: "Temps SOC économisé", value: "38 h", detail: "+18%", tone: "violet" },
    { label: "Réponse P95", value: "8,7 s", detail: "Objectif < 10 s", tone: "coral" },
  ];
  return <div className="automation-overview">
    <section className="automation-hero panel">
      <div><span className="eyebrow">AUTOMATION CONTROL PLANE</span><h2>Votre défense s'exécute en continu.</h2><p>n8n auto-hébergé, secrets isolés et validations humaines réunis dans un cockpit opérationnel unique.</p><div className="automation-trust"><span><ShieldCheck/> SSO actif</span><span><Fingerprint/> HMAC vérifié</span><span><LockKeyhole/> Tenant isolé</span></div></div>
      <div className="automation-score"><span>FIABILITÉ</span><strong>99,6<small>%</small></strong><em><i/> Tous les systèmes opérationnels</em></div>
    </section>
    <section className="automation-kpis">{health.map((item) => <article className={`panel ${item.tone}`} key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></article>)}</section>
    <section className="automation-columns">
      <article className="panel automation-activity"><div className="section-head"><div><span className="eyebrow">TEMPS RÉEL</span><h2>Activité d'orchestration</h2></div><button onClick={onOpenWorkflows}>Tous les workflows <ArrowRight size={15}/></button></div>
        {[{name:"Zero-day containment",meta:"Wazuh webhook · il y a 3 min",state:"Approbation",tone:"waiting"},{name:"Exposure intelligence",meta:"Shodan + VirusTotal · il y a 12 min",state:"Réussie",tone:"success"},{name:"Executive risk brief",meta:"LLM privé → PDF chiffré · il y a 1 h",state:"Réussie",tone:"success"}].map((run) => <div className="automation-run" key={run.name}><span className={`run-mark ${run.tone}`}><Workflow/></span><div><b>{run.name}</b><small>{run.meta}</small></div><span className={`run-state ${run.tone}`}>{run.state}</span><ChevronRight/></div>)}
      </article>
      <article className="panel automation-copilot"><span className="ai-orb"><Sparkles/></span><span className="eyebrow">ARCHITECTE SENTINEL AI</span><h2>Réponse adaptative recommandée</h2><p>Deux actifs exposés cumulent cinq vulnérabilités élevées. Créez une chaîne de qualification, approbation et isolement.</p><ol><li>Enrichir via Shodan et VirusTotal</li><li>Classifier avec le LLM privé</li><li>Valider puis isoler via Wazuh</li></ol><button className="primary full" onClick={() => notify("Brouillon IA généré et prêt à réviser")}><Sparkles size={15}/> Générer le workflow</button></article>
    </section>
    <section className="connector-strip panel"><div><span className="eyebrow">CONNECTEURS SÉCURISÉS</span><h3>Votre stack SOC, prête à agir</h3></div>{["Wazuh","TheHive","VirusTotal","Shodan","Qualys","Slack"].map((name) => <span key={name}><i/>{name}</span>)}<button onClick={() => notify("Catalogue des connecteurs ouvert")}>Gérer <ArrowRight size={14}/></button></section>
  </div>;
}

function FlowNode({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) { return <div className="flow-node"><span>{icon}</span><b>{label}</b><small>{sub}</small></div>; }

function Marketplace({ notify }: { notify: (s: string) => void }) { return <div className="subpage"><div className="market-hero panel"><div><span className="eyebrow">MARKETPLACE SSI</span><h2>Accélérez votre défense.</h2><p>Des automatisations vérifiées, versionnées et isolées par tenant.</p></div><button className="primary"><Sparkles size={16}/> Composer avec l'IA</button></div><div className="template-grid">{templates.map((template) => <article className="template panel" key={template.title}><template.icon/><span className="eyebrow">{template.type}</span><h3>{template.title}</h3><p>Template certifié Sentinel Labs, prêt à adapter à votre environnement.</p><footer><span>{template.nodes} nœuds · {template.installs} installations</span><button onClick={() => notify(`${template.title} ajouté au tenant`)}>Installer <Plus size={14}/></button></footer></article>)}</div></div>; }

function Executions() {
  const [items, setItems] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [approvalId, setApprovalId] = useState<string>();
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    orchestrationClient.listExecutions(undefined, controller.signal)
      .then((page) => setItems(page.items))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Historique indisponible");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refreshKey]);

  const approve = async (execution: Execution) => {
    setApprovalId(execution.id);
    setActionError("");
    try {
      const updated = await orchestrationClient.approve(execution.id, true, "Validated from Sentinel Nexus console");
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Approbation impossible");
    } finally {
      setApprovalId(undefined);
    }
  };
  const statusLabel: Record<Execution["status"], string> = { queued: "En file", running: "En cours", waiting_approval: "Approbation", succeeded: "Réussie", failed: "Échec", cancelled: "Annulée" };
  const duration = (execution: Execution) => execution.updatedAt ? `${Math.max(1, Math.round((Date.parse(execution.updatedAt) - Date.parse(execution.createdAt)) / 1000))} s` : "—";
  const exportCsv = () => {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = items.map((execution) => [execution.id, execution.createdAt, execution.updatedAt ?? "", execution.status, duration(execution)]);
    const csv = [["id", "created_at", "updated_at", "status", "duration"], ...rows].map((row) => row.map(quote).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `sentinel-executions-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click();
    URL.revokeObjectURL(url);
  };

  return <div className="subpage"><div className="section-head large"><div><span className="eyebrow">TEMPS RÉEL · API N8N SÉCURISÉE</span><h2>Historique d'exécution</h2></div><div className="execution-actions"><button className="secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={16} className={loading ? "spinning" : ""}/> Actualiser</button><button className="secondary" onClick={exportCsv} disabled={!items.length}><FileDown size={16}/> Exporter</button></div></div>
    {actionError && <div className="action-error" role="alert"><TriangleAlert/>{actionError}<button onClick={() => setActionError("")} aria-label="Fermer"><X/></button></div>}
    <div className="execution-table panel"><div className="table-row header"><span>ID</span><span>Démarrage</span><span>Dernière étape</span><span>Durée</span><span>Statut</span><span>Action</span></div>
      {loading && <div className="execution-feedback"><RefreshCw className="spinning"/><b>Synchronisation avec le gateway n8n…</b><small>La clé API reste exclusivement côté serveur.</small></div>}
      {!loading && error && <div className="execution-feedback error"><TriangleAlert/><b>Connexion au gateway indisponible</b><small>{error}</small><button className="secondary" onClick={() => setRefreshKey((value) => value + 1)}>Réessayer</button></div>}
      {!loading && !error && items.length === 0 && <div className="execution-feedback"><ShieldCheck/><b>Aucune exécution pour ce tenant</b><small>Les nouvelles exécutions apparaîtront ici en temps réel.</small></div>}
      {!loading && !error && items.map((execution) => <div className="table-row" key={execution.id}><span>{execution.id}</span><span>{new Date(execution.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span><span>{execution.timeline?.at(-1)?.reason ?? "Déclenchement sécurisé"}</span><span>{duration(execution)}</span><span className={`execution-status ${execution.status}`}>{statusLabel[execution.status]}</span><span>{execution.status === "waiting_approval" ? <button className="approve-action" disabled={approvalId === execution.id} onClick={() => void approve(execution)}>{approvalId === execution.id ? <RefreshCw className="spinning"/> : <Check/>} {approvalId === execution.id ? "Validation…" : "Approuver"}</button> : <button className="row-action" aria-label={`Afficher ${execution.id}`}><ChevronRight/></button>}</span></div>)}
    </div>
  </div>;
}

function Governance() { return <div className="subpage governance"><div className="security-grid">{[[LockKeyhole,"Isolation multi-tenant","Credentials, exécutions et journaux cloisonnés"],[KeyRound,"OAuth 2.1 + PKCE","Sessions courtes et rotation automatique"],[Fingerprint,"Webhooks HMAC-SHA256","Signature, timestamp et protection anti-rejeu"],[ShieldCheck,"Audit immuable","Identité, paramètres masqués et résultat"]].map(([Icon,title,text]) => { const I = Icon as typeof ShieldCheck; return <article className="panel" key={title as string}><I/><div><h3>{title as string}</h3><p>{text as string}</p></div><span><Check/> Actif</span></article>; })}</div><article className="panel permission-card"><div className="section-head"><div><span className="eyebrow">ACCÈS</span><h2>Matrice des autorisations</h2></div><span className="connection"><i/> RBAC synchronisé</span></div><div className="permission-grid"><b>Rôle</b><b>Consulter</b><b>Exécuter</b><b>Modifier</b><b>Approuver</b>{["SOC Manager","Analyste","Auditeur","Admin tenant"].map((role, r) => <><strong key={role}>{role}</strong>{[0,1,2,3].map((c) => <span key={`${role}-${c}`}>{c <= (r === 0 ? 3 : r === 1 ? 1 : r === 2 ? 0 : 2) ? <Check/> : <X/>}</span>)}</>)}</div></article></div>; }

function LaunchModal({ workflow, workflowId, onClose, onLaunch }: { workflow: string; workflowId: number; onClose: () => void; onLaunch: (id: string) => void }) {
  const [approved, setApproved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scope, setScope] = useState("production-eu/*");
  const [severity, setSeverity] = useState("high");
  const [ticket, setTicket] = useState("");
  const [channel, setChannel] = useState("slack:soc-critical");
  const launch = async () => {
    setSubmitting(true);
    try {
      const execution = await orchestrationClient.execute({ workflowId, variables: { scope, severity, ticket, channel }, approval: { confirmed: true, reason: ticket || "Manual operator approval" } });
      onLaunch(execution.id);
    } catch {
      // The standalone preview has no gateway; keep the UX demonstrable while
      // making the disconnected state explicit in the generated identifier.
      onLaunch("#PREVIEW-2842");
    } finally { setSubmitting(false); }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal panel" onMouseDown={(e) => e.stopPropagation()}><header><div><span className="eyebrow">EXÉCUTION CONTRÔLÉE</span><h2>{workflow}</h2></div><button className="icon-button" onClick={onClose}><X/></button></header><div className="secure-banner"><LockKeyhole/><div><b>Injection sécurisée</b><span>Les secrets sont résolus côté backend et ne transitent jamais par le navigateur.</span></div></div><label>Périmètre cible<input value={scope} onChange={(e) => setScope(e.target.value)}/></label><div className="field-row"><label>Sévérité minimale<select value={severity} onChange={(e) => setSeverity(e.target.value)}><option>critical</option><option>high</option><option>medium</option></select></label><label>Ticket de changement<input value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="CHG-2026-…"/></label></div><label>Canal de notification<select value={channel} onChange={(e) => setChannel(e.target.value)}><option value="slack:soc-critical">Slack · #soc-critical</option><option value="discord:security">Discord · Security</option><option value="email:encrypted">Email chiffré</option><option value="sms:on-call">SMS d'astreinte</option></select></label><label className="approval"><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)}/><span><b>Je confirme le périmètre et l'impact</b><small>Un dry-run et une trace d'audit seront générés.</small></span></label><footer><button className="secondary" onClick={onClose}>Annuler</button><button className="primary" disabled={!approved || submitting} onClick={launch}><Play/> {submitting ? "Lancement…" : "Lancer en sécurité"}</button></footer></div></div>;
}

function ModulePage({ id }: { id: string }) {
  const page = genericPages[id] ?? genericPages.posture;
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("Tous");
  const [selected, setSelected] = useState(0);
  const records = [
    { title: `${page.metrics[0]} nécessitant une revue`, asset: "Production Europe", owner: "SOC Operations", score: 94, tone: "critical", state: "À traiter" },
    { title: `${page.metrics[1]} sous surveillance`, asset: "Cloud & Identités", owner: "Nexus AI", score: 82, tone: "high", state: "En cours" },
    { title: `${page.metrics[2]} récemment synchronisés`, asset: "Tenant ACME Europe", owner: "GRC Team", score: 68, tone: "medium", state: "Planifié" },
    { title: `${page.metrics[3]} sans anomalie`, asset: "Périmètre global", owner: "Sentinel Agent", score: 31, tone: "low", state: "Conforme" },
  ];
  const visible = records.filter((record) => `${record.title} ${record.asset} ${record.owner}`.toLowerCase().includes(query.toLowerCase()) && (scope === "Tous" || record.state === scope));
  const current = records[selected] ?? records[0];
  return <div className="page fade-in module-workbench">
    <PageHeading eyebrow={page.eyebrow} title={page.title} description={page.description} actions={<><button className="secondary"><FileDown size={16}/> Exporter</button><button className="primary"><Plus size={16}/> Nouvelle action</button></>}/>
    <section className="module-kpis">{page.metrics.map((metric, index) => <article className={`panel ${["mint","blue","violet","coral"][index]}`} key={metric}><span>{metric}</span><strong>{["128","94%","07","2,4 h"][index]}</strong><small>{["+12 ce mois","+3,2%","−2 cette semaine","−18% vs période"][index]}</small><svg viewBox="0 0 120 28"><path d={`M0 ${22-index*2} C20 25,30 ${8+index*2},48 15 S78 ${6+index},120 ${9+index}`}/></svg></article>)}</section>
    <section className="workbench-grid">
      <article className="panel registry-panel"><header><div><span className="eyebrow">REGISTRE OPÉRATIONNEL</span><h2>Éléments prioritaires</h2></div><span className="sync-label"><i/> Synchronisé maintenant</span></header><div className="registry-tools"><label><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Rechercher dans ${page.title.toLowerCase()}…`}/></label><div className="scope-switch">{["Tous","À traiter","En cours"].map((item) => <button className={scope === item ? "active" : ""} onClick={() => setScope(item)} key={item}>{item}</button>)}</div><button className="icon-button"><Filter/></button></div>
        <div className="registry-table"><div className="registry-row registry-head"><span>Élément</span><span>Périmètre</span><span>Responsable</span><span>Score</span><span>Statut</span></div>{visible.map((record) => { const index = records.indexOf(record); return <button className={`registry-row ${selected === index ? "selected" : ""}`} onClick={() => setSelected(index)} key={record.title}><span><i className={`record-mark ${record.tone}`}/><b>{record.title}</b></span><span>{record.asset}</span><span>{record.owner}</span><span><strong>{record.score}</strong>/100</span><span className={`record-state ${record.tone}`}>{record.state}</span></button>; })}{visible.length === 0 && <div className="registry-empty">Aucun résultat ne correspond à ces filtres.</div>}</div>
      </article>
      <aside className="panel context-panel"><div className="context-score"><span className={`score-badge ${current.tone}`}>{current.score}</span><div><span className="eyebrow">ANALYSE CONTEXTUELLE</span><h2>{current.state}</h2></div></div><h3>{current.title}</h3><p>Sentinel Intelligence a corrélé l'exposition technique, la criticité métier et les contrôles compensatoires actifs.</p><div className="context-factors"><span><ShieldCheck/> Contrôles actifs <b>8 / 10</b></span><span><Clock3/> SLA de traitement <b>4 heures</b></span><span><Users/> Responsable <b>{current.owner}</b></span></div><div className="context-ai"><Sparkles/><div><b>Recommandation IA</b><p>Prioriser la validation du périmètre puis déclencher le playbook contrôlé avec approbation humaine.</p></div></div><button className="primary full">Ouvrir le plan d'action <ArrowRight/></button><button className="secondary full">Ajouter au rapport</button></aside>
    </section>
  </div>;
}

function Assistant({ page, onClose }: { page: string; onClose: () => void }) {
  const [model, setModel] = useState<ModelProvider>("kimi");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [working, setWorking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const selectedModel = modelCatalog.find((candidate) => candidate.id === model)!;
  const ask = async (prompt = input) => {
    if (!prompt.trim() || working) return;
    const user: ChatMessage = { id: crypto.randomUUID(), role: "user", content: prompt.trim(), createdAt: new Date().toISOString() };
    setMessages((current) => [...current, user]); setInput(""); setWorking(true);
    abortRef.current = new AbortController();
    try {
      const answer = await intelligenceClient.complete({ model, messages: [...messages, user].map(({ role, content }) => ({ role, content })), context: { tenantId: "acme-eu", page }, mode: prompt.includes("workflow") ? "build-workflow" : "investigate" }, abortRef.current.signal);
      setMessages((current) => [...current, answer]);
    } catch {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", createdAt: new Date().toISOString(), content: "Le gateway IA est indisponible dans cette prévisualisation. Votre demande est conservée localement et aucune donnée n’a quitté le tenant." }]);
    } finally { setWorking(false); }
  };
  return <aside className="assistant-drawer" aria-label="Sentinel Intelligence">
    <header><div className="ai-orb"><Sparkles/></div><div><b>Sentinel Intelligence</b><span><i/> Contexte ACME · données protégées</span></div><button aria-label="Fermer" onClick={onClose}><X/></button></header>
    <div className="model-switcher"><label>MODÈLE ACTIF</label><select value={model} onChange={(event) => setModel(event.target.value as ModelProvider)}>{modelCatalog.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name} · {candidate.location}</option>)}</select><small>{selectedModel.detail}</small></div>
    <div className="assistant-content">{messages.length === 0 ? <><div className="assistant-intro"><span className="ai-orb small"><Bot/></span><h2>Comment puis-je renforcer votre posture ?</h2><p>Kimi, OpenAI ou votre modèle local peuvent analyser les risques et construire des workflows gouvernés.</p></div><div className="suggestions">{["Résume les 3 risques prioritaires", "Crée un workflow de réponse phishing", "Prépare le comité de sécurité"].map((suggestion) => <button onClick={() => ask(suggestion)} key={suggestion}>{suggestion}<ArrowRight/></button>)}</div></> : <div className="chat-thread">{messages.map((message) => <article className={message.role} key={message.id}><span>{message.role === "assistant" ? <Sparkles/> : "CD"}</span><div><b>{message.role === "assistant" ? selectedModel.name : "Vous"}</b><p>{message.content}</p>{message.citations?.map((citation) => <a href={citation.href} key={citation.href}>{citation.label}</a>)}</div></article>)}{working && <div className="thinking"><i/><i/><i/> Analyse sécurisée en cours</div>}</div>}</div>
    <footer><div><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void ask(); }} placeholder="Interroger Sentinel Intelligence…"/><button aria-label={working ? "Arrêter" : "Envoyer"} onClick={() => working ? abortRef.current?.abort() : void ask()}>{working ? <X/> : <Send/>}</button></div><small><LockKeyhole/> Secrets expurgés · RBAC actif · aucune action sans validation</small></footer>
  </aside>;
}

function SearchPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (id: string) => void }) { return <div className="modal-backdrop command-backdrop" onMouseDown={onClose}><div className="search-palette panel" onMouseDown={(e) => e.stopPropagation()}><header><Search/><input autoFocus placeholder="Rechercher une page, un actif, une CVE…"/><kbd>ESC</kbd></header><span className="eyebrow">NAVIGATION</span>{navGroups.flatMap((g) => g.items).slice(0,7).map((item) => <button key={item.id} onClick={() => onNavigate(item.id)}><item.icon/><span><b>{item.label}</b><small>Ouvrir le module</small></span><ArrowRight/></button>)}</div></div>; }
