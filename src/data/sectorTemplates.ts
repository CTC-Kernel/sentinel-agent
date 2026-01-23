/**
 * Sector-specific control templates for accelerated onboarding
 * Each sector has pre-selected frameworks, prioritized controls, and specific requirements
 *
 * @see Story EU-4.4: Sector Templates
 */

import { Framework } from '../types';

export type IndustryType = 'tech' | 'finance' | 'health' | 'retail' | 'public' | 'industrie' | 'other';

export interface SectorControlPriority {
    code: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    reason: string;
}

export interface SectorTemplate {
    id: IndustryType;
    nameKey: string;
    descriptionKey: string;
    recommendedFrameworks: Framework[];
    mandatoryFrameworks: Framework[];
    controlPriorities: SectorControlPriority[];
    specificRequirements: {
        key: string;
        descriptionKey: string;
    }[];
    regulatoryContext: {
        key: string;
        url?: string;
    }[];
}

/**
 * Finance sector template (DORA + NIS2 + PCI-DSS focused)
 * For banks, insurance, investment firms, payment services
 */
const FINANCE_TEMPLATE: SectorTemplate = {
    id: 'finance',
    nameKey: 'sectors.finance.name',
    descriptionKey: 'sectors.finance.description',
    recommendedFrameworks: ['ISO27001', 'DORA', 'NIS2', 'GDPR', 'PCI_DSS'],
    mandatoryFrameworks: ['DORA', 'NIS2'],
    controlPriorities: [
        // DORA Critical Controls
        { code: 'DORA.1.1', priority: 'critical', reason: 'sectors.finance.dora_governance' },
        { code: 'DORA.1.2', priority: 'critical', reason: 'sectors.finance.ict_risk' },
        { code: 'DORA.2.1', priority: 'critical', reason: 'sectors.finance.incident_mgmt' },
        { code: 'DORA.2.2', priority: 'critical', reason: 'sectors.finance.incident_class' },
        { code: 'DORA.2.3', priority: 'critical', reason: 'sectors.finance.incident_notif' },
        { code: 'DORA.3.1', priority: 'critical', reason: 'sectors.finance.resilience_test' },
        { code: 'DORA.3.2', priority: 'critical', reason: 'sectors.finance.tlpt' },
        { code: 'DORA.4.1', priority: 'critical', reason: 'sectors.finance.third_party' },
        { code: 'DORA.4.2', priority: 'high', reason: 'sectors.finance.contracts' },
        { code: 'DORA.4.3', priority: 'high', reason: 'sectors.finance.provider_monitoring' },

        // NIS2 High Priority for Finance
        { code: 'NIS2.1.1', priority: 'high', reason: 'sectors.finance.nis2_policies' },
        { code: 'NIS2.1.2', priority: 'high', reason: 'sectors.finance.risk_analysis' },
        { code: 'NIS2.4.4', priority: 'critical', reason: 'sectors.finance.incident_reporting' },

        // PCI-DSS for payment processing
        { code: 'PCI.2.1', priority: 'critical', reason: 'sectors.finance.card_protection' },
        { code: 'PCI.2.2', priority: 'critical', reason: 'sectors.finance.encryption_transit' },
        { code: 'PCI.4.1', priority: 'high', reason: 'sectors.finance.access_restriction' },
        { code: 'PCI.5.1', priority: 'high', reason: 'sectors.finance.logging' },

        // ISO 27001 foundations
        { code: 'A.5.1', priority: 'high', reason: 'sectors.finance.policies' },
        { code: 'A.5.19', priority: 'high', reason: 'sectors.finance.supplier_security' },
        { code: 'A.5.24', priority: 'critical', reason: 'sectors.finance.incident_planning' },
        { code: 'A.8.13', priority: 'critical', reason: 'sectors.finance.backups' },
        { code: 'A.8.24', priority: 'critical', reason: 'sectors.finance.cryptography' },
    ],
    specificRequirements: [
        { key: 'dora_ror', descriptionKey: 'sectors.finance.req.ror' },
        { key: 'dora_exit_strategy', descriptionKey: 'sectors.finance.req.exit_strategy' },
        { key: 'incident_24h', descriptionKey: 'sectors.finance.req.incident_24h' },
        { key: 'tlpt_3y', descriptionKey: 'sectors.finance.req.tlpt_3y' },
        { key: 'concentration_risk', descriptionKey: 'sectors.finance.req.concentration_risk' },
    ],
    regulatoryContext: [
        { key: 'dora_regulation', url: 'https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32022R2554' },
        { key: 'nis2_directive', url: 'https://eur-lex.europa.eu/eli/dir/2022/2555' },
        { key: 'pci_dss', url: 'https://www.pcisecuritystandards.org/' },
    ],
};

