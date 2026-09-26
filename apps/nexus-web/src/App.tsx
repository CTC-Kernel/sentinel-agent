import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowRight, Bell, Bot, Check, ChevronDown, ChevronRight, Circle,
  Clock3, FileDown, Filter, Fingerprint, KeyRound, LockKeyhole, Menu, Play,
  Plus, RefreshCw, Search, Send, Shield, ShieldCheck, Sparkles, Users, Workflow, X,
  Zap, Crosshair, Eye, Globe2, Radio, Radar, ScanLine, TriangleAlert,
  Moon, Sun, Mic, MicOff, Volume2, VolumeX, Cpu, Brain, Compass, Store, AlertTriangle, Layers,
  ShieldAlert, Server, HardDrive, Terminal, CheckCircle2, AlertOctagon, SlidersHorizontal, Bug,
  Cloud, Laptop, FileText, Download, TrendingUp, Scale, Boxes,
} from "lucide-react";
import { compliance, genericPages, incidents, kpis, navGroups, templates, workflows } from "./data";
import { orchestrationClient, type Execution } from "./services/orchestration";
import { intelligenceClient, modelCatalog, type ChatMessage, type ModelProvider, type ProposedAction } from "./services/ai";

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
        {page === "dashboard" ? <Dashboard onNavigate={setPage} notify={notify}/> :
         page === "threats" ? <ThreatCenter notify={notify}/> :
         page === "ai" ? <AICommandCenter notify={notify} onNavigate={setPage} onOpenAssistant={() => setAssistantOpen(true)}/> :
         page === "vulnerabilities" ? <VulnerabilityHub notify={notify} onOpenAssistant={() => setAssistantOpen(true)}/> :
         page === "compliance" ? <ComplianceHub notify={notify}/> :
         page === "posture" ? <PostureHub notify={notify} onNavigate={setPage}/> :
         page === "network" ? <NetworkHub notify={notify}/> :
         page === "risks" ? <RiskRegistryHub notify={notify} onOpenAssistant={() => setAssistantOpen(true)}/> :
         page === "reports" ? <ReportsHub notify={notify}/> :
         page === "assets" ? <AssetInventoryHub notify={notify} onNavigate={setPage}/> :
         <ModulePage id={page}/>}
      </main>
    </div>
    <button className="ai-fab" onClick={() => setAssistantOpen(true)}><Sparkles size={20}/><span>Sentinel Intelligence</span></button>
    {assistantOpen && <Assistant page={page} onClose={() => setAssistantOpen(false)} notify={notify} />}
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
  const [selectedSignal, setSelectedSignal] = useState(0);
  const signals = [
    { label: "Mouvement latéral", source: "FIN-WS-042 → DC-EU-02", time: "Il y a 3 min", tone: "critical", score: "98", ip: "185.220.101.17", origin: "Francfort, DE", tactic: "TA0008 · Lateral Movement" },
    { label: "Exfiltration DNS probable", source: "Kubernetes / payments-prod", time: "Il y a 11 min", tone: "high", score: "86", ip: "45.155.205.233", origin: "Amsterdam, NL", tactic: "TA0010 · Exfiltration" },
    { label: "Authentification impossible", source: "IAM-PROD / user-1842", time: "Il y a 27 min", tone: "medium", score: "72", ip: "91.214.124.18", origin: "Varsovie, PL", tactic: "TA0006 · Credential Access" },
  ];
  const selected = signals[selectedSignal];
  return <div className="page threat-page fade-in">
    <PageHeading eyebrow="SOC / THREAT INTELLIGENCE" title="Centre de détection" description="Une lecture temps réel de votre surface d'attaque, enrichie et priorisée par Sentinel Intelligence." actions={<><button className="secondary"><Filter size={16}/> Filtres avancés</button><button className="primary" onClick={() => notify("Chasse aux menaces lancée")}><Crosshair size={16}/> Nouvelle investigation</button></>}/>
    <section className="threat-command panel">
      <div className="radar-stage" aria-label="Radar de menaces en temps réel">
        <div className="radar-hud" aria-hidden="true"><span>SONAR / EU-WEST</span><span>RAYON 360°</span><span>LATENCE 12 MS</span></div>
        <div className="radar-grid">
          <i className="radar-sweep"/><i className="radar-core"/><i className="radar-crosshair"/>
          <span aria-hidden="true" className="radar-sector sector-n">N</span><span aria-hidden="true" className="radar-sector sector-e">E</span><span aria-hidden="true" className="radar-sector sector-s">S</span><span aria-hidden="true" className="radar-sector sector-w">W</span>
          <span aria-hidden="true" className="blip b1 ambient"><i/></span>
          {signals.map((signal, index) => <button aria-label={`${signal.label}, score ${signal.score}`} aria-pressed={selectedSignal === index} className={`blip threat-contact contact-${index + 1} ${signal.tone} ${selectedSignal === index ? "selected" : ""}`} key={signal.label} onClick={() => setSelectedSignal(index)}><i/></button>)}
          <span aria-hidden="true" className="blip b3 ambient"><i/></span><span aria-hidden="true" className="blip b4 warning ambient"><i/></span>
          <span className="radar-axis horizontal"/><span className="radar-axis vertical"/>
        </div>
        <div className={`radar-target ${selected.tone}`}><div><span>CIBLE CORRÉLÉE</span><b>{selected.ip}</b></div><strong>{selected.score}</strong><small>{selected.origin}<br/>{selected.tactic}</small></div>
        <div className="radar-status"><span><i/> SURVEILLANCE ACTIVE</span><strong>2 847</strong><small>événements analysés / min</small></div>
        <div className="radar-legend"><span><i className="safe"/> Normal <b>1 246</b></span><span><i className="warning"/> Suspect <b>18</b></span><span><i className="danger"/> Critique <b>03</b></span></div>
      </div>
      <div className="threat-overview">
        <header><div><span className="eyebrow">SIGNAL DE MENACE GLOBAL</span><h2>Pression adversaire <em>élevée</em></h2></div><div className="time-switch">{["1 h","24 h","7 j"].map((item) => <button className={window === item ? "active" : ""} onClick={() => setWindow(item)} key={item}>{item}</button>)}</div></header>
        <p>Une campagne coordonnée cible vos identités privilégiées depuis 3 infrastructures récemment observées. Les contrôles compensatoires restent efficaces.</p>
        <div className="threat-metrics"><article><TriangleAlert/><span>Alertes corrélées</span><strong>07</strong><small>+3 sur {window}</small></article><article><Eye/><span>IOC surveillés</span><strong>1 284</strong><small>42 nouveaux</small></article><article><ScanLine/><span>Couverture MITRE</span><strong>84%</strong><small>11 tactiques</small></article></div>
        <div className="ai-brief"><Sparkles/><div><b>Brief Sentinel Intelligence</b><p>Priorité recommandée : isoler FIN-WS-042 puis révoquer ses jetons actifs. Confiance de l'analyse : <strong>94%</strong>.</p></div><button onClick={() => notify("Plan de confinement préparé")}>Préparer la réponse <ArrowRight/></button></div>
      </div>
    </section>
    <section className="threat-lower">
      <article className="panel signal-feed"><div className="section-head"><div><span className="eyebrow">LIVE FEED</span><h2>Signaux prioritaires</h2></div><button>Voir la timeline <ArrowRight size={15}/></button></div>{signals.map((signal, index) => <button aria-pressed={selectedSignal === index} className={`signal-row ${selectedSignal === index ? "selected" : ""}`} key={signal.label} onClick={() => setSelectedSignal(index)}><span className={`signal-score ${signal.tone}`}>{signal.score}</span><span><b>{signal.label}</b><small>{signal.source}</small></span><span><Radio/> {signal.time}</span><ChevronRight/></button>)}</article>
      <article className="panel intel-card"><div className="section-head"><div><span className="eyebrow">INTELLIGENCE</span><h2>Origine des signaux</h2></div><Globe2/></div><div className="source-map"><span className="source-point p1"/><span className="source-point p2"/><span className="source-point p3"/><svg viewBox="0 0 400 140" preserveAspectRatio="none"><path d="M30 105 C110 20 235 125 370 35"/><path d="M55 40 C170 110 245 10 345 92"/></svg></div><div className="intel-sources"><span><b>31%</b> Identités</span><span><b>28%</b> Endpoints</span><span><b>24%</b> Cloud</span><span><b>17%</b> Réseau</span></div></article>
    </section>
  </div>;
}

