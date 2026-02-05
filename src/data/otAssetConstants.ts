/**
 * OT/ICS Asset Constants
 * Story 36-1: OT Asset Import Wizard
 *
 * Constants for OT (Operational Technology) asset management
 * including protocols, manufacturers, device types, and network segments.
 */

// ============================================================================
// Network Segments
// ============================================================================

export const NETWORK_SEGMENTS = ['IT', 'OT', 'DMZ'] as const;

export const NETWORK_SEGMENT_LABELS: Record<string, { fr: string; en: string }> = {
 IT: { fr: 'Réseau IT', en: 'IT Network' },
 OT: { fr: 'Réseau OT', en: 'OT Network' },
 DMZ: { fr: 'Zone démilitarisée', en: 'Demilitarized Zone' }
};

export const NETWORK_SEGMENT_DESCRIPTIONS: Record<string, { fr: string; en: string }> = {
 IT: {
 fr: 'Réseau informatique de l\'entreprise avec accès Internet',
 en: 'Corporate IT network with Internet access'
 },
 OT: {
 fr: 'Réseau industriel isolé sans accès direct à Internet',
 en: 'Isolated industrial network with no direct Internet access'
 },
 DMZ: {
 fr: 'Zone intermédiaire entre réseaux IT et OT',
 en: 'Intermediate zone between IT and OT networks'
 }
};

// ============================================================================
// OT Criticality Levels
// ============================================================================

export const OT_CRITICALITY_LEVELS = ['safety', 'production', 'operations', 'monitoring'] as const;

export const OT_CRITICALITY_LABELS: Record<string, { fr: string; en: string }> = {
 safety: { fr: 'Sécurité', en: 'Safety' },
 production: { fr: 'Production', en: 'Production' },
 operations: { fr: 'Opérations', en: 'Operations' },
 monitoring: { fr: 'Surveillance', en: 'Monitoring' }
};

export const OT_CRITICALITY_DESCRIPTIONS: Record<string, { fr: string; en: string }> = {
 safety: {
 fr: 'Systèmes critiques pour la sécurité (SIS, ESD, arrêts d\'urgence)',
 en: 'Safety-critical systems (SIS, ESD, emergency shutdowns)'
 },
 production: {
 fr: 'Systèmes affectant directement la production',
 en: 'Systems directly affecting production'
 },
 operations: {
 fr: 'Interfaces opérateur, historiques, supervision',
 en: 'Operator interfaces, historians, supervision'
 },
 monitoring: {
 fr: 'Capteurs et dispositifs de surveillance non critiques',
 en: 'Sensors and non-critical monitoring devices'
 }
};

export const OT_CRITICALITY_COLORS: Record<string, string> = {
 safety: '#dc2626', // red-600
 production: '#ea580c', // orange-600
 operations: '#ca8a04', // yellow-600
 monitoring: '#16a34a' // green-600
};

// ============================================================================
// OT Protocols
// ============================================================================

export const OT_PROTOCOLS = [
 'Modbus',
 'OPC-UA',
 'BACnet',
 'DNP3',
 'EtherNet/IP',
 'Profinet',
 'Profibus',
 'HART',
 'Foundation Fieldbus',
 'CAN',
 'Other'
] as const;

export const OT_PROTOCOL_DESCRIPTIONS: Record<string, { fr: string; en: string }> = {
 'Modbus': {
 fr: 'Protocole série industriel standard (TCP/RTU)',
 en: 'Standard industrial serial protocol (TCP/RTU)'
 },
 'OPC-UA': {
 fr: 'Open Platform Communications Unified Architecture',
 en: 'Open Platform Communications Unified Architecture'
 },
 'BACnet': {
 fr: 'Protocole pour automatisation de bâtiments',
 en: 'Building Automation and Control Networks'
 },
 'DNP3': {
 fr: 'Distributed Network Protocol (utilities)',
 en: 'Distributed Network Protocol (utilities)'
 },
 'EtherNet/IP': {
 fr: 'Ethernet Industriel (Rockwell/ODVA)',
 en: 'Industrial Ethernet (Rockwell/ODVA)'
 },
 'Profinet': {
 fr: 'Ethernet Industriel (Siemens)',
 en: 'Industrial Ethernet (Siemens)'
 },
 'Profibus': {
 fr: 'Protocole de terrain process (Siemens)',
 en: 'Process field bus (Siemens)'
 },
 'HART': {
 fr: 'Highway Addressable Remote Transducer',
 en: 'Highway Addressable Remote Transducer'
 },
 'Foundation Fieldbus': {
 fr: 'Protocole de terrain digital',
 en: 'Digital fieldbus protocol'
 },
 'CAN': {
 fr: 'Controller Area Network',
 en: 'Controller Area Network'
 },
 'Other': {
 fr: 'Autre protocole',
 en: 'Other protocol'
 }
};

// ============================================================================
// OT Device Types
// ============================================================================

export const OT_DEVICE_TYPES = [
 'PLC',
 'RTU',
 'DCS',
 'HMI',
 'SCADA',
 'Historian',
 'Industrial Switch',
 'Industrial Firewall',
 'Safety System',
 'Sensor',
 'Actuator',
 'Drive/VFD',
 'Other'
] as const;