/**
 * Healthcare sector template (HDS + RGPD focused)
 * For hospitals, clinics, health tech, pharma
 */
const HEALTH_TEMPLATE: SectorTemplate = {
    id: 'health',
    nameKey: 'sectors.health.name',
    descriptionKey: 'sectors.health.description',
    recommendedFrameworks: ['ISO27001', 'GDPR', 'HDS', 'NIS2'],
    mandatoryFrameworks: ['HDS', 'GDPR'],
    controlPriorities: [
        // HDS Critical Controls
        { code: 'HDS.1.1', priority: 'critical', reason: 'sectors.health.hds_policy' },
        { code: 'HDS.1.2', priority: 'critical', reason: 'sectors.health.rssi' },
        { code: 'HDS.1.3', priority: 'critical', reason: 'sectors.health.eivp' },
        { code: 'HDS.2.1', priority: 'critical', reason: 'sectors.health.patient_info' },
        { code: 'HDS.2.2', priority: 'critical', reason: 'sectors.health.consent' },
        { code: 'HDS.2.3', priority: 'high', reason: 'sectors.health.access_rights' },
        { code: 'HDS.3.1', priority: 'critical', reason: 'sectors.health.mfa' },
        { code: 'HDS.3.2', priority: 'critical', reason: 'sectors.health.encryption_rest' },
        { code: 'HDS.3.3', priority: 'critical', reason: 'sectors.health.encryption_transit' },
        { code: 'HDS.3.4', priority: 'high', reason: 'sectors.health.audit_trail' },
        { code: 'HDS.4.1', priority: 'critical', reason: 'sectors.health.backups' },
        { code: 'HDS.4.2', priority: 'critical', reason: 'sectors.health.pca' },
        { code: 'HDS.4.3', priority: 'high', reason: 'sectors.health.sla' },

        // RGPD critical for health data
        { code: 'GDPR.1.1', priority: 'critical', reason: 'sectors.health.dpo' },
        { code: 'GDPR.1.2', priority: 'critical', reason: 'sectors.health.treatment_registry' },
        { code: 'GDPR.1.3', priority: 'critical', reason: 'sectors.health.dpia' },
        { code: 'GDPR.2.1', priority: 'high', reason: 'sectors.health.person_info' },
        { code: 'GDPR.2.3', priority: 'high', reason: 'sectors.health.rights_exercise' },
        { code: 'GDPR.3.2', priority: 'critical', reason: 'sectors.health.breach_notif' },

        // ISO 27001 health-specific
        { code: 'A.5.12', priority: 'critical', reason: 'sectors.health.classification' },
        { code: 'A.5.34', priority: 'critical', reason: 'sectors.health.pii_protection' },
        { code: 'A.8.3', priority: 'high', reason: 'sectors.health.access_restriction' },
        { code: 'A.8.11', priority: 'high', reason: 'sectors.health.data_masking' },
        { code: 'A.8.15', priority: 'critical', reason: 'sectors.health.logging' },
    ],
    specificRequirements: [
        { key: 'hds_certification', descriptionKey: 'sectors.health.req.hds_cert' },
        { key: 'patient_consent', descriptionKey: 'sectors.health.req.consent' },
        { key: 'breach_72h', descriptionKey: 'sectors.health.req.breach_72h' },
        { key: 'dpo_mandatory', descriptionKey: 'sectors.health.req.dpo' },
        { key: 'france_hosting', descriptionKey: 'sectors.health.req.hosting' },
    ],
    regulatoryContext: [
        { key: 'hds_ref', url: 'https://esante.gouv.fr/produits-services/hds' },
        { key: 'rgpd_sante', url: 'https://www.cnil.fr/fr/sante' },
        { key: 'ans_ref', url: 'https://esante.gouv.fr/' },
    ],
};

