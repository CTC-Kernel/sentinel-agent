import { Criticality, Incident } from '../types';

export interface AttackScenario {
 title: string;
 description: string;
 severity: Criticality;
 category: Incident['category'];
 tags: string[];
 details: {
 vector: string;
 targets: string;
 action: string;
 }
}

export const ATTACK_SCENARIOS: AttackScenario[] = [
 {
 title: "DÉTECTION RANSOMWARE : LockBit 3.0",
 description: "<p><strong>Alerte Critique :</strong> L'agent EDR a détecté une activité de chiffrement massive sur le serveur de fichiers principal. Signature compatible avec <em>LockBit 3.0</em>.</p>",
 severity: Criticality.CRITICAL,
 category: "Ransomware",
 tags: ["Ransomware", "Urgent", "Automated"],
 details: {
 vector: "Phishing suspecté (Email RH)",
 targets: "245 fichiers chiffrés en 30 secondes",
 action: "Processus isolé, mais persistance détectée"
 }
 },
 {
 title: "FUITE DE DONNÉES : Accès BDD suspect",
 description: "<p><strong>Alerte DLP :</strong> Exfiltration de données détectée vers une IP inconnue (Chine) depuis le compte administrateur BDD.</p>",
 severity: Criticality.CRITICAL,
 category: "Fuite de Données",
 tags: ["DLP", "Insider Threat", "Exfiltration"],
 details: {
 vector: "Compte à privilèges compromis",
 targets: "Table 'Clients' (5000 records)",
 action: "Connexion bloquée par Firewall"
 }
 },
 {
 title: "INDISPONIBILITÉ : Saturation API",
 description: "<p><strong>Alerte WAF :</strong> Pic de trafic anormal (100k req/sec) sur l'API publique. Signature DDoS typique.</p>",
 severity: Criticality.HIGH,
 category: "Indisponibilité",
 tags: ["DDoS", "Availability", "Botnet"],
 details: {
 vector: "Botnet Mirai variant",
 targets: "Load Balancer Frontend",
 action: "Rate limiting activé, trafic mitigé"
 }
 }
];
