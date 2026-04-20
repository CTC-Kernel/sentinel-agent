# agent-siem

Integration SIEM pour le Sentinel GRC Agent.

## Presentation

Cette crate fournit un framework de connecteurs SIEM pour l'export d'evenements de securite vers les plateformes de supervision :

- **Formats multiples** : CEF (ArcSight), LEEF (IBM QRadar), JSON (Splunk/Elastic/Azure)
- **Transports flexibles** : Syslog RFC 5424 (UDP/TCP/TLS), HTTP/HTTPS
- **Collecte et correlation** : Agregation d'evenements et correlation d'alertes
- **Buffer circulaire** : Conservation des 100 derniers evenements pour reporting plateforme

## Plateformes supportees

| Plateforme | Format | Transport |
|------------|--------|-----------|
| **Splunk** | JSON | HTTP Event Collector (HEC) |
| **Microsoft Sentinel** | JSON | Azure Monitor HTTP |
| **ELK Stack** | JSON | Elasticsearch HTTP |
| **ArcSight** | CEF | Syslog |
| **IBM QRadar** | LEEF / CEF | Syslog |
| **Generique** | JSON / CEF / LEEF | Syslog (RFC 5424) |

## Modules

| Module | Description |
|--------|-------------|
| `collector` | `LogCollector` pour la collecte d'evenements multi-sources |
| `correlation` | `CorrelationEngine` pour la correlation et l'enrichissement d'alertes |
| `formats/cef` | Formateur Common Event Format (ArcSight) |
| `formats/leef` | Formateur Log Event Extended Format (IBM QRadar) |
| `formats/json` | Formateur JSON generique |
| `transports/syslog` | Transport Syslog RFC 5424 (UDP/TCP/TLS) |
| `transports/http` | Transport HTTP/HTTPS avec authentification |

## Categories d'evenements

| Categorie | Description |
|-----------|-------------|
| Compliance | Resultats de controles de conformite |
| Security | Alertes et incidents de securite |
| Network | Evenements reseau (connexions, decouverte) |
| FileIntegrity | Alertes FIM (modifications de fichiers) |
| System | Evenements systeme (ressources, services) |
| Authentication | Evenements d'authentification |
| Configuration | Changements de configuration |
| Vulnerability | Vulnerabilites detectees (CVE) |

## Configuration

```json
{
  "siem": {
    "enabled": true,
    "format": "json",
    "transport": {
      "type": "http",
      "url": "https://splunk.company.com:8088/services/collector",
      "auth_token": "your-hec-token",
      "verify_tls": true
    },
    "batch_size": 50,
    "flush_interval_secs": 30,
    "min_severity": 3,
    "include_categories": ["Security", "Compliance", "FileIntegrity"]
  }
}
```

## Utilisation

```rust
use agent_siem::{SiemForwarder, SiemConfig, SiemEvent};

// Creer le forwarder
let config = SiemConfig::load()?;
let forwarder = SiemForwarder::new(config).await?;

// Envoyer un evenement
let event = SiemEvent::new(severity, category, message);
forwarder.send_event(event).await?;

// Ou en mode batch
forwarder.queue_event(event);
forwarder.flush().await?;

// Statistiques
let stats = forwarder.stats();
println!("Envoyes: {}, Rejetes: {}", stats.events_sent, stats.events_dropped);
```

## Statistiques

Le `SiemForwarder` maintient des statistiques en temps reel :

- `events_sent` : Nombre d'evenements transmis
- `events_dropped` : Nombre d'evenements rejetes
- `bytes_sent` : Volume de donnees transmis
- `last_success` : Derniere transmission reussie
- `last_error` : Derniere erreur rencontree
- `is_connected` : Statut de connexion