/**
 * Tech/SaaS sector template (SOC2 + ISO 27001 focused)
 * For software companies, cloud providers, tech startups
 */
const TECH_TEMPLATE: SectorTemplate = {
    id: 'tech',
    nameKey: 'sectors.tech.name',
    descriptionKey: 'sectors.tech.description',
    recommendedFrameworks: ['ISO27001', 'SOC2', 'GDPR', 'NIS2'],
    mandatoryFrameworks: ['ISO27001'],
    controlPriorities: [
        // SOC2 Critical Controls
        { code: 'CC1.1', priority: 'critical', reason: 'sectors.tech.control_env' },
        { code: 'CC2.1', priority: 'critical', reason: 'sectors.tech.risk_mgmt' },
        { code: 'CC4.1', priority: 'critical', reason: 'sectors.tech.logical_physical' },
        { code: 'CC5.1', priority: 'high', reason: 'sectors.tech.system_ops' },
        { code: 'CC6.1', priority: 'critical', reason: 'sectors.tech.change_mgmt' },
        { code: 'CC7.1', priority: 'high', reason: 'sectors.tech.incident_mgmt' },
        { code: 'A1.1', priority: 'high', reason: 'sectors.tech.capacity' },
        { code: 'A1.2', priority: 'critical', reason: 'sectors.tech.backup_recovery' },

        // ISO 27001 DevSecOps focus
        { code: 'A.5.8', priority: 'high', reason: 'sectors.tech.project_security' },
        { code: 'A.5.23', priority: 'critical', reason: 'sectors.tech.cloud_security' },
        { code: 'A.8.4', priority: 'critical', reason: 'sectors.tech.source_code' },
        { code: 'A.8.8', priority: 'critical', reason: 'sectors.tech.vuln_mgmt' },
        { code: 'A.8.9', priority: 'high', reason: 'sectors.tech.config_mgmt' },
        { code: 'A.8.25', priority: 'critical', reason: 'sectors.tech.sdlc' },
        { code: 'A.8.26', priority: 'critical', reason: 'sectors.tech.app_security' },
        { code: 'A.8.27', priority: 'high', reason: 'sectors.tech.secure_arch' },
        { code: 'A.8.28', priority: 'critical', reason: 'sectors.tech.secure_coding' },
        { code: 'A.8.29', priority: 'high', reason: 'sectors.tech.security_tests' },
        { code: 'A.8.31', priority: 'critical', reason: 'sectors.tech.env_separation' },
        { code: 'A.8.32', priority: 'critical', reason: 'sectors.tech.change_control' },

        // RGPD for user data
        { code: 'GDPR.1.4', priority: 'critical', reason: 'sectors.tech.privacy_by_design' },
        { code: 'GDPR.2.2', priority: 'high', reason: 'sectors.tech.consent_mgmt' },
        { code: 'GDPR.4.1', priority: 'high', reason: 'sectors.tech.subprocessor' },
    ],
    specificRequirements: [
        { key: 'soc2_type2', descriptionKey: 'sectors.tech.req.soc2_type2' },
        { key: 'pentest_annual', descriptionKey: 'sectors.tech.req.pentest' },
        { key: 'bug_bounty', descriptionKey: 'sectors.tech.req.bug_bounty' },
        { key: 'sla_uptime', descriptionKey: 'sectors.tech.req.sla' },
        { key: 'dpa_standard', descriptionKey: 'sectors.tech.req.dpa' },
    ],
    regulatoryContext: [
        { key: 'soc2_aicpa', url: 'https://www.aicpa.org/soc2' },
        { key: 'iso27001', url: 'https://www.iso.org/isoiec-27001-information-security.html' },
        { key: 'ai_act', url: 'https://artificialintelligenceact.eu/' },
    ],
};