function Orchestration({ notify }: { notify: (s: string) => void }) {
  const [tab, setTab] = useState("overview");
  const [selected, setSelected] = useState(workflows[0]);
  const [launchOpen, setLaunchOpen] = useState(false);
  const tabs = [
    { id: "overview", label: "Vue d'ensemble", icon: Compass, badge: undefined },
    { id: "workflows", label: "Workflows", icon: Workflow, badge: "12" },
    { id: "marketplace", label: "Marketplace", icon: Store, badge: "8" },
    { id: "exécutions", label: "Exécutions", icon: Activity, badge: "Live" },
    { id: "gouvernance", label: "Gouvernance", icon: ShieldCheck, badge: "100%" },
  ];
  return <div className="page fade-in orchestration-page">
    <PageHeading eyebrow="NEXUS AUTOMATION CLOUD" title="Orchestration" description="Concevez, gouvernez et exécutez votre défense automatisée." actions={<><span className="connection"><i/> n8n connecté</span><button className="secondary"><KeyRound size={16}/> Connecteurs</button><button className="primary" onClick={() => notify("Nouveau workflow initialisé")}><Plus size={16}/> Nouveau workflow</button></>}/>
    <div className="tabs-segmented">{tabs.map((item) => <button className={`tab-pill ${tab === item.id ? "active" : ""}`} key={item.id} onClick={() => setTab(item.id)}><item.icon size={15}/><span>{item.label}</span>{item.badge && <em className="tab-badge">{item.badge}</em>}</button>)}</div>
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

function VulnerabilityHub({ notify, onOpenAssistant }: { notify: (s: string) => void; onOpenAssistant: () => void }) {
  const [filter, setFilter] = useState<"all" | "critical" | "kev" | "sla">("all");
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const cves = [
    {
      id: "CVE-2024-38077",
      title: "Windows Remote Desktop Licensing Service RCE",
      asset: "DC-EU-02 · Windows Server 2022",
      owner: "SecOps / Infrastructure",
      cvss: 9.8,
      epss: "96.4%",
      kev: true,
      slaRemaining: "4 heures restantes",
      slaStatus: "urgent",
      vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      patchStatus: "Patch KB5040437 Disponible",
      description: "Vulnérabilité d'exécution de code à distance non authentifiée dans le service de licences du Bureau à distance.",
      mitigation: "Désactiver le service RDLicsvc s'il n'est pas requis, ou appliquer immédiatement le correctif cumulatif KB5040437.",
    },
    {
      id: "CVE-2024-21413",
      title: "Microsoft Outlook Moniker Remote Code Execution (Checkm8)",
      asset: "FIN-WS-042 · Windows 11 Enterprise",
      owner: "Workplace Security",
      cvss: 9.8,
      epss: "97.1%",
      kev: true,
      slaRemaining: "DÉPASSÉ (12h)",
      slaStatus: "overdue",
      vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      patchStatus: "En attente redémarrage",
      description: "Contournement de la vue protégée d'Office permettant l'exécution arbitraire lors de la prévisualisation d'un email.",
      mitigation: "Déployer la mise à jour Office 365 version 2402 et activer le blocage des liens NTLM sortants.",
    },
    {
      id: "CVE-2024-6387",
      title: "OpenSSH Server RegreSSHion RCE (glibc race condition)",
      asset: "bastion-gw-01 · Debian 12 Bookworm",
      owner: "Platform Engineering",
      cvss: 8.1,
      epss: "88.2%",
      kev: false,
      slaRemaining: "3 jours restants",
      slaStatus: "normal",
      vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
      patchStatus: "Mise à jour OpenSSH 9.8p1 prête",
      description: "Condition de concurrence dans le gestionnaire de signaux SIGALRM d'sshd permettant une exécution de code avec privilèges root.",
      mitigation: "Mettre à jour openssh-server vers la version 9.8p1-1 ou configurer LoginGraceTime 0 en mesure d'attente.",
    },
    {
      id: "CVE-2023-44487",
      title: "HTTP/2 Rapid Reset Attack (Distributed Denial of Service)",
      asset: "edge-proxy-03 · Envoy / Kubernetes Ingress",
      owner: "SRE / Cloud Network",
      cvss: 7.5,
      epss: "92.1%",
      kev: true,
      slaRemaining: "Conforme",
      slaStatus: "normal",
      vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H",
      patchStatus: "Mitigé WAF / Rate Limiter",
      description: "Abus de la trame RST_STREAM permettant de submerger les serveurs HTTP/2 par annulation continue de requêtes.",
      mitigation: "Activer la limitation de requêtes concurrentes et appliquer les patches Envoy/Nginx 1.25.3.",
    },
  ];

  const filtered = cves.filter((item) => {
    const matchesFilter =
      filter === "all" ? true :
      filter === "critical" ? item.cvss >= 9.0 :
      filter === "kev" ? item.kev :
      filter === "sla" ? item.slaStatus === "overdue" || item.slaStatus === "urgent" : true;
    const matchesQuery = `${item.id} ${item.title} ${item.asset}`.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const current = filtered[selectedIdx] ?? filtered[0] ?? cves[0];

  return (
    <div className="page fade-in">
      <PageHeading
        eyebrow="EXPOSITION & VULNÉRABILITÉS CVE"
        title="Centre de Gestion des Vulnérabilités"
        description="Priorisation basée sur l'exploitabilité réelle (EPSS), la présence au catalogue CISA KEV et l'impact métier ACME."
        actions={
          <>
            <button className="secondary" onClick={() => notify("Rapport d'exposition exporté")}>
              <FileDown size={16} /> Exporter CSV
            </button>
            <button className="primary" onClick={() => notify("Scan rapide des 148 actifs déclenché")}>
              <RefreshCw size={16} /> Lancer un scan CVE
            </button>
          </>
        }
      />

      <section className="module-kpis">
        <article className="panel coral">
          <span>Critiques (CVSS ≥ 9.0)</span>
          <strong>12</strong>
          <small>SLA max 48h</small>
        </article>
        <article className="panel coral">
          <span>Exploit Actif (CISA KEV)</span>
          <strong>04</strong>
          <small>Priorité absolue</small>
        </article>
        <article className="panel violet">
          <span>SLA Dépassé</span>
          <strong>02</strong>
          <small>Alerte RSSI envoyée</small>
        </article>
        <article className="panel mint">
          <span>Corrigées ce mois</span>
          <strong>48</strong>
          <small>+24% vs mois dernier</small>
        </article>
      </section>

      <section className="workbench-grid">
        <article className="panel registry-panel">
          <header>
            <div>
              <span className="eyebrow">REGISTRE DES VULNÉRABILITÉS</span>
              <h2>Vulnérabilités Prioritaires</h2>
            </div>
            <span className="sync-label"><i /> Base NVD + EPSS à jour</span>
          </header>

          <div className="registry-tools">
            <label>
              <Search />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher CVE, actif, logiciel…"
              />
            </label>
            <div className="scope-switch">
              {[
                { id: "all", label: "Toutes" },
                { id: "critical", label: "Critiques" },
                { id: "kev", label: "Armées (KEV)" },
                { id: "sla", label: "SLA Dépassé" },
              ].map((item) => (
                <button
                  key={item.id}
                  className={filter === item.id ? "active" : ""}
                  onClick={() => { setFilter(item.id as any); setSelectedIdx(0); }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="registry-table">
            <div className="registry-row registry-head">
              <span>CVE / Titre</span>
              <span>Actif Affecté</span>
              <span>Score CVSS</span>
              <span>Exploitabilité EPSS</span>
              <span>SLA Remédiation</span>
            </div>
            {filtered.map((item, idx) => (
              <button
                key={item.id}
                className={`registry-row ${selectedIdx === idx ? "selected" : ""}`}
                onClick={() => setSelectedIdx(idx)}
              >
                <span>
                  <b className="cve-pill" style={{ marginRight: 6 }}>{item.id}</b>
                  {item.kev && <span className="kev-tag" style={{ marginRight: 6 }}>KEV</span>}
                  <b>{item.title}</b>
                </span>
                <span>{item.asset}</span>
                <span>
                  <strong className={`score-badge ${item.cvss >= 9 ? "critical" : item.cvss >= 7 ? "high" : "medium"}`}>
                    {item.cvss}
                  </strong>
                </span>
                <span>
                  <span className={`epss-badge ${parseFloat(item.epss) > 90 ? "" : "low"}`}>
                    ⚡ {item.epss}
                  </span>
                </span>
                <span className={`record-state ${item.slaStatus === "overdue" ? "critical" : item.slaStatus === "urgent" ? "high" : "mint"}`}>
                  {item.slaRemaining}
                </span>
              </button>
            ))}
          </div>
        </article>

        <aside className="panel context-panel">
          <div className="context-score">
            <span className={`score-badge ${current.cvss >= 9 ? "critical" : "high"}`}>
              {current.cvss}
            </span>
            <div>
              <span className="eyebrow">ANALYSE CONTEXTUELLE DE MENACE</span>
              <h2>{current.id}</h2>
            </div>
          </div>

          <h3>{current.title}</h3>
          <p>{current.description}</p>

          <div className="context-factors">
            <span><Server size={14} /> Actif : <b>{current.asset}</b></span>
            <span><Clock3 size={14} /> Échéance : <b>{current.slaRemaining}</b></span>
            <span><Users size={14} /> Équipe en charge : <b>{current.owner}</b></span>
          </div>

          <div className="context-ai">
            <Sparkles />
            <div>
              <b>Recommandation Sentinel Intelligence</b>
              <p>{current.mitigation}</p>
            </div>
          </div>

          <button
            className="primary full"
            onClick={() => notify(`Playbook autonome de patch lancé pour ${current.id}`)}
          >
            <Play size={14} /> Appliquer le Correctif ({current.patchStatus})
          </button>
          <button
            className="secondary full"
            onClick={onOpenAssistant}
          >
            <Bot size={14} /> Interroger le Copilote IA sur ce CVE
          </button>
        </aside>
      </section>
    </div>
  );
}

function ComplianceHub({ notify }: { notify: (s: string) => void }) {
  const [standard, setStandard] = useState<"nis2" | "dora" | "iso27001" | "rgpd" | "soc2">("soc2");

  const frameworks = {
    soc2: {
      title: "SOC 2 Type II (Trust Services Criteria)",
      score: "98%",
      badge: "AICPA TSC 2022 · Audit Ready",
      controlsCount: "28 / 28",
      description: "Contrôles Trust Services Criteria : Sécurité (CC6, CC7, CC8), Disponibilité (A1) et Confidentialité (C1) continuellement évalués.",
      items: [
        { code: "CC6.1", title: "Contrôle des accès logiques, MFA obligatoire et sessions sécurisées", state: "Conforme", score: 100, proof: "MFA-FIDO2-Enforced", tone: "mint" },
        { code: "CC6.6", title: "Protection du périmètre, pare-feu hôte actif et ports distants restreints", state: "Conforme", score: 98, proof: "Firewall-ZeroTrust-State", tone: "mint" },
        { code: "CC6.7", title: "Chiffrement des données en transit, TLS 1.3 et durcissement SSH", state: "Conforme", score: 100, proof: "TLS13-Harden-SSH-OK", tone: "mint" },
        { code: "CC6.8", title: "Protection contre les logiciels malveillants, EDR en temps réel et intégrité", state: "Conforme", score: 99, proof: "EDR-Realtime-Telemetry", tone: "mint" },
        { code: "CC7.1", title: "Gestion continue des vulnérabilités et correctifs de sécurité critiques", state: "Conforme", score: 95, proof: "Patch-Cycle-48h", tone: "mint" },
        { code: "CC7.2", title: "Journalisation d'audit centralisée, horodatage NTP et rétention", state: "Conforme", score: 100, proof: "AuditTrail-WORM-SHA256", tone: "mint" },
        { code: "CC8.1", title: "Durcissement du système hôte et gestion des changements de configuration", state: "Conforme", score: 96, proof: "Baseline-Hardening-Kernel", tone: "mint" },
        { code: "A1.2", title: "Disponibilité des données, sauvegardes régulières et vérification d'intégrité", state: "Conforme", score: 95, proof: "Backup-Integrity-Verified", tone: "mint" },
        { code: "C1.1", title: "Confidentialité et chiffrement matériel intégral des disques au repos (AES-256)", state: "Conforme", score: 100, proof: "FileVault-BitLocker-Active", tone: "mint" },
      ],
    },
    nis2: {
      title: "Directive Européenne NIS 2",
      score: "76%",
      badge: "Entités Essentielles & Importantes",
      controlsCount: "38 / 50",
      description: "Obligations de cybersécurité renforcées, gestion des incidents sous 24h et gouvernance de la chaîne de valeur.",
      items: [
        { code: "Art. 21.2.a", title: "Politique de sécurité des systèmes d'information & analyse de risques", state: "Conforme", score: 100, proof: "Doc-SEC-2026-v3", tone: "mint" },
        { code: "Art. 21.2.b", title: "Traitement et notification des incidents majeurs", state: "Conforme", score: 94, proof: "SOAR-Incident-P1", tone: "mint" },
        { code: "Art. 21.2.d", title: "Sécurité de la chaîne d'approvisionnement et relations avec les tiers", state: "À traiter", score: 62, proof: "Audit-Fournisseurs-2026", tone: "critical" },
        { code: "Art. 21.2.e", title: "Gestion et divulgation coordonnée des vulnérabilités CVE", state: "Conforme", score: 96, proof: "Qualys-Sentinel-Sync", tone: "mint" },
        { code: "Art. 21.2.f", title: "Évaluation de l'efficacité des mesures de gestion des risques", state: "En cours", score: 78, proof: "Audit-Interne-Q1", tone: "high" },
        { code: "Art. 23", title: "Notification d'alerte précoce ANSSI sous 24 heures", state: "Conforme", score: 100, proof: "Template-ANSSI-v2", tone: "mint" },
      ],
    },
    dora: {
      title: "Règlement DORA (Résilience Opérationnelle Numérique)",
      score: "91%",
      badge: "Secteur Financier & Assurances",
      controlsCount: "41 / 45",
      description: "Résilience opérationnelle, tests de pénétration TLPT basés sur la menace et surveillance des prestataires TIC tiers.",
      items: [
        { code: "Art. 6", title: "Cadre de gestion des risques liés aux TIC et gouvernance", state: "Conforme", score: 95, proof: "GRC-DORA-Policy", tone: "mint" },
        { code: "Art. 11", title: "Plan de continuité des activités et stratégies de repli", state: "Conforme", score: 92, proof: "PCA-DRP-Test-2026", tone: "mint" },
        { code: "Art. 19", title: "Notification des incidents majeurs liés aux TIC aux autorités", state: "Conforme", score: 98, proof: "SLA-4h-Reporting", tone: "mint" },
        { code: "Art. 26", title: "Tests avancés de résilience basés sur la menace (TLPT)", state: "En cours", score: 84, proof: "RedTeam-Q2-Schedule", tone: "high" },
        { code: "Art. 28", title: "Gestion et registre complet des prestataires tiers de services TIC", state: "Conforme", score: 90, proof: "Vendor-Registry-Live", tone: "mint" },
      ],
    },
    iso27001: {
      title: "ISO/IEC 27001:2022 (SMSI)",
      score: "87%",
      badge: "Norme Internationale de Management",
      controlsCount: "81 / 93",
      description: "Système de management de la sécurité de l'information avec les 93 contrôles de l'Annexe A révisée.",
      items: [
        { code: "A.5.15", title: "Contrôle d'accès et politiques Zero-Trust", state: "Conforme", score: 96, proof: "IAM-MFA-Enforced", tone: "mint" },
        { code: "A.8.7", title: "Protection contre les logiciels malveillants (EDR)", state: "Conforme", score: 99, proof: "EDR-Fleet-99.4%", tone: "mint" },
        { code: "A.8.8", title: "Gestion des vulnérabilités techniques", state: "En cours", score: 81, proof: "Patch-Cycle-BiWeekly", tone: "high" },
        { code: "A.8.20", title: "Sécurité des réseaux et cloisonnement", state: "Conforme", score: 94, proof: "VPC-Segmentation-PaloAlto", tone: "mint" },
        { code: "A.8.24", title: "Utilisation de la cryptographie et gestion des clés", state: "Conforme", score: 100, proof: "HSM-KMS-Envelope", tone: "mint" },
      ],
    },
    rgpd: {
      title: "Règlement Général sur la Protection des Données (RGPD)",
      score: "94%",
      badge: "Conformité CNIL / EDPB",
      controlsCount: "47 / 50",
      description: "Protection des données à caractère personnel, registre des traitements (Art. 30) et notification de violation sous 72h.",
      items: [
        { code: "Art. 30", title: "Registre des activités de traitement des données personnelles", state: "Conforme", score: 98, proof: "Registry-DPO-2026", tone: "mint" },
        { code: "Art. 32", title: "Sécurité du traitement et pseudonymisation / chiffrement", state: "Conforme", score: 95, proof: "AES-256-Encrypted", tone: "mint" },
        { code: "Art. 33", title: "Notification à la CNIL d'une violation de données sous 72h", state: "Conforme", score: 100, proof: "Incident-Workflow-72h", tone: "mint" },
        { code: "Art. 35", title: "Analyses d'impact relatives à la protection des données (AIPD)", state: "En cours", score: 82, proof: "AIPD-Cloud-Analytics", tone: "high" },
      ],
    },
  };

  const current = frameworks[standard];

  return (
    <div className="page fade-in">
      <PageHeading
        eyebrow="GRC / CONFORMITÉ CONTINUE"
        title="Audits & Résilience Réglementaire"
        description="Mesure continue de la conformité avec collecte automatisée de preuves cryptographiques SHA-256."
        actions={
          <>
            <button className="secondary" onClick={() => notify("Preuves cryptographiques SHA-256 exportées")}>
              <Fingerprint size={16} /> Exporter les Preuves
            </button>
            <button className="primary" onClick={() => notify(`Rapport d'audit ${standard.toUpperCase()} généré`)}>
              <FileDown size={16} /> Générer le Rapport Signé
            </button>
          </>
        }
      />

      <div className="tabs-segmented">
        {[
          { id: "soc2", label: "SOC 2 Type II", score: "98%" },
          { id: "nis2", label: "Directive NIS 2", score: "76%" },
          { id: "dora", label: "Règlement DORA", score: "91%" },
          { id: "iso27001", label: "ISO 27001:2022", score: "87%" },
          { id: "rgpd", label: "RGPD / Données", score: "94%" },
        ].map((item) => (
          <button
            key={item.id}
            className={`tab-pill ${standard === item.id ? "active" : ""}`}
            onClick={() => setStandard(item.id as any)}
          >
            <ShieldCheck size={14} />
            <span>{item.label}</span>
            <em className="tab-badge">{item.score}</em>
          </button>
        ))}
      </div>

      <section className="panel" style={{ padding: 22, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--mint)" }}>CADRE RÉGLEMENTAIRE SÉLECTIONNÉ</span>
            <h2 style={{ fontSize: 20, color: "#fff", margin: "4px 0" }}>{current.title}</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, maxWidth: 640 }}>{current.description}</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="ai-kpi-card" style={{ minWidth: 140 }}>
              <span>Score de Conformité</span>
              <strong style={{ color: "var(--mint)" }}>{current.score}</strong>
              <small>{current.controlsCount} validés</small>
            </div>
            <div className="ai-kpi-card" style={{ minWidth: 160 }}>
              <span>Statut d'Audit</span>
              <strong style={{ fontSize: 15 }}>Certifiable</strong>
              <small><CheckCircle2 size={11} /> 0 non-conformité majeure</small>
            </div>
          </div>
        </div>

        <div className="registry-table" style={{ marginTop: 20 }}>
          <div className="registry-row registry-head">
            <span>Article / Contrôle</span>
            <span>Exigence Réglementaire</span>
            <span>Preuve Cryptographique</span>
            <span>Conformité</span>
            <span>Statut</span>
          </div>
          {current.items.map((item) => (
            <div key={item.code} className="registry-row" style={{ cursor: "default" }}>
              <span><b className="cve-pill">{item.code}</b></span>
              <span><b>{item.title}</b></span>
              <span><small style={{ fontFamily: "monospace", color: "var(--mint)" }}>{item.proof}</small></span>
              <span><strong>{item.score}%</strong></span>
              <span className={`record-state ${item.tone}`}>{item.state}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PostureHub({ notify, onNavigate }: { notify: (s: string) => void; onNavigate: (page: string) => void }) {
  const pillars = [
    { title: "Identités & Accès (IAM)", score: 96, status: "Excellent", delta: "+2,1%", icon: KeyRound, desc: "MFA 100% imposé, 0 mot de passe faible, 4 comptes dormants sous surveillance.", tone: "mint" },
    { title: "Postes & Serveurs (Endpoints)", score: 91, status: "Résilient", delta: "+3,8%", icon: Server, desc: "EDR Sentinel actif sur 99,4% du parc, FileVault / BitLocker 100%, FIM opérationnel.", tone: "mint" },
    { title: "Infrastructure Cloud & DevOps", score: 89, status: "Conforme", delta: "+1,4%", icon: Globe2, desc: "Posture CSPM saine sur AWS et Azure, Terraform scanné en CI/CD, 0 bucket S3 public.", tone: "blue" },
    { title: "Données & Chiffrement", score: 92, status: "Protégé", delta: "+4,2%", icon: LockKeyhole, desc: "Chiffrement au repos AES-256 systématique, souveraineté européenne ACME garantie.", tone: "mint" },
  ];

  return (
    <div className="page fade-in">
      <PageHeading
        eyebrow="POSTURE SSI & MATURITÉ"
        title="Résilience Opérationnelle Globale"
        description="Évaluation en continu de vos 4 piliers de cyberdéfense avec benchmarking et trajectoire de remédiation."
        actions={
          <>
            <button className="secondary" onClick={() => notify("Rapport exécutif généré")}>
              <FileDown size={16} /> Rapport Comité SSI
            </button>
            <button className="primary" onClick={() => notify("Recalcul de posture en mémoire terminé")}>
              <Zap size={16} /> Recalculer le Score
            </button>
          </>
        }
      />

      <section className="hero-grid">
        <article className="posture-card panel glow-panel">
          <div className="card-top">
            <div>
              <span className="eyebrow">SCORE GLOBAL SENTINEL</span>
              <h2>Niveau de Résilience : <em>92 / 100</em></h2>
            </div>
            <span className="live-pill"><i /> CALCUL TEMPS RÉEL</span>
          </div>
          <div className="posture-body">
            <ScoreRing />
            <div className="posture-insight">
              <div className="ai-label"><Sparkles size={14} /> DIAGNOSTIC SOUVERAIN ACME</div>
              <p>
                Votre posture vous situe dans le <strong>top 5%</strong> des entreprises européennes de votre secteur.
                Le traitement des 4 comptes dormants permettra d'atteindre <strong>95 / 100</strong>.
              </p>
              <button onClick={() => onNavigate("threats")}>Voir les alertes prioritaires <ArrowRight size={15} /></button>
            </div>
          </div>
          <div className="posture-foot">
            <span><Check /> MFA Généralisé</span>
            <span><Check /> Zero Egress Cloud</span>
            <span><Check /> EDR 99,4%</span>
            <span><Check /> Sauvegardes Immuables</span>
          </div>
        </article>

        <article className="panel risk-card">
          <div className="card-top">
            <div>
              <span className="eyebrow">RECOMMANDATION STRATÉGIQUE</span>
              <h3>Gouvernance des Identités</h3>
            </div>
            <span className="severity high">ÉLEVÉ</span>
          </div>
          <p>
            4 comptes administrateurs inactifs depuis 90+ jours constituent la principale surface d'exposition résiduelle.
          </p>
          <div className="risk-meta">
            <span><Clock3 size={13} /> SLA : 4 heures</span>
            <span><Users size={13} /> Équipe : IAM Ops</span>
          </div>
          <button className="primary full" onClick={() => notify("Playbook de purge des sessions dormantes déclenché")}>
            Révoquer les 4 comptes <ArrowRight size={15} />
          </button>
        </article>
      </section>

      <div className="posture-pillar-grid">
        {pillars.map((p) => (
          <div className="pillar-card" key={p.title}>
            <div className="pillar-head">
              <b><p.icon size={16} color="#35e4b7" /> {p.title}</b>
              <span className={`model-tag sovereign`}>{p.score}%</span>
            </div>
            <div className="pillar-bar-track">
              <div className="pillar-bar-fill" style={{ width: `${p.score}%`, background: "var(--mint)" }} />
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>{p.desc}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              <span>Progression : <b style={{ color: "var(--mint)" }}>{p.delta}</b></span>
              <span className="record-state mint">{p.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NetworkHub({ notify }: { notify: (s: string) => void }) {
  const exposedServices = [
    { service: "Passerelle Principale HTTPS", host: "gateway-eu.acme.corp", port: 443, proto: "TCP (TLS 1.3)", status: "Sécurisé", waf: "WAF Cloudflare Actif", tone: "mint" },
    { service: "VPN d'Astreinte Ingénierie", host: "vpn-ops.acme.corp", port: 8443, proto: "TCP (mTLS FIDO2)", status: "Filtré", waf: "Restriction Géo-IP UE", tone: "mint" },
    { service: "Bastion d'Administration SSH", host: "bastion-01.internal", port: 22, proto: "TCP (Ed25519)", status: "Interne", waf: "MFA Forcé + Jump Host", tone: "mint" },
    { service: "API Partenaires B2B", host: "api.acme-partners.eu", port: 443, proto: "TCP (OAuth 2.1)", status: "Surveillé", waf: "Rate Limiter Actif", tone: "blue" },
  ];

  return (
    <div className="page fade-in">
      <PageHeading
        eyebrow="SURFACE D'ATTAQUE & EXPOSITION"
        title="Cartographie Réseau & Périmètre"
        description="Surveillance continue des ports ouverts, dérives de segmentation et sondes de détection de balises C2."
        actions={
          <>
            <button className="secondary" onClick={() => notify("Cartographie réseau exportée")}>
              <FileDown size={16} /> Exporter la Cartographie
            </button>
            <button className="primary" onClick={() => notify("Sonde C2 lancée sur tous les flux sortants")}>
              <Radar size={16} /> Sonder les Flux Réseau
            </button>
          </>
        }
      />

      <section className="module-kpis">
        <article className="panel mint">
          <span>Services Exposés</span>
          <strong>04</strong>
          <small>100% Chiffrés TLS 1.3</small>
        </article>
        <article className="panel mint">
          <span>Dérive de Segmentation</span>
          <strong>00</strong>
          <small>Zero-Trust vérifié</small>
        </article>
        <article className="panel coral">
          <span>Tentatives de Scan Bloquées</span>
          <strong>14 820</strong>
          <small>Dernières 24 heures</small>
        </article>
        <article className="panel blue">
          <span>Débit Global Sécurisé</span>
          <strong>42,8 Mb/s</strong>
          <small>Inspection temps réel</small>
        </article>
      </section>

      <section className="panel" style={{ padding: 22 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <span className="eyebrow">SERVICES EXTERNES ET INTERNES</span>
            <h2 style={{ fontSize: 18, color: "#fff" }}>Surveillance des Ingress & Points d'Entrée</h2>
          </div>
          <span className="sync-label"><i /> Surveillance Réseau Active</span>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {exposedServices.map((svc) => (
            <div key={svc.service} className="network-service-row">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="network-port-chip">:{svc.port}</span>
                <div>
                  <b style={{ color: "#fff", fontSize: 13, display: "block" }}>{svc.service}</b>
                  <small style={{ color: "var(--muted)", fontFamily: "monospace" }}>{svc.host} · {svc.proto}</small>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="tab-badge">{svc.waf}</span>
                <span className={`record-state ${svc.tone}`}>{svc.status}</span>
                <button
                  className="secondary"
                  style={{ height: 28, fontSize: 11, padding: "0 10px" }}
                  onClick={() => notify(`Vérification des flux appliquée sur ${svc.host}`)}
                >
                  Tester le filtrage
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RiskRegistryHub({ notify, onOpenAssistant }: { notify: (s: string) => void; onOpenAssistant: () => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const risks = [
    {
      id: "RSK-01",
      title: "Ransomware avec double extorsion & exfiltration",
      category: "Cybersécurité Opérationnelle",
      inherentScore: 20,
      residualScore: 8,
      financialImpact: "2,4 M€",
      likelihood: "Modérée (2/5)",
      impact: "Critique (4/5)",
      owner: "RSSI / SecOps",
      controls: "EDR Sentinel 99.4%, Sauvegardes immuables WORM, Segmentation réseau",
      actionPlan: "Raccourcir la fenêtre de rétention et tester la restauration à froid",
      status: "Sous contrôle",
      tone: "coral",
    },
    {
      id: "RSK-02",
      title: "Compromission de comptes administrateurs Cloud",
      category: "Identités & Accès",
      inherentScore: 18,
      residualScore: 6,
      financialImpact: "1,1 M€",
      likelihood: "Faible (1/5)",
      impact: "Catastrophique (5/5)",
      owner: "Lead Cloud Platform",
      controls: "MFA FIDO2 matériel forcé, Révocation sessions > 90j, Accès conditionnel",
      actionPlan: "Déployer la rotation automatique des tokens IAM par agent n8n",
      status: "Sous contrôle",
      tone: "mint",
    },
    {
      id: "RSK-03",
      title: "Attaque sur la chaîne d'approvisionnement (Supply Chain)",
      category: "Fournisseurs & Tiers",
      inherentScore: 16,
      residualScore: 10,
      financialImpact: "850 k€",
      likelihood: "Élevée (3/5)",
      impact: "Moyen (3/5)",
      owner: "DevSecOps",
      controls: "SBOM en continu, Scans des dépendances open source (OSV), Signatures Sigstore",
      actionPlan: "Imposer la signature cosign obligatoire sur tous les conteneurs de production",
      status: "Plan d'action en cours",
      tone: "violet",
    },
    {
      id: "RSK-04",
      title: "Fuite de données clients & Sanction RGPD / DORA",
      category: "Conformité Légale",
      inherentScore: 15,
      residualScore: 5,
      financialImpact: "1,8 M€",
      likelihood: "Faible (1/5)",
      impact: "Très Élevé (4/5)",
      owner: "DPO / Juridique",
      controls: "Chiffrement AES-256 au repos, Pseudonymisation, DLP actif sur passerelles",
      actionPlan: "Audit trimestriel des accès aux bases relationnelles sensibles",
      status: "Conforme",
      tone: "mint",
    },
  ];

  const current = risks[selectedIdx] ?? risks[0];

  return (
    <div className="page fade-in">
      <PageHeading
        eyebrow="GRC / REGISTRE DES RISQUES"
        title="Gestion & Quantification des Risques Cyber"
        description="Quantification financière (FAIR), appétence au risque et pilotage des plans de remédiation associés."
        actions={
          <>
            <button className="secondary" onClick={() => notify("Cartographie des risques exportée en Excel")}>
              <FileDown size={16} /> Exporter le Registre
            </button>
            <button className="primary" onClick={() => notify("Nouveau scénario de risque initialisé")}>
              <Plus size={16} /> Nouveau Scénario
            </button>
          </>
        }
      />

      <section className="module-kpis">
        <article className="panel coral">
          <span>Risques Critiques</span>
          <strong>03</strong>
          <small>Au-delà de l'appétence</small>
        </article>
        <article className="panel violet">
          <span>Perte Estimée (ALE)</span>
          <strong>1,42 M€</strong>
          <small>Modèle FAIR calibré</small>
        </article>
        <article className="panel blue">
          <span>Plans en Cours</span>
          <strong>08</strong>
          <small>3 revues en attente</small>
        </article>
        <article className="panel mint">
          <span>Efficacité Contrôles</span>
          <strong>84%</strong>
          <small>+6,2% ce trimestre</small>
        </article>
      </section>

      <section className="workbench-grid">
        <article className="panel registry-panel">
          <header>
            <div>
              <span className="eyebrow">SCÉNARIOS DE RISQUE MAJEURS</span>
              <h2>Scénarios & Exposition Résiduelle</h2>
            </div>
            <span className="sync-label"><i /> Matrice 5×5 à jour</span>
          </header>

          <div className="registry-table">
            <div className="registry-row registry-head">
              <span>Code / Scénario</span>
              <span>Catégorie</span>
              <span>Risque Brut</span>
              <span>Risque Résiduel</span>
              <span>Statut</span>
            </div>
            {risks.map((item, idx) => (
              <button
                key={item.id}
                className={`registry-row ${selectedIdx === idx ? "selected" : ""}`}
                onClick={() => setSelectedIdx(idx)}
              >
                <span>
                  <b className="cve-pill" style={{ marginRight: 6 }}>{item.id}</b>
                  <b>{item.title}</b>
                </span>
                <span>{item.category}</span>
                <span><span className="score-badge critical">{item.inherentScore}/25</span></span>
                <span><span className={`score-badge ${item.residualScore >= 8 ? "high" : "mint"}`}>{item.residualScore}/25</span></span>
                <span className={`record-state ${item.tone}`}>{item.status}</span>
              </button>
            ))}
          </div>
        </article>

        <aside className="panel context-panel">
          <div className="context-score">
            <span className={`score-badge ${current.residualScore >= 8 ? "high" : "mint"}`}>
              {current.residualScore} / 25
            </span>
            <div>
              <span className="eyebrow">ANALYSE D'IMPACT</span>
              <h2>{current.id}</h2>
            </div>
          </div>

          <h3>{current.title}</h3>
          <p>Impact financier direct estimé : <strong>{current.financialImpact}</strong>. Vraisemblance résiduelle : {current.likelihood}.</p>

          <div className="context-factors">
            <span><ShieldCheck size={14} /> Contrôles : <b>{current.controls}</b></span>
            <span><Users size={14} /> Responsable : <b>{current.owner}</b></span>
          </div>

          <div className="context-ai">
            <Sparkles />
            <div>
              <b>Plan d'Action Recommandé</b>
              <p>{current.actionPlan}</p>
            </div>
          </div>

          <button
            className="primary full"
            onClick={() => notify(`Plan d'action déclenché pour ${current.id}`)}
          >
            <Play size={14} /> Appliquer le Plan de Traitement
          </button>
          <button
            className="secondary full"
            onClick={onOpenAssistant}
          >
            <Bot size={14} /> Consulter Sentinel Intelligence sur ce Risque
          </button>
        </aside>
      </section>
    </div>
  );
}

function ReportsHub({ notify }: { notify: (s: string) => void }) {
  const reports = [
    {
      title: "Rapport Exécutif de Sécurité Trimestriel (Comex)",
      type: "Direction Générale",
      format: "PDF Chiffré",
      period: "T1 2026",
      generatedAt: "24 Sept 2026",
      hash: "7f4c…982a",
      desc: "Synthèse stratégique : score de posture global, conformité NIS 2 & DORA, investissements et appétence aux risques.",
    },
    {
      title: "Attestation de Conformité Continue NIS 2 (ANSSI)",
      type: "Réglementaire",
      format: "Bundle Cryptographique",
      period: "Année 2026",
      generatedAt: "22 Sept 2026",
      hash: "3b12…e04d",
      desc: "Dossier probant officiel : cartographie des contrôles des 50 articles NIS 2 avec signatures horodatées.",
    },
    {
      title: "Rapport Opérationnel SOC & MITRE ATT&CK",
      type: "Technique",
      format: "PDF + JSON",
      period: "30 derniers jours",
      generatedAt: "20 Sept 2026",
      hash: "a901…ff23",
      desc: "Détails télémétriques : 14 284 alertes corrélées, MTTD de 18 min, MTTR de 4,2 s et analyse des TTPs observés.",
    },
    {
      title: "Cartographie d'Exposition Externe & CVEs",
      type: "Audit Technique",
      format: "CSV + PDF",
      period: "Hebdomadaire",
      generatedAt: "Hier à 18:00",
      hash: "119e…4c78",
      desc: "Inventaire complet des vulnérabilités actives, score EPSS, présence catalogue CISA KEV et état des correctifs.",
    },
  ];

  return (
    <div className="page fade-in">
      <PageHeading
        eyebrow="ANALYTIQUE & REPORTING"
        title="Générateur de Rapports Exécutifs"
        description="Générez, signez et distribuez des rapports audités, infalsifiables et horodatés."
        actions={
          <>
            <button className="primary" onClick={() => notify("Nouveau rapport trimestriel généré avec signature SHA-256")}>
              <Plus size={16} /> Générer un Rapport
            </button>
          </>
        }
      />

      <section className="panel" style={{ padding: 22 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <span className="eyebrow">PUBLICATIONS DISPONIBLES</span>
            <h2 style={{ fontSize: 18, color: "#fff" }}>Rapports Officiels Signés Cryptographiquement</h2>
          </div>
          <span className="sync-label"><i /> Signatures RSA-4096 / SHA-256</span>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
          {reports.map((rep) => (
            <div key={rep.title} className="ai-model-box" style={{ cursor: "default" }}>
              <div className="ai-model-box-head">
                <b><FileText size={16} color="#35e4b7" /> {rep.title}</b>
                <span className="model-tag sovereign">{rep.type}</span>
              </div>
              <p className="ai-model-box-desc">{rep.desc}</p>
              <div className="ai-model-box-specs">
                <span><Clock3 size={11} /> {rep.period}</span>
                <span><CheckCircle2 size={11} /> {rep.format}</span>
                <span style={{ fontFamily: "monospace", marginLeft: "auto" }}>SHA: {rep.hash}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  className="primary"
                  style={{ flex: 1, height: 30, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  onClick={() => notify(`Téléchargement de « ${rep.title} » démarré`)}
                >
                  <Download size={13} /> Télécharger
                </button>
                <button
                  className="secondary"
                  style={{ height: 30, fontSize: 11, padding: "0 10px" }}
                  onClick={() => notify(`Lien de partage chiffré généré pour les auditeurs`)}
                >
                  Partager
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AssetInventoryHub({ notify, onNavigate }: { notify: (s: string) => void; onNavigate: (page: string) => void }) {
  const [filter, setFilter] = useState("all");
  const assets = [
    { name: "DC-EU-02", type: "Serveur", os: "Windows Server 2022", ip: "10.0.1.10", tier: "Tier 0 (Contrôleur de domaine)", agent: "Sentinel EDR Actif", fim: "FIM Actif", status: "Protégé", tone: "mint" },
    { name: "bastion-gw-01", type: "Passerelle", os: "Debian 12 Bookworm", ip: "10.0.0.5", tier: "Tier 1 (Bastion SSH)", agent: "Sentinel EDR Actif", fim: "FIM Actif", status: "Protégé", tone: "mint" },
    { name: "FIN-WS-042", type: "Poste", os: "Windows 11 Enterprise", ip: "10.0.4.42", tier: "Tier 2 (Poste Finance)", agent: "Sentinel EDR Actif", fim: "Surveillance", status: "Alerte EDR", tone: "coral" },
    { name: "k8s-prod-worker-08", type: "Cloud", os: "Ubuntu 24.04 LTS", ip: "10.2.14.88", tier: "Tier 1 (Cluster Kubernetes)", agent: "Sentinel EDR Actif", fim: "FIM Actif", status: "Protégé", tone: "mint" },
    { name: "db-master-postgres", type: "Serveur", os: "RHEL 9.4", ip: "10.0.3.15", tier: "Tier 0 (Base Production)", agent: "Sentinel EDR Actif", fim: "FIM Chiffré", status: "Protégé", tone: "mint" },
  ];

  const visible = assets.filter((a) => {
    if (filter === "all") return true;
    if (filter === "servers") return a.type === "Serveur" || a.type === "Passerelle";
    if (filter === "workstations") return a.type === "Poste";
    if (filter === "cloud") return a.type === "Cloud";
    return true;
  });

  return (
    <div className="page fade-in">
      <PageHeading
        eyebrow="INVENTAIRE UNIFIÉ · MULTI-CLOUD & ON-PREMISE"
        title="Parc & Cartographie des Actifs"
        description="Vue en temps réel des serveurs, postes de travail, instances cloud et conteneurs supervisés par l'agent Sentinel."
        actions={
          <>
            <button className="secondary" onClick={() => notify("Inventaire matériel et logiciel exporté")}>
              <FileDown size={16} /> Exporter
            </button>
            <button className="primary" onClick={() => notify("Scan d'intégrité FIM lancé sur le parc")}>
              <RefreshCw size={16} /> Scan d'Intégrité Global
            </button>
          </>
        }
      />

      <section className="module-kpis">
        <article className="panel mint">
          <span>Actifs Supervisés</span>
          <strong>1 420</strong>
          <small>100% Découverts</small>
        </article>
        <article className="panel mint">
          <span>Couverture EDR</span>
          <strong>99,4%</strong>
          <small>1 412 agents en ligne</small>
        </article>
        <article className="panel coral">
          <span>Postes avec Alerte</span>
          <strong>01</strong>
          <small>FIN-WS-042 (Isolation prête)</small>
        </article>
        <article className="panel blue">
          <span>Actifs Tier 0</span>
          <strong>42</strong>
          <small>Surveillance renforcée</small>
        </article>
      </section>

      <section className="panel" style={{ padding: 20 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <span className="eyebrow">REGISTRE DES MACHINES</span>
            <h2 style={{ fontSize: 18, color: "#fff" }}>Machines & Terminaux Déployés</h2>
          </div>
          <div className="scope-switch">
            {[
              { id: "all", label: "Tous" },
              { id: "servers", label: "Serveurs" },
              { id: "workstations", label: "Postes" },
              { id: "cloud", label: "Cloud & K8s" },
            ].map((btn) => (
              <button
                key={btn.id}
                className={filter === btn.id ? "active" : ""}
                onClick={() => setFilter(btn.id)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </header>

        <div className="registry-table">
          <div className="registry-row registry-head">
            <span>Nom d'Hôte / Type</span>
            <span>Système d'Exploitation</span>
            <span>Adresse IP</span>
            <span>Niveau de Criticité</span>
            <span>Statut EDR / FIM</span>
            <span>Action Rapide</span>
          </div>
          {visible.map((a) => (
            <div key={a.name} className="registry-row" style={{ cursor: "default" }}>
              <span>
                <Server size={14} color="#35e4b7" style={{ marginRight: 6, verticalAlign: "middle" }} />
                <b>{a.name}</b>
              </span>
              <span>{a.os}</span>
              <span style={{ fontFamily: "monospace", color: "var(--muted)" }}>{a.ip}</span>
              <span><span className={`tab-badge ${a.tier.includes("Tier 0") ? "kev-tag" : ""}`}>{a.tier}</span></span>
              <span><span className={`record-state ${a.tone}`}>{a.status}</span></span>
              <span>
                {a.status === "Alerte EDR" ? (
                  <button
                    className="primary"
                    style={{ height: 26, fontSize: 10, padding: "0 8px" }}
                    onClick={() => notify(`Ordre d'isolation réseau envoyé à ${a.name}`)}
                  >
                    Isoler la machine
                  </button>
                ) : (
                  <button
                    className="secondary"
                    style={{ height: 26, fontSize: 10, padding: "0 8px" }}
                    onClick={() => notify(`Scan FIM déclenché sur ${a.name}`)}
                  >
                    Vérifier intégrité
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AICommandCenter({ notify, onNavigate, onOpenAssistant }: { notify: (s: string) => void; onNavigate: (page: string) => void; onOpenAssistant: () => void }) {
  const [selectedModelId, setSelectedModelId] = useState<ModelProvider>("kimi-k2");
  const [promptInput, setPromptInput] = useState("");
  const currentModel = modelCatalog.find((m) => m.id === selectedModelId) ?? modelCatalog[0];

  const autonomousCapabilities = [
    {
      title: "Agent d'Endiguement SOC Autonome",
      desc: "Détecte les balises C2 et isole immédiatement la carte réseau du terminal compromis via l'EDR Sentinel.",
      sla: "SLA < 3 sec",
      status: "Actif · Surveillance 24/7",
      risk: "high",
      action: "Isoler FIN-WS-042 (EDR Lock)",
    },
    {
      title: "Agent Chasseur MITRE ATT&CK",
      desc: "Reconstitue automatiquement la chaîne d'attaque (T1078, T1059.001) et corrèle avec les règles Sigma.",
      sla: "SLA < 5 sec",
      status: "Actif · 14 200 logs/sec",
      risk: "medium",
      action: "Corréler Graphe d'Attaque",
    },
    {
      title: "Agent Conformité Continue NIS 2 / DORA",
      desc: "Génère les éléments probants cryptographiques et alerte en cas de dérive de gouvernance.",
      sla: "SLA 15 sec",
      status: "Actif · 94% Conforme",
      risk: "low",
      action: "Générer Preuve Cryptographique",
    },
    {
      title: "Agent Synthèse & Déploiement n8n",
      desc: "Synthétise et applique des playbooks SOAR avec signature électronique et validation MFA.",
      sla: "SLA 2 sec",
      status: "Actif · 18 Workflows",
      risk: "medium",
      action: "Valider Playbook Phishing",
    },
  ];

  return (
    <div className="page fade-in ai-command-center">
      <PageHeading
        eyebrow="SENTINEL INTELLIGENCE · NIVEAU SUPRÊME"
        title="Centre de Commandement & Agents Autonomes"
        description="Architecture multi-modèles souveraine (Kimi K2 Sovereign, Deep Reasoner, Autonomous Operator). Analyse en mémoire protégée, zero-egress et orchestration SOC en temps réel."
        actions={
          <>
            <button className="secondary" onClick={onOpenAssistant}>
              <Radio size={16} /> Mode Vocal Direct
            </button>
            <button className="primary" onClick={onOpenAssistant}>
              <Sparkles size={16} /> Ouvrir le Copilote IA
            </button>
          </>
        }
      />

      <section className="ai-hero-banner">
        <div className="ai-hero-content">
          <div className="ai-hero-title">
            <span className="eyebrow" style={{ color: "var(--mint)" }}>
              <ShieldCheck size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              INFÉRENCE SOUVERAINE VÉRIFIÉE · ZERO DATA EGRESS
            </span>
            <h2>
              <Brain size={24} color="#35e4b7" />
              Moteur Actif : {currentModel.name}
              <span className="model-pill-badge" style={{ fontSize: 11 }}><i></i>200k Context</span>
            </h2>
            <p>
              Les requêtes et analyses SOC sont traitées sur l'infrastructure souveraine européenne ACME.
              Aucune donnée télémétrique, identifiant ou secret ne quitte votre périmètre sécurisé.
            </p>
          </div>
          <div className="ai-hero-actions">
            <button className="primary" onClick={onOpenAssistant} style={{ height: 38 }}>
              <Mic size={15} /> Lancer une session vocale
            </button>
          </div>
        </div>

        <div className="ai-hero-kpis">
          <div className="ai-kpi-card">
            <span>Latence d'Inférence</span>
            <strong>{currentModel.latency}</strong>
            <small><Clock3 size={11} /> 1er token en sub-40ms</small>
          </div>
          <div className="ai-kpi-card">
            <span>Débit de Génération</span>
            <strong>{currentModel.speed}</strong>
            <small><Zap size={11} /> Streaming fluide local</small>
          </div>
          <div className="ai-kpi-card">
            <span>Fenêtre de Contexte</span>
            <strong>{currentModel.contextSize}</strong>
            <small><Cpu size={11} /> Multi-fichiers & graphes</small>
          </div>
          <div className="ai-kpi-card">
            <span>Gouvernance & RGPD</span>
            <strong>100% Souverain</strong>
            <small><ShieldCheck size={11} /> Hébergement UE vérifié</small>
          </div>
        </div>
      </section>

      <section className="ai-command-grid">
        <div className="panel" style={{ padding: 20 }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <span className="eyebrow">CATALOGUE MULTI-MODÈLES</span>
              <h2 style={{ fontSize: 18, color: "#fff" }}>Sélectionner le Cerveau IA</h2>
            </div>
            <span className="sync-label"><i /> 3 Modèles Kimi K2 En Ligne</span>
          </header>

          <div className="ai-models-grid">
            {modelCatalog.map((candidate) => {
              const isSelected = candidate.id === selectedModelId;
              return (
                <div
                  key={candidate.id}
                  className={`ai-model-box ${isSelected ? "active" : ""}`}
                  onClick={() => {
                    setSelectedModelId(candidate.id);
                    notify(`Moteur d'inférence commuté vers : ${candidate.name}`);
                  }}
                >
                  <div className="ai-model-box-head">
                    <b>
                      {candidate.isSovereign ? <ShieldCheck size={16} color="#35e4b7" /> : <Globe2 size={16} color="#889" />}
                      {candidate.name}
                    </b>
                    <span className="model-tag sovereign">{candidate.badge}</span>
                  </div>
                  <p className="ai-model-box-desc">{candidate.detail}</p>
                  <div className="ai-model-box-specs">
                    <span><Cpu size={12} /> {candidate.contextSize}</span>
                    <span><Clock3 size={12} /> {candidate.latency}</span>
                    <span><Zap size={12} /> {candidate.speed}</span>
                  </div>
                  <button
                    className={isSelected ? "primary full" : "secondary full"}
                    style={{ height: 28, fontSize: 11, marginTop: 4 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedModelId(candidate.id);
                      notify(`Modèle sélectionné : ${candidate.name}`);
                    }}
                  >
                    {isSelected ? "✓ Modèle Actif" : "Sélectionner ce modèle"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <header>
            <span className="eyebrow">PILOTAGE DIRECT</span>
            <h2 style={{ fontSize: 18, color: "#fff" }}>Prompt d'Opération</h2>
          </header>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
            Soumettez une directive d'enquête ou déclenchez une remédiation autonome.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Ex: Analyse la détection de mouvement latéral sur FIN-WS-042 et prépare l'isolation réseau..."
              style={{
                width: "100%",
                minHeight: 110,
                background: "rgba(10, 22, 22, 0.7)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                color: "#fff",
                padding: 12,
                fontSize: 12,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="secondary"
                style={{ flex: "0 0 42px", height: 36, padding: 0, display: "grid", placeItems: "center" }}
                onClick={onOpenAssistant}
                title="Activer la voix"
              >
                <Mic size={16} />
              </button>
              <button
                className="primary"
                style={{ flex: 1, height: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onClick={() => {
                  if (promptInput.trim()) {
                    notify(`Directive transmise à ${currentModel.name}`);
                    onOpenAssistant();
                  } else {
                    onOpenAssistant();
                  }
                }}
              >
                <Send size={15} /> Exécuter via {currentModel.name}
              </button>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 4 }}>
            <span className="eyebrow" style={{ marginBottom: 6, display: "block" }}>SUGGESTIONS RAPIDES</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Isoler le poste compromis FIN-WS-042",
                "Auditer les comptes administrateurs inactifs",
                "Rechercher les hashs Emotet dans la base FIM",
              ].map((s) => (
                <button
                  key={s}
                  className="secondary"
                  style={{ textAlign: "left", fontSize: 11, padding: "8px 10px", justifyContent: "space-between" }}
                  onClick={() => {
                    setPromptInput(s);
                    notify(`Requête copiée : ${s}`);
                  }}
                >
                  <span>{s}</span>
                  <ArrowRight size={12} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="panel" style={{ padding: 20 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <span className="eyebrow">FORCE OPÉRATIONNELLE</span>
            <h2 style={{ fontSize: 18, color: "#fff" }}>Agents Spécialisés Autonomes</h2>
          </div>
          <span className="sync-label"><i /> 4 Agents en Veille Active</span>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
          {autonomousCapabilities.map((cap) => (
            <div key={cap.title} className="ai-agent-capability-item">
              <div className="ai-agent-cap-info">
                <b>
                  <Zap size={14} color="#35e4b7" />
                  {cap.title}
                </b>
                <p style={{ margin: "4px 0", fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{cap.desc}</p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <span className="tab-badge">{cap.sla}</span>
                  <small style={{ color: "var(--mint)", fontSize: 10 }}>{cap.status}</small>
                </div>
              </div>
              <button
                className="secondary"
                style={{ height: 32, fontSize: 11, padding: "0 12px", whiteSpace: "nowrap", marginLeft: 12 }}
                onClick={() => notify(`Action validée : « ${cap.action} »`)}
              >
                <Play size={12} /> {cap.action}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ padding: 20 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <span className="eyebrow">JOURNAL CRYPTOGRAPHIQUE</span>
            <h2 style={{ fontSize: 18, color: "#fff" }}>Audit & Décisions Autonomes Récentes</h2>
          </div>
          <small style={{ color: "var(--muted)", fontSize: 11 }}><LockKeyhole size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Chaîne SHA-256 non altérable</small>
        </header>

        <div className="registry-table">
          <div className="registry-row registry-head">
            <span>Heure (UTC)</span>
            <span>Agent / Modèle</span>
            <span>Action Autonome Réalisée</span>
            <span>Périmètre Cible</span>
            <span>Preuve SHA-256</span>
            <span>Statut</span>
          </div>
          {[
            { time: "15:41:02", agent: "Kimi K2 Coder", action: "Génération Playbook Blocage C2", scope: "Firewall Cloudflare", hash: "a8f9…c42b", status: "Exécuté" },
            { time: "15:38:19", agent: "Kimi K2 Sovereign", action: "Corrélation MITRE ATT&CK T1078", scope: "Tenant ACME Europe", hash: "9e12…78fd", status: "Validé" },
            { time: "15:30:44", agent: "Kimi K2 Thinking", action: "Isolation carte réseau hôte", scope: "FIN-WS-042", hash: "3c71…9a10", status: "Confiné" },
            { time: "15:15:00", agent: "Kimi K2 Sovereign", action: "Purge Token Administrateur Inactif", scope: "Azure AD / IAM", hash: "f401…55e8", status: "Révoqué" },
          ].map((row, idx) => (
            <div key={idx} className="registry-row" style={{ cursor: "default" }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{row.time}</span>
              <span><Brain size={12} color="#35e4b7" style={{ marginRight: 5, verticalAlign: "middle" }} /><b>{row.agent}</b></span>
              <span>{row.action}</span>
              <span>{row.scope}</span>
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted)" }}>{row.hash}</span>
              <span className="record-state mint">{row.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Assistant({ page, onClose, notify }: { page: string; onClose: () => void; notify: (s: string) => void }) {
  const [tab, setTab] = useState<"chat" | "models" | "playbooks" | "voice">("chat");
  const [model, setModel] = useState<ModelProvider>("kimi-k2");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [working, setWorking] = useState(false);
  const [streamingDelta, setStreamingDelta] = useState("");
  const [activeReasoning, setActiveReasoning] = useState<string[]>([]);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [continuousVoice, setContinuousVoice] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const selectedModel = modelCatalog.find((candidate) => candidate.id === model) ?? modelCatalog[0];

  // Web Speech Synthesis (Read answer aloud)
  const speakText = (text: string) => {
    if (!("speechSynthesis" in window) || !ttsEnabled) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/```[\s\S]*?```/g, "Extrait de code omis.")
        .replace(/[*#`_\[\]()]/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/\n+/g, ". ")
        .slice(0, 380);
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "fr-FR";
      utterance.rate = 1.05;
      utterance.onstart = () => setVoiceSpeaking(true);
      utterance.onend = () => {
        setVoiceSpeaking(false);
        if (continuousVoice) {
          window.setTimeout(() => startListening(), 400);
        }
      };
      utterance.onerror = () => setVoiceSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setVoiceSpeaking(false);
    }
  };

  // Web Audio Visualizer
  const startAudioVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch {
      // Graceful simulated spectrum fallback
      const timer = window.setInterval(() => {
        setAudioLevel(Math.floor(Math.random() * 55) + 25);
      }, 90);
      animFrameRef.current = timer as any;
    }
  };

  const stopAudioVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      clearInterval(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  // Web Speech Recognition
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify("Reconnaissance vocale Web Speech non supportée dans ce navigateur.");
      return;
    }
    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      const recognition = new SpeechRecognition();
      recognition.lang = "fr-FR";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setVoiceListening(true);
        void startAudioVisualizer();
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        let isFinal = false;
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }
        setInput(transcript);
        if (isFinal && transcript.trim().length > 0) {
          stopListening();
          void ask(transcript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event?.error === "not-allowed") {
          notify("Microphone refusé : veuillez autoriser le micro dans votre navigateur.");
        }
        stopListening();
      };

      recognition.onend = () => {
        setVoiceListening(false);
        stopAudioVisualizer();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setVoiceListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setVoiceListening(false);
    stopAudioVisualizer();
  };

  const toggleVoice = () => {
    if (voiceListening) stopListening();
    else startListening();
  };

  useEffect(() => {
    return () => {
      stopListening();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const ask = async (prompt = input) => {
    if (!prompt.trim() || working) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMsg]);
    setInput("");
    setWorking(true);
    setStreamingDelta("");
    setActiveReasoning([]);
    abortRef.current = new AbortController();

    try {
      const response = await intelligenceClient.streamResponse(
        {
          model,
          messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
          context: { tenantId: "acme-eu", page },
          mode: prompt.includes("workflow") ? "build-workflow" : "investigate",
        },
        (accumulated) => {
          setStreamingDelta(accumulated);
        },
        (reasoningStep) => {
          setActiveReasoning((prev) => [...prev, reasoningStep]);
        },
        abortRef.current.signal
      );
      setMessages((current) => [...current, response]);
      setStreamingDelta("");
      setActiveReasoning([]);
      if (ttsEnabled) {
        speakText(response.content);
      } else if (continuousVoice) {
        window.setTimeout(() => startListening(), 400);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            createdAt: new Date().toISOString(),
            content: "Le modèle souverain Kimi K2 a isolé la requête localement. Données protégées.",
          },
        ]);
      }
    } finally {
      setWorking(false);
      setStreamingDelta("");
    }
  };

  const executeAction = (action: ProposedAction) => {
    notify(`Action autonome déclenchée : « ${action.label} »`);
  };

  return <aside className="assistant-drawer" aria-label="Sentinel Intelligence">
    <header>
      <div className="ai-orb"><Sparkles size={20}/></div>
      <div>
        <b style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Sentinel Intelligence
          <span className="model-pill-badge"><i></i>{selectedModel.name}</span>
        </b>
        <span><i/> Contexte ACME · Souveraineté UE · Données expurgées</span>
      </div>
      <button aria-label="Fermer" onClick={onClose}><X size={18}/></button>
    </header>

    <nav className="assistant-subnav">
      <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
        <Bot size={14}/><span>Agent</span>
      </button>
      <button className={tab === "models" ? "active" : ""} onClick={() => setTab("models")}>
        <Brain size={14}/><span>Kimi & Modèles</span><em>{modelCatalog.filter(m => m.id.startsWith("kimi")).length}</em>
      </button>
      <button className={tab === "playbooks" ? "active" : ""} onClick={() => setTab("playbooks")}>
        <Zap size={14}/><span>Playbooks</span>
      </button>
      <button className={tab === "voice" ? "active" : ""} onClick={() => setTab("voice")}>
        {voiceListening ? <Mic size={14} color="#35e4b7"/> : <Radio size={14}/>}<span>Mode Vocal</span>
      </button>
    </nav>

    {tab === "models" ? (
      <div className="models-view fade-in">
        <div className="model-hero-intro">
          <h3><Sparkles size={16} color="#35e4b7"/> Architecture Multi-Modèles Kimi K2</h3>
          <p>Choisissez votre moteur d'inférence souverain. Les modèles Kimi K2 disposent d'un contexte étendu de 200k tokens et d'une latence ultra-faible.</p>
        </div>

        {modelCatalog.map((candidate) => {
          const isSelected = candidate.id === model;
          return (
            <button
              className={`model-card-item ${isSelected ? "selected" : ""}`}
              key={candidate.id}
              onClick={() => {
                setModel(candidate.id);
                notify(`Modèle actif : ${candidate.name}`);
              }}
            >
              <div className="model-card-head">
                <b>
                  {candidate.isSovereign ? <ShieldCheck size={14} color="#35e4b7"/> : <Globe2 size={14} color="#889"/>}
                  {candidate.name}
                </b>
                <span className={`model-tag ${candidate.badge.toLowerCase().includes("souverain") ? "sovereign" : candidate.badge.toLowerCase().includes("raisonnement") ? "reasoning" : ""}`}>
                  {candidate.badge}
                </span>
              </div>
              <p className="model-card-desc">{candidate.detail}</p>
              <div className="model-card-meta">
                <span><Cpu size={12}/> {candidate.contextSize}</span>
                <span><Clock3 size={12}/> <b>{candidate.latency}</b></span>
                <span><Zap size={12}/> <b>{candidate.speed}</b></span>
                <span style={{ marginLeft: "auto" }}>{candidate.location}</span>
              </div>
            </button>
          );
        })}
      </div>
    ) : tab === "playbooks" ? (
      <div className="models-view fade-in">
        <div className="model-hero-intro">
          <h3><Zap size={16} color="#35e4b7"/> Playbooks Autonomes Sentinel</h3>
          <p>Actions de remédiation orchestrées avec approbation humaine en un clic.</p>
        </div>
        {[
          { title: "Isolation Hôte Infecté", desc: "Isole la carte réseau FIN-WS-042 via l'agent EDR en conservant la télémétrie SOC.", risk: "high", time: "SLA 5s" },
          { title: "Révocation Sessions & Tokens Dormants", desc: "Révoque immédiatement les 4 comptes IAM administrateurs sans activité depuis 90 jours.", risk: "medium", time: "SLA 15s" },
          { title: "Blocage IoC Firewall & DNS", desc: "Injecte la liste d'IPs et domaines malveillants observés sur les passerelles Palo Alto et Cloudflare.", risk: "low", time: "SLA 2s" },
          { title: "Purge Automatique Phishing M365", desc: "Supprime les emails de la campagne active de toutes les boîtes aux lettres ACME Europe.", risk: "medium", time: "SLA 30s" },
        ].map((pb) => (
          <div className="model-card-item" key={pb.title}>
            <div className="model-card-head">
              <b><Shield size={14} color="#35e4b7"/> {pb.title}</b>
              <span className={`model-tag ${pb.risk === "high" ? "coral" : pb.risk === "medium" ? "amber" : "mint"}`}>{pb.risk.toUpperCase()}</span>
            </div>
            <p className="model-card-desc">{pb.desc}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <small style={{ color: "var(--muted)", fontSize: 9 }}><Clock3 size={11}/> {pb.time}</small>
              <button className="primary" style={{ height: 28, fontSize: 10, padding: "0 10px" }} onClick={() => notify(`Playbook déclenché : « ${pb.title} »`)}>
                <Play size={12}/> Déclencher
              </button>
            </div>
          </div>
        ))}
      </div>
    ) : tab === "voice" ? (
      <div className="voice-console-stage fade-in">
        <div
          className={`voice-orb-interactive ${voiceListening ? "listening" : ""} ${voiceSpeaking ? "speaking" : ""}`}
          onClick={toggleVoice}
          title={voiceListening ? "Cliquer pour arrêter l'écoute" : "Cliquer pour parler à Sentinel"}
        >
          {voiceListening ? <Mic size={42}/> : voiceSpeaking ? <Volume2 size={42}/> : <MicOff size={36}/>}
        </div>

        <div>
          <b style={{ fontSize: 14, color: "#fff", display: "block" }}>
            {voiceListening ? "Écoute active en cours…" : voiceSpeaking ? "Sentinel Intelligence parle…" : "Console Vocale Prête"}
          </b>
          <small style={{ color: "var(--muted)", fontSize: 10 }}>
            {voiceListening ? "Parlez naturellement en français. La détection s'adapte en temps réel." : "Appuyez sur l'orbe ou la touche micro pour converser."}
          </small>
        </div>

        {voiceListening && (
          <div className="audio-spectrum-bars">
            {[0.4, 0.7, 0.9, 0.6, 0.8, 1.0, 0.5, 0.85, 0.65, 0.4].map((multiplier, index) => (
              <i
                key={index}
                className="spectrum-bar"
                style={{
                  height: `${Math.max(4, (audioLevel * multiplier * 0.35))}px`,
                }}
              />
            ))}
          </div>
        )}

        <div className="voice-controls-panel">
          <div className="voice-switch-row">
            <span>Synthèse vocale des réponses</span>
            <input type="checkbox" checked={ttsEnabled} onChange={(e) => setTtsEnabled(e.target.checked)}/>
          </div>
          <div className="voice-switch-row">
            <span>Conversation continue (mains-libres)</span>
            <input type="checkbox" checked={continuousVoice} onChange={(e) => setContinuousVoice(e.target.checked)}/>
          </div>
          <div className="voice-switch-row" style={{ fontSize: 9, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
            <span>Moteur vocal : Web Speech API (fr-FR)</span>
            <b style={{ color: "var(--mint)" }}>Actif · 16 kHz</b>
          </div>
        </div>
      </div>
    ) : (
      <div className="assistant-content">
        {messages.length === 0 ? (
          <>
            <div className="assistant-intro">
              <span className="ai-orb small"><Bot size={20}/></span>
              <h2>Comment puis-je renforcer votre posture ?</h2>
              <p>Moteur souverain <strong>{selectedModel.name}</strong> actif ({selectedModel.detail}). Posez une question ou activez le micro.</p>
            </div>
            <div className="suggestions">
              {[
                "Résume les 3 risques prioritaires pour le comité",
                "Crée un workflow n8n de réponse au phishing",
                "Analyse la détection de mouvement latéral",
                "Quels contrôles NIS 2 nécessitent une attention ?"
              ].map((suggestion) => (
                <button onClick={() => ask(suggestion)} key={suggestion}>
                  {suggestion}<ArrowRight size={14}/>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="chat-thread">
            {messages.map((message) => (
              <article className={message.role} key={message.id}>
                <span>{message.role === "assistant" ? <Sparkles size={14}/> : "CD"}</span>
                <div>
                  <b>{message.role === "assistant" ? selectedModel.name : "Vous"}</b>
                  {message.reasoning && message.reasoning.length > 0 && (
                    <details className="reasoning-box">
                      <summary><Brain size={12}/> Raisonnement de l'agent ({message.reasoning.length} étapes validées)</summary>
                      <ul className="reasoning-steps-list">
                        {message.reasoning.map((step, idx) => (
                          <li key={idx} className="reasoning-step-item">✓ {step}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <p style={{ whiteSpace: "pre-wrap" }}>{message.content}</p>
                  {message.citations && message.citations.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {message.citations.map((c) => (
                        <a href={c.href} key={c.href} className="tab-badge" style={{ textDecoration: "none" }}>{c.label}</a>
                      ))}
                    </div>
                  )}
                  {message.proposedActions && message.proposedActions.length > 0 && (
                    <div className="action-chips">
                      {message.proposedActions.map((action) => (
                        <button
                          key={action.id}
                          className={`action-chip ${action.risk === "high" ? "risk-high" : action.risk === "medium" ? "risk-medium" : ""}`}
                          onClick={() => executeAction(action)}
                        >
                          <Zap size={11}/> {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {message.latencyMs !== undefined && (
                    <div className="msg-telemetry">
                      <span>⚡ {message.latencyMs} ms</span>
                      <span>• {message.tokensPerSec ?? 115} tok/s</span>
                      <span>• Cloud Souverain</span>
                    </div>
                  )}
                </div>
              </article>
            ))}

            {working && (
              <article className="assistant">
                <span><Sparkles size={14}/></span>
                <div>
                  <b>{selectedModel.name}</b>
                  {activeReasoning.length > 0 && (
                    <div className="reasoning-box" style={{ borderColor: "var(--mint)" }}>
                      <span style={{ color: "var(--mint)", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                        <Brain size={12} className="spinning"/> Analyse souveraine en cours…
                      </span>
                      <small style={{ display: "block", marginTop: 4, color: "#8da49f" }}>
                        {activeReasoning[activeReasoning.length - 1]}
                      </small>
                    </div>
                  )}
                  {streamingDelta ? (
                    <p style={{ whiteSpace: "pre-wrap" }}>{streamingDelta}<i className="radar-core" style={{ display: "inline-block", width: 6, height: 6, marginLeft: 4 }}/></p>
                  ) : (
                    <div className="thinking"><i/><i/><i/> Inférence ultra-rapide en cours</div>
                  )}
                </div>
              </article>
            )}
          </div>
        )}
      </div>
    )}

    <footer>
      <div>
        <button
          className={`mic-btn-input ${voiceListening ? "active" : ""}`}
          onClick={toggleVoice}
          title={voiceListening ? "Arrêter l'écoute" : "Activer la saisie vocale"}
          type="button"
        >
          {voiceListening ? <Mic size={15}/> : <MicOff size={15}/>}
        </button>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void ask(); }}
          placeholder={voiceListening ? "Écoute en cours… parlez maintenant" : `Interroger ${selectedModel.name}…`}
        />
        <button aria-label={working ? "Arrêter" : "Envoyer"} onClick={() => working ? abortRef.current?.abort() : void ask()}>
          {working ? <X size={16}/> : <Send size={16}/>}
        </button>
      </div>
      <small><LockKeyhole size={11}/> Secrets expurgés · RBAC actif · Inférence souveraine vérifiée</small>
    </footer>
  </aside>;
}

function SearchPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (id: string) => void }) { return <div className="modal-backdrop command-backdrop" onMouseDown={onClose}><div className="search-palette panel" onMouseDown={(e) => e.stopPropagation()}><header><Search/><input autoFocus placeholder="Rechercher une page, un actif, une CVE…"/><kbd>ESC</kbd></header><span className="eyebrow">NAVIGATION</span>{navGroups.flatMap((g) => g.items).slice(0,7).map((item) => <button key={item.id} onClick={() => onNavigate(item.id)}><item.icon/><span><b>{item.label}</b><small>Ouvrir le module</small></span><ArrowRight/></button>)}</div></div>; }