export const OT_DEVICE_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
 'PLC': { fr: 'Automate programmable (PLC)', en: 'Programmable Logic Controller' },
 'RTU': { fr: 'Unité terminale distante (RTU)', en: 'Remote Terminal Unit' },
 'DCS': { fr: 'Système de contrôle distribué', en: 'Distributed Control System' },
 'HMI': { fr: 'Interface homme-machine', en: 'Human Machine Interface' },
 'SCADA': { fr: 'Système SCADA', en: 'SCADA System' },
 'Historian': { fr: 'Historique de données', en: 'Data Historian' },
 'Industrial Switch': { fr: 'Switch industriel', en: 'Industrial Switch' },
 'Industrial Firewall': { fr: 'Pare-feu industriel', en: 'Industrial Firewall' },
 'Safety System': { fr: 'Système de sécurité (SIS)', en: 'Safety Instrumented System' },
 'Sensor': { fr: 'Capteur', en: 'Sensor' },
 'Actuator': { fr: 'Actionneur', en: 'Actuator' },
 'Drive/VFD': { fr: 'Variateur de fréquence', en: 'Variable Frequency Drive' },
 'Other': { fr: 'Autre', en: 'Other' }
};

// ============================================================================
// OT Manufacturers
// ============================================================================

export const OT_MANUFACTURERS = [
 'Siemens',
 'Schneider Electric',
 'Rockwell Automation',
 'ABB',
 'Honeywell',
 'Emerson',
 'Yokogawa',
 'GE Digital',
 'Mitsubishi Electric',
 'Omron',
 'Beckhoff',
 'Phoenix Contact',
 'WAGO',
 'Cisco',
 'Fortinet',
 'Palo Alto Networks',
 'Moxa',
 'Hirschmann',
 'Other'
] as const;

// ============================================================================
// CSV Import Column Mappings
// ============================================================================

export const OT_CSV_COLUMN_MAPPINGS: Record<string, string[]> = {
 name: ['name', 'nom', 'asset_name', 'device_name', 'equipment', 'equipement'],
 deviceType: ['type', 'device_type', 'ot_type', 'equipment_type', 'category'],
 protocol: ['protocol', 'protocole', 'comm_protocol', 'communication'],
 manufacturer: ['manufacturer', 'fabricant', 'vendor', 'fournisseur', 'brand', 'marque'],
 model: ['model', 'modele', 'part_number', 'product'],
 firmwareVersion: ['firmware', 'firmware_version', 'version', 'sw_version', 'software'],
 networkSegment: ['segment', 'network_segment', 'zone', 'network', 'reseau'],
 otCriticality: ['criticality', 'criticite', 'ot_criticality', 'priority', 'importance'],
 ipAddress: ['ip', 'ip_address', 'adresse_ip', 'address'],
 location: ['location', 'emplacement', 'site', 'zone_physique', 'building'],
 vlan: ['vlan', 'vlan_id'],
 subnet: ['subnet', 'sous_reseau', 'network_address'],
 notes: ['notes', 'description', 'comments', 'remarques']
};

// ============================================================================
// CSV Template
// ============================================================================

export const OT_CSV_TEMPLATE_HEADERS = [
 'name',
 'device_type',
 'protocol',
 'manufacturer',
 'model',
 'firmware_version',
 'network_segment',
 'ot_criticality',
 'ip_address',
 'location',
 'vlan',
 'subnet',
 'notes'
];

export const OT_CSV_TEMPLATE_EXAMPLE = [
 'PLC-001',
 'PLC',
 'Modbus',
 'Siemens',
 'S7-1500',
 'V2.8.3',
 'OT',
 'production',
 '192.168.100.10',
 'Building A - Production Line 1',
 '100',
 '192.168.100.0/24',
 'Main production controller'
];

/**
 * Generate CSV template content
 */
export function generateOTCSVTemplate(): string {
 const header = OT_CSV_TEMPLATE_HEADERS.join(',');
 const example = OT_CSV_TEMPLATE_EXAMPLE.join(',');
 return `${header}\n${example}`;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate if a value is a valid network segment
 */
export function isValidNetworkSegment(value: string): boolean {
 return NETWORK_SEGMENTS.includes(value as typeof NETWORK_SEGMENTS[number]);
}

/**
 * Validate if a value is a valid OT criticality
 */
export function isValidOTCriticality(value: string): boolean {
 return OT_CRITICALITY_LEVELS.includes(value.toLowerCase() as typeof OT_CRITICALITY_LEVELS[number]);
}

/**
 * Validate if a value is a valid OT protocol
 */
export function isValidOTProtocol(value: string): boolean {
 return OT_PROTOCOLS.includes(value as typeof OT_PROTOCOLS[number]);
}

/**
 * Validate if a value is a valid OT device type
 */
export function isValidOTDeviceType(value: string): boolean {
 return OT_DEVICE_TYPES.includes(value as typeof OT_DEVICE_TYPES[number]);
}

/**
 * Normalize network segment value
 */
export function normalizeNetworkSegment(value: string): string | null {
 const upper = value.toUpperCase().trim();
 if (upper === 'IT' || upper === 'OT' || upper === 'DMZ') return upper;
 if (upper === 'CORPORATE' || upper === 'ENTREPRISE') return 'IT';
 if (upper === 'INDUSTRIAL' || upper === 'INDUSTRIEL') return 'OT';
 return null;
}

/**
 * Normalize OT criticality value
 */
export function normalizeOTCriticality(value: string): string | null {
 const lower = value.toLowerCase().trim();
 if (OT_CRITICALITY_LEVELS.includes(lower as typeof OT_CRITICALITY_LEVELS[number])) {
 return lower;
 }
 // French equivalents
 if (lower === 'sécurité' || lower === 'securite' || lower === 'critique') return 'safety';
 if (lower === 'opérations' || lower === 'operations') return 'operations';
 if (lower === 'surveillance') return 'monitoring';
 return null;
}