/**
 * Industry/Manufacturing sector template (NIS2 + OT Security focused)
 * For manufacturing, energy, utilities, critical infrastructure
 */
const INDUSTRIE_TEMPLATE: SectorTemplate = {
    id: 'industrie',
    nameKey: 'sectors.industrie.name',
    descriptionKey: 'sectors.industrie.description',
    recommendedFrameworks: ['ISO27001', 'NIS2', 'ISO22301', 'NIST_CSF'],
    mandatoryFrameworks: ['NIS2'],
    controlPriorities: [
        // NIS2 Critical for OES
        { code: 'NIS2.1.1', priority: 'critical', reason: 'sectors.industrie.nis2_policies' },
        { code: 'NIS2.1.2', priority: 'critical', reason: 'sectors.industrie.risk_analysis' },
        { code: 'NIS2.1.3', priority: 'critical', reason: 'sectors.industrie.mgmt_approval' },
        { code: 'NIS2.2.1', priority: 'critical', reason: 'sectors.industrie.supply_chain' },
        { code: 'NIS2.2.3', priority: 'critical', reason: 'sectors.industrie.vuln_mgmt' },
        { code: 'NIS2.3.1', priority: 'critical', reason: 'sectors.industrie.hygiene' },
        { code: 'NIS2.3.4', priority: 'critical', reason: 'sectors.industrie.access_control' },
        { code: 'NIS2.3.5', priority: 'critical', reason: 'sectors.industrie.asset_mgmt' },
        { code: 'NIS2.4.1', priority: 'critical', reason: 'sectors.industrie.incident_mgmt' },
        { code: 'NIS2.4.2', priority: 'critical', reason: 'sectors.industrie.continuity' },
        { code: 'NIS2.4.4', priority: 'critical', reason: 'sectors.industrie.incident_report' },

        // ISO 22301 for BCP
        { code: 'ISO22301.8.2', priority: 'critical', reason: 'sectors.industrie.bia' },
        { code: 'ISO22301.8.4', priority: 'critical', reason: 'sectors.industrie.bc_strategies' },
        { code: 'ISO22301.8.5', priority: 'critical', reason: 'sectors.industrie.bc_plans' },

        // NIST CSF for OT
        { code: 'ID.AM-01', priority: 'critical', reason: 'sectors.industrie.physical_inventory' },
        { code: 'ID.AM-02', priority: 'critical', reason: 'sectors.industrie.software_inventory' },
        { code: 'PR.AC-01', priority: 'high', reason: 'sectors.industrie.iam' },
        { code: 'DE.CM-01', priority: 'critical', reason: 'sectors.industrie.network_monitor' },

        // ISO 27001 OT-specific
        { code: 'A.5.9', priority: 'critical', reason: 'sectors.industrie.asset_inventory' },
        { code: 'A.7.1', priority: 'high', reason: 'sectors.industrie.physical_perimeter' },
        { code: 'A.7.4', priority: 'high', reason: 'sectors.industrie.physical_monitoring' },
        { code: 'A.8.20', priority: 'critical', reason: 'sectors.industrie.network_security' },
        { code: 'A.8.22', priority: 'critical', reason: 'sectors.industrie.network_segregation' },
    ],
    specificRequirements: [
        { key: 'ot_it_segmentation', descriptionKey: 'sectors.industrie.req.segmentation' },
        { key: 'scada_security', descriptionKey: 'sectors.industrie.req.scada' },
        { key: 'incident_24h_anssi', descriptionKey: 'sectors.industrie.req.anssi_notif' },
        { key: 'bc_testing', descriptionKey: 'sectors.industrie.req.bc_test' },
        { key: 'supply_chain_audit', descriptionKey: 'sectors.industrie.req.supply_audit' },
    ],
    regulatoryContext: [
        { key: 'nis2_oiv', url: 'https://eur-lex.europa.eu/eli/dir/2022/2555' },
        { key: 'anssi_oiv', url: 'https://www.ssi.gouv.fr/entreprise/protection-des-oiv/' },
        { key: 'iec62443', url: 'https://www.isa.org/iec-62443/' },
    ],
};

