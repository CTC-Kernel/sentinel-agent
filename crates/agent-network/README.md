# agent-network

Surveillance reseau et decouverte pour le Sentinel GRC Agent.

## Presentation

Cette crate fournit la visibilite reseau et la detection de securite :

- **Collecte reseau** : Interfaces, connexions, routes, DNS
- **Detection de securite** : C2, crypto-minage, exfiltration de donnees
- **Decouverte d'appareils** : Scan ARP, ping sweep, classification des appareils
- **Synchronisation delta** : Synchronisation efficace de l'etat reseau

## Modules

### Collecteur

Collecte les informations d'etat du reseau :

- `interfaces` : Enumeration des interfaces reseau
- `connections` : Connexions TCP/UDP actives
- `routes` : Entrees de la table de routage
- `dns` : Configuration des serveurs DNS

### Detection

Detection des menaces de securite :

- `c2_detector` : Communication de type Command & Control
- `miner_detector` : Trafic de minage de crypto-monnaie
- `exfil_detector` : Schemas d'exfiltration de donnees
- `beaconing_detector` : Beaconing sortant suspect (intervalles reguliers)
- `dga_detector` : Detection d'algorithmes de generation de domaines (DGA)
- `port_scanner` : Activite suspecte sur les ports
- `rules` : Definitions des regles de detection

### Decouverte

Decouverte des appareils reseau :

- `arp_scanner` : Decouverte d'appareils basee sur ARP
- `ping_sweep` : Detection d'hotes par ICMP
- `device_resolver` : Recherche du fabricant par MAC et classification des appareils

### Synchronisation

Synchronisation efficace :

- `delta` : Calcul des deltas d'etat reseau
- `scheduler` : Planification intelligente de la collecte

## Utilisation

```rust
use agent_network::{NetworkManager, DiscoveryConfig};

let manager = NetworkManager::new();

// Collecter un instantane reseau
let snapshot = manager.collect_snapshot().await?;

// Executer la detection de securite
let alerts = manager.detect_threats(&snapshot).await?;

// Decouvrir les appareils
let config = DiscoveryConfig::default();
let devices = manager.discover_devices(&config).await?;
```

## Alertes de securite

| Type d'alerte | Description |
|---------------|-------------|
| C2Communication | Trafic Command & Control detecte |
| CryptoMining | Activite de minage de crypto-monnaie |
| DataExfiltration | Vol potentiel de donnees |
| SuspiciousPort | Utilisation inhabituelle de ports sortants |
| MaliciousDestination | Connexion vers une IP malveillante connue |
| DnsTunneling | Canal couvert base sur DNS |
| AnonymizationNetwork | Utilisation de Tor/proxy |
| ConnectionAnomaly | Schemas de connexion inhabituels |

## Types d'appareils

Les appareils decouverts sont classes comme :

- Routeur, Switch, Serveur, Poste de travail
- Imprimante, IoT, Telephone, Inconnu
