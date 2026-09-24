import type { LucideIcon } from "lucide-react";
import {
  Activity, Boxes, BrainCircuit, ChartNoAxesCombined, CircleGauge, ClipboardCheck,
  FileChartColumn, Fingerprint, Network, Radar, Scale, Settings, ShieldAlert,
  ShieldCheck, Sparkles, Workflow,
} from "lucide-react";

export type NavItem = { id: string; label: string; icon: LucideIcon; badge?: string };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  { label: "Pilotage", items: [
    { id: "dashboard", label: "Vue stratégique", icon: CircleGauge },
    { id: "posture", label: "Posture SSI", icon: ChartNoAxesCombined },
  ]},
  { label: "Détection & réponse", items: [
    { id: "threats", label: "Menaces", icon: Radar, badge: "7" },
    { id: "vulnerabilities", label: "Vulnérabilités", icon: ShieldAlert, badge: "12" },
    { id: "network", label: "Réseau & exposition", icon: Network },
  ]},
  { label: "Gouvernance", items: [
    { id: "risks", label: "Risques", icon: Scale },
    { id: "compliance", label: "Audits & conformité", icon: ClipboardCheck },
    { id: "reports", label: "Rapports", icon: FileChartColumn },
  ]},
  { label: "Opérations", items: [
    { id: "assets", label: "Actifs", icon: Boxes },
    { id: "orchestration", label: "Orchestration", icon: Workflow, badge: "LIVE" },
    { id: "ai", label: "Sentinel Intelligence", icon: BrainCircuit },
  ]},
];

export const kpis = [
  { label: "Score de résilience", value: "92", suffix: "/100", delta: "+4,8%", tone: "mint" },
  { label: "Risques critiques", value: "03", suffix: "ouverts", delta: "−2 cette semaine", tone: "coral" },
  { label: "Couverture ISO 27001", value: "87", suffix: "%", delta: "+6 contrôles", tone: "blue" },
  { label: "MTTR", value: "18", suffix: "min", delta: "−32%", tone: "violet" },
];

export const workflows = [
  { id: 1, name: "Zero-day containment", description: "Wazuh → Sentinel AI → Validation → Isolement", status: "Actif", runs: "248", rate: "99,8%", trigger: "Webhook", color: "coral" },
  { id: 2, name: "Exposure intelligence", description: "Shodan → VirusTotal → Scoring → TheHive", status: "Actif", runs: "1 024", rate: "99,4%", trigger: "Toutes les 4 h", color: "mint" },
  { id: 3, name: "Executive risk brief", description: "Nexus → LLM privé → PDF → Email chiffré", status: "Planifié", runs: "52", rate: "100%", trigger: "Lundi · 08:00", color: "violet" },
  { id: 4, name: "Critical CVE response", description: "Qualys → Enrichissement → Jira → Slack", status: "Brouillon", runs: "—", rate: "—", trigger: "Manuel", color: "blue" },
];

export const templates = [
  { title: "Phishing autonomous triage", type: "INCIDENT", nodes: 8, installs: "2,8k", icon: Fingerprint },
  { title: "ISO 27001 evidence collector", type: "CONFORMITÉ", nodes: 12, installs: "1,9k", icon: ShieldCheck },
  { title: "Attack surface watch", type: "EXPOSITION", nodes: 7, installs: "1,4k", icon: Activity },
  { title: "AI security report", type: "REPORTING", nodes: 6, installs: "982", icon: Sparkles },
];

export const incidents = [
  { severity: "Critique", title: "Mouvement latéral suspect", asset: "FIN-WS-042", time: "Il y a 3 min", owner: "S. Martin" },
  { severity: "Élevée", title: "Nouvel endpoint exposé", asset: "api-partner-eu", time: "Il y a 18 min", owner: "L. Bernard" },
  { severity: "Moyenne", title: "Échec de contrôle MFA", asset: "IAM-PROD", time: "Il y a 42 min", owner: "Nexus AI" },
];

export const compliance = [
  { label: "ISO 27001", score: 87, controls: "81 / 93" },
  { label: "NIS2", score: 76, controls: "38 / 50" },
  { label: "DORA", score: 91, controls: "41 / 45" },
  { label: "RGPD", score: 94, controls: "47 / 50" },
];

export const genericPages: Record<string, { eyebrow: string; title: string; description: string; metrics: string[] }> = {
  posture: { eyebrow: "POSTURE SSI", title: "Résilience opérationnelle", description: "Mesurez votre exposition et pilotez les objectifs de sécurité par domaine.", metrics: ["Identités", "Endpoints", "Cloud", "Données"] },
  threats: { eyebrow: "SOC / MENACES", title: "Centre de détection", description: "Détectez, enquêtez et contenez les comportements adverses depuis une timeline unifiée.", metrics: ["Alertes ouvertes", "Incidents", "IOC observés", "MTTD"] },
  vulnerabilities: { eyebrow: "EXPOSITION", title: "Vulnérabilités", description: "Priorisation contextuelle basée sur l'exploitabilité, la criticité métier et l'exposition.", metrics: ["Critiques", "Exploitables", "SLA dépassé", "Corrigées"] },
  network: { eyebrow: "SURFACE D'ATTAQUE", title: "Réseau & exposition", description: "Cartographie vivante des flux, services publics et dérives de segmentation.", metrics: ["Services", "Flux anormaux", "Ports publics", "Zones"] },
  risks: { eyebrow: "GRC / RISQUES", title: "Registre des risques", description: "Quantifiez les risques cyber, leurs scénarios et les plans de traitement associés.", metrics: ["Critiques", "Résiduels", "Plans en retard", "Appétence"] },
  compliance: { eyebrow: "GRC / AUDITS", title: "Conformité continue", description: "Audits ISO 27001, NIS2, DORA et RGPD alimentés par des preuves automatisées.", metrics: ["Contrôles", "Conformes", "Écarts", "Preuves"] },
  reports: { eyebrow: "ANALYTIQUE", title: "Rapports exécutifs", description: "Générez et distribuez des rapports fiables, contextualisés et signés.", metrics: ["Rapports", "Planifiés", "Signés", "Destinataires"] },
  assets: { eyebrow: "INVENTAIRE", title: "Actifs & dépendances", description: "Vision multi-cloud des actifs, propriétaires, données et dépendances métier.", metrics: ["Actifs", "Critiques", "Non gérés", "Cloud"] },
  ai: { eyebrow: "SENTINEL INTELLIGENCE", title: "Copilote sécurité privé", description: "Interrogez votre contexte SSI, expliquez les risques et préparez les actions en toute confidentialité.", metrics: ["Analyses", "Confiance", "Actions proposées", "Données locales"] },
};