/**
 * Public sector template (RGS + ANSSI Homologation focused)
 * For government agencies, local authorities, public services
 */
const PUBLIC_TEMPLATE: SectorTemplate = {
    id: 'public',
    nameKey: 'sectors.public.name',
    descriptionKey: 'sectors.public.description',
    recommendedFrameworks: ['ISO27001', 'GDPR', 'NIS2', 'EBIOS'],
    mandatoryFrameworks: ['GDPR'],
    controlPriorities: [
        // RGPD mandatory for public services
        { code: 'GDPR.1.1', priority: 'critical', reason: 'sectors.public.dpo' },
        { code: 'GDPR.1.2', priority: 'critical', reason: 'sectors.public.treatment_registry' },
        { code: 'GDPR.1.3', priority: 'critical', reason: 'sectors.public.dpia' },
        { code: 'GDPR.2.1', priority: 'critical', reason: 'sectors.public.citizen_info' },
        { code: 'GDPR.2.3', priority: 'critical', reason: 'sectors.public.citizen_rights' },
        { code: 'GDPR.3.1', priority: 'high', reason: 'sectors.public.security_measures' },
        { code: 'GDPR.3.2', priority: 'critical', reason: 'sectors.public.breach_notif' },

        // ISO 27001 RGS alignment
        { code: 'A.5.1', priority: 'critical', reason: 'sectors.public.pssi' },
        { code: 'A.5.2', priority: 'critical', reason: 'sectors.public.roles' },
        { code: 'A.5.5', priority: 'high', reason: 'sectors.public.authority_contact' },
        { code: 'A.5.12', priority: 'critical', reason: 'sectors.public.classification' },
        { code: 'A.5.15', priority: 'critical', reason: 'sectors.public.access_control' },
        { code: 'A.5.16', priority: 'critical', reason: 'sectors.public.identity_mgmt' },
        { code: 'A.5.17', priority: 'critical', reason: 'sectors.public.auth_info' },
        { code: 'A.5.24', priority: 'high', reason: 'sectors.public.incident_planning' },
        { code: 'A.5.35', priority: 'high', reason: 'sectors.public.independent_review' },
        { code: 'A.6.3', priority: 'high', reason: 'sectors.public.awareness' },
        { code: 'A.8.5', priority: 'critical', reason: 'sectors.public.secure_auth' },
        { code: 'A.8.13', priority: 'critical', reason: 'sectors.public.backups' },
        { code: 'A.8.15', priority: 'critical', reason: 'sectors.public.logging' },
        { code: 'A.8.24', priority: 'high', reason: 'sectors.public.cryptography' },
    ],
    specificRequirements: [
        { key: 'homologation_anssi', descriptionKey: 'sectors.public.req.homologation' },
        { key: 'rgs_compliance', descriptionKey: 'sectors.public.req.rgs' },
        { key: 'secnumcloud', descriptionKey: 'sectors.public.req.secnumcloud' },
        { key: 'dpo_mandatory', descriptionKey: 'sectors.public.req.dpo' },
        { key: 'ebios_rm', descriptionKey: 'sectors.public.req.ebios' },
    ],
    regulatoryContext: [
        { key: 'rgs_anssi', url: 'https://www.ssi.gouv.fr/entreprise/reglementation/confiance-numerique/le-referentiel-general-de-securite-rgs/' },
        { key: 'homologation_guide', url: 'https://www.ssi.gouv.fr/guide/lhomologation-de-securite-en-neuf-etapes-simples/' },
        { key: 'secnumcloud', url: 'https://www.ssi.gouv.fr/entreprise/qualifications/prestataires-de-services-de-confiance-qualifies/prestataires-de-service-dinformatique-en-nuage-secnumcloud/' },
    ],
};

/**
 * Retail sector template (PCI-DSS + RGPD focused)
 * For e-commerce, retail chains, marketplaces
 */
