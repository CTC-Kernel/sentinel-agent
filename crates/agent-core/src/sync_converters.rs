//! Conversion functions from GUI DTOs to sync payloads.

use agent_gui::dto::{
    AlertRule, DetectionRule, ManagedAsset, Playbook, RiskEntry, WebhookConfig,
};
use agent_sync::{
    AlertRulePayload, AssetPayload, DetectionConditionPayload, DetectionRulePayload,
    PlaybookActionPayload, PlaybookConditionPayload, PlaybookPayload, RiskPayload,
    WebhookPayload,
};

pub fn playbook_to_payload(p: &Playbook) -> PlaybookPayload {
    PlaybookPayload {
        id: p.id.to_string(),
        name: p.name.clone(),
        description: p.description.clone(),
        enabled: p.enabled,
        conditions: p
            .conditions
            .iter()
            .map(|c| PlaybookConditionPayload {
                condition_type: c.condition_type.as_str().to_string(),
                operator: c.operator.clone(),
                value: c.value.clone(),
            })
            .collect(),
        actions: p
            .actions
            .iter()
            .map(|a| PlaybookActionPayload {
                action_type: a.action_type.as_str().to_string(),
                parameters: a.parameters.clone(),
            })
            .collect(),
        created_at: p.created_at,
        last_triggered: p.last_triggered,
        trigger_count: p.trigger_count,
    }
}

pub fn detection_rule_to_payload(r: &DetectionRule) -> DetectionRulePayload {
    DetectionRulePayload {
        id: r.id.to_string(),
        name: r.name.clone(),
        description: r.description.clone(),
        severity: r.severity.as_str().to_string(),
        conditions: r
            .conditions
            .iter()
            .map(|c| DetectionConditionPayload {
                condition_type: c.condition_type.as_str().to_string(),
                value: c.value.clone(),
            })
            .collect(),
        actions: r.actions.iter().map(|a| a.as_str().to_string()).collect(),
        enabled: r.enabled,
        created_at: r.created_at,
        last_match: r.last_match,
        match_count: r.match_count,
    }
}

pub fn risk_to_payload(r: &RiskEntry) -> RiskPayload {
    RiskPayload {
        id: r.id.to_string(),
        title: r.title.clone(),
        description: r.description.clone(),
        probability: r.probability,
        impact: r.impact,
        owner: r.owner.clone(),
        status: r.status.as_str().to_string(),
        mitigation: r.mitigation.clone(),
        source: r.source.clone(),
        created_at: r.created_at,
        updated_at: r.updated_at,
        sla_target_days: r.sla_target_days,
    }
}

pub fn asset_to_payload(a: &ManagedAsset) -> AssetPayload {
    AssetPayload {
        id: a.id.to_string(),
        ip: a.ip.clone(),
        hostname: a.hostname.clone(),
        mac: a.mac.clone(),
        vendor: a.vendor.clone(),
        device_type: a.device_type.clone(),
        criticality: a.criticality.as_str().to_string(),
        lifecycle: a.lifecycle.as_str().to_string(),
        tags: a.tags.clone(),
        risk_score: f64::from(a.risk_score),
        vulnerability_count: a.vulnerability_count,
        open_ports: a.open_ports.clone(),
        software: a.software.clone(),
        first_seen: a.first_seen,
        last_seen: a.last_seen,
    }
}

pub fn alert_rule_to_payload(r: &AlertRule) -> AlertRulePayload {
    AlertRulePayload {
        id: r.id.to_string(),
        name: r.name.clone(),
        rule_type: r.rule_type.as_str().to_string(),
        severity_threshold: r.severity_threshold.map(|s| s.as_str().to_string()),
        detection_types: r.detection_types.clone(),
        escalation_minutes: r.escalation_minutes,
        enabled: r.enabled,
        created_at: r.created_at,
    }
}

pub fn webhook_to_payload(w: &WebhookConfig) -> WebhookPayload {
    WebhookPayload {
        id: w.id.to_string(),
        name: w.name.clone(),
        url: w.url.clone(),
        format: w.format.clone(),
        enabled: w.enabled,
        last_sent: w.last_sent,
        error: w.error.clone(),
    }
}
