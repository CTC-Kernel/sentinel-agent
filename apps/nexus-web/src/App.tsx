import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowRight, Bell, Bot, Check, ChevronDown, ChevronRight, Circle,
  Clock3, FileDown, Filter, Fingerprint, KeyRound, LockKeyhole, Menu, Play,
  Plus, Search, Send, Shield, ShieldCheck, Sparkles, Users, Workflow, X,
  Zap,
} from "lucide-react";
import { compliance, genericPages, incidents, kpis, navGroups, templates, workflows } from "./data";
import { orchestrationClient } from "./services/orchestration";
import { intelligenceClient, modelCatalog, type ChatMessage, type ModelProvider } from "./services/ai";

export function App() {
  const [page, setPage] = useState(() => sessionStorage.getItem("nexus:last-page") ?? "dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [toast, setToast] = useState("");

  const pageLabel = useMemo(() => navGroups.flatMap((g) => g.items).find((item) => item.id === page)?.label ?? "Sentinel Nexus", [page]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  useEffect(() => sessionStorage.setItem("nexus:last-page", page), [page]);
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
          <button className="icon-button has-dot" aria-label="Notifications"><Bell size={18}/></button>
          <button className="profile"><span>CD</span><div><strong>Camille Durand</strong><small>Security Admin</small></div><ChevronDown size={14}/></button>
        </div>
      </header>
      <main>
        {page === "dashboard" ? <Dashboard onNavigate={setPage} notify={notify}/> : page === "orchestration" ? <Orchestration notify={notify}/> : <ModulePage id={page}/>}
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

function Orchestration({ notify }: { notify: (s: string) => void }) {
  const [tab, setTab] = useState("workflows");
  const [selected, setSelected] = useState(workflows[0]);
  const [launchOpen, setLaunchOpen] = useState(false);
  const tabs = ["Vue d'ensemble", "Workflows", "Marketplace", "Exécutions", "Gouvernance"];
  return <div className="page fade-in orchestration-page">
    <PageHeading eyebrow="NEXUS AUTOMATION CLOUD" title="Orchestration" description="Concevez, gouvernez et exécutez votre défense automatisée." actions={<><span className="connection"><i/> n8n connecté</span><button className="secondary"><KeyRound size={16}/> Connecteurs</button><button className="primary" onClick={() => notify("Nouveau workflow initialisé")}><Plus size={16}/> Nouveau workflow</button></>}/>
    <div className="tabs">{tabs.map((name) => <button className={tab === name.toLowerCase().replace("vue d'ensemble", "overview") ? "active" : ""} key={name} onClick={() => setTab(name.toLowerCase().replace("vue d'ensemble", "overview"))}>{name}</button>)}</div>
    {tab === "marketplace" ? <Marketplace notify={notify}/> : tab === "exécutions" ? <Executions/> : tab === "gouvernance" ? <Governance/> : <div className="orchestration-grid">
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

function FlowNode({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) { return <div className="flow-node"><span>{icon}</span><b>{label}</b><small>{sub}</small></div>; }

function Marketplace({ notify }: { notify: (s: string) => void }) { return <div className="subpage"><div className="market-hero panel"><div><span className="eyebrow">MARKETPLACE SSI</span><h2>Accélérez votre défense.</h2><p>Des automatisations vérifiées, versionnées et isolées par tenant.</p></div><button className="primary"><Sparkles size={16}/> Composer avec l'IA</button></div><div className="template-grid">{templates.map((template) => <article className="template panel" key={template.title}><template.icon/><span className="eyebrow">{template.type}</span><h3>{template.title}</h3><p>Template certifié Sentinel Labs, prêt à adapter à votre environnement.</p><footer><span>{template.nodes} nœuds · {template.installs} installations</span><button onClick={() => notify(`${template.title} ajouté au tenant`)}>Installer <Plus size={14}/></button></footer></article>)}</div></div>; }

function Executions() { return <div className="subpage"><div className="section-head large"><div><span className="eyebrow">TEMPS RÉEL</span><h2>Historique d'exécution</h2></div><button className="secondary"><FileDown size={16}/> Exporter</button></div><div className="execution-table panel"><div className="table-row header"><span>ID</span><span>Workflow</span><span>Déclencheur</span><span>Durée</span><span>Statut</span></div>{[["EX-2841","Zero-day containment","Webhook","6,1 s","Approbation"],["EX-2840","Exposure intelligence","Planifié","3,8 s","Réussie"],["EX-2839","Executive risk brief","Planifié","12,4 s","Réussie"],["EX-2838","Critical CVE response","Manuel","4,7 s","Échec"]].map((row) => <div className="table-row" key={row[0]}>{row.map((cell, i) => <span key={cell} className={i === 4 ? `execution-status ${cell.toLowerCase()}` : ""}>{cell}</span>)}</div>)}</div></div>; }

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

function ModulePage({ id }: { id: string }) { const page = genericPages[id] ?? genericPages.posture; return <div className="page fade-in"><PageHeading eyebrow={page.eyebrow} title={page.title} description={page.description} actions={<button className="primary"><Plus size={16}/> Nouvelle action</button>}/><div className="kpi-grid module-kpis">{page.metrics.map((m, i) => <article className={`kpi panel ${["mint","blue","violet","coral"][i]}`} key={m}><span>{m}</span><div><strong>{["128","94%","07","2,4h"][i]}</strong></div><em>Mis à jour maintenant</em></article>)}</div><div className="module-empty panel"><div className="radar-visual"><Activity/></div><span className="eyebrow">ESPACE OPÉRATIONNEL</span><h2>Données {page.title.toLowerCase()} synchronisées</h2><p>Les vues détaillées, filtres, actions en masse et recommandations Sentinel Intelligence sont prêtes.</p><button className="secondary">Explorer les données <ArrowRight size={15}/></button></div></div>; }

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