const RETAIL_TEMPLATE: SectorTemplate = {
    id: 'retail',
    nameKey: 'sectors.retail.name',
    descriptionKey: 'sectors.retail.description',
    recommendedFrameworks: ['ISO27001', 'GDPR', 'PCI_DSS', 'SOC2'],
    mandatoryFrameworks: ['PCI_DSS', 'GDPR'],
    controlPriorities: [
        // PCI-DSS for payment
        { code: 'PCI.1.1', priority: 'critical', reason: 'sectors.retail.firewall' },
        { code: 'PCI.1.2', priority: 'critical', reason: 'sectors.retail.no_defaults' },
        { code: 'PCI.2.1', priority: 'critical', reason: 'sectors.retail.card_storage' },
        { code: 'PCI.2.2', priority: 'critical', reason: 'sectors.retail.encryption' },
        { code: 'PCI.3.1', priority: 'high', reason: 'sectors.retail.malware' },
        { code: 'PCI.3.2', priority: 'high', reason: 'sectors.retail.secure_systems' },
        { code: 'PCI.4.1', priority: 'critical', reason: 'sectors.retail.access_need' },
        { code: 'PCI.4.2', priority: 'critical', reason: 'sectors.retail.auth' },
        { code: 'PCI.5.1', priority: 'critical', reason: 'sectors.retail.logging' },
        { code: 'PCI.5.2', priority: 'high', reason: 'sectors.retail.security_tests' },
        { code: 'PCI.6.1', priority: 'high', reason: 'sectors.retail.policy' },

        // RGPD for customer data
        { code: 'GDPR.1.2', priority: 'critical', reason: 'sectors.retail.treatment_registry' },
        { code: 'GDPR.1.4', priority: 'high', reason: 'sectors.retail.privacy_by_design' },
        { code: 'GDPR.2.1', priority: 'critical', reason: 'sectors.retail.customer_info' },
        { code: 'GDPR.2.2', priority: 'critical', reason: 'sectors.retail.consent' },
        { code: 'GDPR.2.3', priority: 'high', reason: 'sectors.retail.customer_rights' },
        { code: 'GDPR.3.2', priority: 'critical', reason: 'sectors.retail.breach_notif' },
        { code: 'GDPR.4.1', priority: 'high', reason: 'sectors.retail.subprocessor' },

        // ISO 27001 e-commerce focus
        { code: 'A.5.23', priority: 'high', reason: 'sectors.retail.cloud_security' },
        { code: 'A.8.20', priority: 'high', reason: 'sectors.retail.network_security' },
        { code: 'A.8.23', priority: 'high', reason: 'sectors.retail.web_filtering' },
        { code: 'A.8.26', priority: 'critical', reason: 'sectors.retail.app_security' },
    ],
    specificRequirements: [
        { key: 'pci_saq', descriptionKey: 'sectors.retail.req.saq' },
        { key: 'cookie_consent', descriptionKey: 'sectors.retail.req.cookies' },
        { key: 'marketing_consent', descriptionKey: 'sectors.retail.req.marketing' },
        { key: 'payment_provider', descriptionKey: 'sectors.retail.req.psp' },
        { key: 'fraud_detection', descriptionKey: 'sectors.retail.req.fraud' },
    ],
    regulatoryContext: [
        { key: 'pci_dss', url: 'https://www.pcisecuritystandards.org/' },
        { key: 'cnil_ecommerce', url: 'https://www.cnil.fr/fr/e-commerce' },
        { key: 'dsa_dma', url: 'https://digital-strategy.ec.europa.eu/en/policies/digital-services-act-package' },
    ],
};

/**
 * Generic template for other industries
 * Baseline ISO 27001 + RGPD compliance
 */
