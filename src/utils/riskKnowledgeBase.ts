
export const RISK_KNOWLEDGE_BASE: Record<string, { threat: string; vulnerability: string; probability: number; impact: number; strategy: string }[]> = {
    'Serveur': [
        { threat: 'Panne matérielle', vulnerability: 'Absence de redondance', probability: 3, impact: 4, strategy: 'Atténuer' },
        { threat: 'Obsolescence OS', vulnerability: 'Fin de support éditeur', probability: 4, impact: 3, strategy: 'Atténuer' },
        { threat: 'Accès non autorisé', vulnerability: 'Mots de passe faibles', probability: 3, impact: 5, strategy: 'Atténuer' },
        { threat: 'Ransomware', vulnerability: 'Absence de protection EDR', probability: 4, impact: 5, strategy: 'Atténuer' }
    ],
    'Laptop': [
        { threat: 'Vol ou Perte', vulnerability: 'Absence de chiffrement disque', probability: 3, impact: 4, strategy: 'Atténuer' },
        { threat: 'Connexion Wi-Fi non sécurisée', vulnerability: 'Travail en mobilité', probability: 4, impact: 3, strategy: 'Atténuer' },
        { threat: 'Malware', vulnerability: 'Navigation web non filtrée', probability: 3, impact: 3, strategy: 'Atténuer' }
    ],
    'SaaS': [
        { threat: 'Fuite de données', vulnerability: 'Mauvaise configuration des droits', probability: 3, impact: 4, strategy: 'Atténuer' },
        { threat: 'Indisponibilité service', vulnerability: 'Dépendance fournisseur unique', probability: 2, impact: 4, strategy: 'Accepter' },
        { threat: 'Compromission de compte', vulnerability: 'Absence de MFA', probability: 4, impact: 5, strategy: 'Atténuer' }
    ],
    'Données': [
        { threat: 'Divulgation accidentelle', vulnerability: 'Erreur humaine', probability: 3, impact: 4, strategy: 'Atténuer' },
        { threat: 'Corruption de données', vulnerability: 'Absence de sauvegarde testée', probability: 2, impact: 5, strategy: 'Atténuer' },
        { threat: 'Vol de données', vulnerability: 'Exfiltration par un tiers', probability: 3, impact: 5, strategy: 'Atténuer' }
    ],
    'Réseau': [
        { threat: 'Intrusion réseau', vulnerability: 'Firewall mal configuré', probability: 3, impact: 5, strategy: 'Atténuer' },
        { threat: 'Déni de service (DDoS)', vulnerability: 'Absence de protection anti-DDoS', probability: 2, impact: 4, strategy: 'Transférer' },
        { threat: 'Interception trafic', vulnerability: 'Protocoles non chiffrés (HTTP/FTP)', probability: 3, impact: 4, strategy: 'Atténuer' }
    ],
    'Bâtiment': [
        { threat: 'Intrusion physique', vulnerability: 'Contrôle d\'accès défaillant', probability: 2, impact: 4, strategy: 'Atténuer' },
        { threat: 'Incendie', vulnerability: 'Système détection défaillant', probability: 1, impact: 5, strategy: 'Transférer' },
        { threat: 'Dégât des eaux', vulnerability: 'Proximité zone inondable', probability: 2, impact: 4, strategy: 'Atténuer' }
    ]
};

export const getSuggestionsForAsset = (assetType: string) => {
    // Normalize type matching
    const normalizedType = Object.keys(RISK_KNOWLEDGE_BASE).find(k => assetType.toLowerCase().includes(k.toLowerCase()));
    return normalizedType ? RISK_KNOWLEDGE_BASE[normalizedType] : [];
};