const OTHER_TEMPLATE: SectorTemplate = {
    id: 'other',
    nameKey: 'sectors.other.name',
    descriptionKey: 'sectors.other.description',
    recommendedFrameworks: ['ISO27001', 'GDPR'],
    mandatoryFrameworks: [],
    controlPriorities: [
        // ISO 27001 baseline
        { code: 'A.5.1', priority: 'high', reason: 'sectors.other.policies' },
        { code: 'A.5.2', priority: 'high', reason: 'sectors.other.roles' },
        { code: 'A.5.9', priority: 'high', reason: 'sectors.other.asset_inventory' },
        { code: 'A.5.12', priority: 'medium', reason: 'sectors.other.classification' },
        { code: 'A.5.15', priority: 'high', reason: 'sectors.other.access_control' },
        { code: 'A.5.24', priority: 'high', reason: 'sectors.other.incident_planning' },
        { code: 'A.6.3', priority: 'medium', reason: 'sectors.other.awareness' },
        { code: 'A.8.5', priority: 'high', reason: 'sectors.other.secure_auth' },
        { code: 'A.8.7', priority: 'high', reason: 'sectors.other.malware' },
        { code: 'A.8.8', priority: 'high', reason: 'sectors.other.vuln_mgmt' },
        { code: 'A.8.13', priority: 'high', reason: 'sectors.other.backups' },
        { code: 'A.8.15', priority: 'medium', reason: 'sectors.other.logging' },
        { code: 'A.8.20', priority: 'medium', reason: 'sectors.other.network_security' },

        // RGPD baseline
        { code: 'GDPR.1.2', priority: 'high', reason: 'sectors.other.treatment_registry' },
        { code: 'GDPR.2.1', priority: 'high', reason: 'sectors.other.person_info' },
        { code: 'GDPR.3.1', priority: 'high', reason: 'sectors.other.security_measures' },
        { code: 'GDPR.3.2', priority: 'high', reason: 'sectors.other.breach_notif' },
    ],
    specificRequirements: [
        { key: 'basic_security', descriptionKey: 'sectors.other.req.basic' },
        { key: 'rgpd_compliance', descriptionKey: 'sectors.other.req.rgpd' },
    ],
    regulatoryContext: [
        { key: 'iso27001', url: 'https://www.iso.org/isoiec-27001-information-security.html' },
        { key: 'cnil', url: 'https://www.cnil.fr/' },
    ],
};

/**
 * All sector templates indexed by industry type
 */
export const SECTOR_TEMPLATES: Record<IndustryType, SectorTemplate> = {
    finance: FINANCE_TEMPLATE,
    health: HEALTH_TEMPLATE,
    tech: TECH_TEMPLATE,
    industrie: INDUSTRIE_TEMPLATE,
    public: PUBLIC_TEMPLATE,
    retail: RETAIL_TEMPLATE,
    other: OTHER_TEMPLATE,
};

/**
 * Get sector template by industry type
 */
export function getSectorTemplate(industry: IndustryType): SectorTemplate {
    return SECTOR_TEMPLATES[industry] || OTHER_TEMPLATE;
}

/**
 * Get recommended frameworks for an industry
 */
export function getRecommendedFrameworks(industry: IndustryType): Framework[] {
    const template = getSectorTemplate(industry);
    return template.recommendedFrameworks;
}

/**
 * Get mandatory frameworks for an industry
 */
export function getMandatoryFrameworks(industry: IndustryType): Framework[] {
    const template = getSectorTemplate(industry);
    return template.mandatoryFrameworks;
}

/**
 * Get prioritized controls for an industry
 * Returns controls sorted by priority (critical > high > medium > low)
 */
export function getPrioritizedControls(industry: IndustryType): SectorControlPriority[] {
    const template = getSectorTemplate(industry);
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    return [...template.controlPriorities].sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );
}

/**
 * Check if a control is critical for an industry
 */
export function isControlCritical(industry: IndustryType, controlCode: string): boolean {
    const template = getSectorTemplate(industry);
    const control = template.controlPriorities.find(c => c.code === controlCode);
    return control?.priority === 'critical';
}

/**
 * Get all industries that have a specific framework as mandatory
 */
export function getIndustriesRequiringFramework(framework: Framework): IndustryType[] {
    return Object.entries(SECTOR_TEMPLATES)
        .filter(([, template]) => template.mandatoryFrameworks.includes(framework))
        .map(([industry]) => industry as IndustryType);
}
