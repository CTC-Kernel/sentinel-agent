//! Local triage exceptions. These rules do not modify the operating-system firewall.
use crate::{
    app::AppState,
    dto::{AllowlistRule, AllowlistRuleType},
    events::GuiCommand,
    theme, widgets,
};

#[derive(Clone, Default)]
struct Editor {
    kind: usize,
    pattern: String,
    reason: String,
    search: String,
    editing: Option<uuid::Uuid>,
    remove: Option<uuid::Uuid>,
}
const KINDS: [AllowlistRuleType; 4] = [
    AllowlistRuleType::IpAddress,
    AllowlistRuleType::ProcessPattern,
    AllowlistRuleType::FilePath,
    AllowlistRuleType::UsbDevice,
];

fn valid_pattern(kind: AllowlistRuleType, pattern: &str) -> bool {
    if pattern.is_empty() || pattern.chars().all(|c| c == '*') {
        return false;
    }
    if kind != AllowlistRuleType::IpAddress {
        return true;
    }
    let (address, prefix) = pattern.split_once('/').unwrap_or((pattern, ""));
    let Ok(ip) = address.parse::<std::net::IpAddr>() else {
        return false;
    };
    !pattern.contains('/')
        || prefix
            .parse::<u32>()
            .is_ok_and(|n| n <= if ip.is_ipv4() { 32 } else { 128 })
}

pub(super) fn show(ui: &mut egui::Ui, state: &mut AppState) -> Option<GuiCommand> {
    let id = ui.id().with("authorization_editor");
    let mut editor = ui
        .ctx()
        .data_mut(|d| d.get_temp::<Editor>(id).unwrap_or_default());
    ui.label(egui::RichText::new("Autorisations & exceptions").font(theme::font_heading()));
    ui.label("Exceptions de triage enregistrées sur ce poste. Elles ne créent aucune règle de pare-feu et ne désactivent pas la collecte des événements.");
    ui.add_space(theme::SPACE_MD);
    widgets::ResponsiveGrid::new(300.0, theme::SPACE_MD).show(ui, &[0, 1], |ui, _, item| {
        widgets::card(ui, |ui| {
            if *item == 0 {
                ui.strong(if editor.editing.is_some() { "Modifier une autorisation" } else { "Nouvelle autorisation" });
                ui.add_space(theme::SPACE_SM);
                egui::ComboBox::from_id_salt("authorization_kind").selected_text(KINDS[editor.kind].label()).show_ui(ui, |ui| {
                    for (index, kind) in KINDS.iter().enumerate() { ui.selectable_value(&mut editor.kind, index, kind.label()); }
                });
                ui.label("Cible autorisée");
                ui.add(egui::TextEdit::singleline(&mut editor.pattern).hint_text(match editor.kind { 0 => "192.168.1.20 ou 10.0.0.0/24", 1 => "backup-agent ou backup-*", 2 => "/var/log/application/*.log", _ => "0x0781:0x5567" }).desired_width(f32::INFINITY));
                ui.label("Justification obligatoire");
                ui.add(egui::TextEdit::multiline(&mut editor.reason).desired_rows(3).desired_width(f32::INFINITY));
                let valid = valid_pattern(KINDS[editor.kind], editor.pattern.trim());
                let duplicate = state.threats.allowlist_rules.iter().any(|r| Some(r.id) != editor.editing && r.rule_type == KINDS[editor.kind] && r.pattern == editor.pattern.trim());
                if !editor.pattern.is_empty() && !valid { ui.colored_label(theme::readable_color(theme::WARNING), "Saisissez une cible valide et précise."); }
                if duplicate { ui.label("Cette autorisation existe déjà."); }
                if widgets::button::primary_button(ui, "Enregistrer l’autorisation", valid && !duplicate && !editor.reason.trim().is_empty()).clicked() {
                    if let Some(existing) = editor.editing { state.threats.remove_allowlist_rule(existing); }
                    state.add_allowlist_rule_global(KINDS[editor.kind], editor.pattern.trim().into(), editor.reason.trim().into(), "Opérateur local".into());
                    editor.pattern.clear(); editor.reason.clear(); editor.editing = None;
                    state.push_toast(widgets::toast::Toast::success("Autorisation enregistrée"), ui.ctx());
                }
                if editor.editing.is_some() && widgets::button::ghost_button(ui, "Annuler la modification").clicked() { editor.editing = None; editor.pattern.clear(); editor.reason.clear(); }
            } else {
                ui.strong("Portée de l’exception");
                ui.label("IP : adresse exacte ou sous-réseau CIDR IPv4 / IPv6.");
                ui.label("Processus, fichiers et USB : correspondance exacte ; * remplace une suite de caractères.");
                ui.add_space(theme::SPACE_SM);
                ui.label("Acquitter signifie avoir pris connaissance d’un événement. Autoriser classe les événements correspondants comme exceptions tant que la règle existe.");
                ui.label("Révoquer rétablit la visibilité des événements concernés ; les acquittements manuels sont conservés.");
            }
        });
    });
    ui.add_space(theme::SPACE_LG);
    ui.strong(format!(
        "{} autorisation(s)",
        state.threats.allowlist_rules.len()
    ));
    ui.add(
        egui::TextEdit::singleline(&mut editor.search)
            .hint_text("Rechercher une cible ou une justification…")
            .desired_width(f32::INFINITY),
    );
    ui.add_space(theme::SPACE_SM);
    let query = editor.search.to_lowercase();
    let rules: Vec<AllowlistRule> = state
        .threats
        .allowlist_rules
        .iter()
        .filter(|r| {
            format!("{} {}", r.pattern, r.description)
                .to_lowercase()
                .contains(&query)
        })
        .cloned()
        .collect();
    if rules.is_empty() {
        ui.label("Aucune autorisation ne correspond. Ajoutez une exception avec le formulaire ci-dessus.");
    }
    widgets::ResponsiveGrid::new(300.0, theme::SPACE_MD).show(ui, &rules, |ui, _, rule| {
        ui.push_id(rule.id, |ui| {
            widgets::card(ui, |ui| {
                ui.strong(&rule.pattern);
                ui.label(rule.rule_type.label());
                ui.label(&rule.description);
                ui.small(format!(
                    "{} · {}",
                    rule.created_by,
                    rule.created_at.format("%d/%m/%Y %H:%M")
                ));
                ui.horizontal_wrapped(|ui| {
                    if let Some(kind) = KINDS.iter().position(|k| *k == rule.rule_type)
                        && widgets::button::secondary_button(ui, "Modifier", true).clicked()
                    {
                        editor.kind = kind;
                        editor.pattern = rule.pattern.clone();
                        editor.reason = rule.description.clone();
                        editor.editing = Some(rule.id);
                    }
                    if widgets::button::ghost_button(ui, "Révoquer").clicked() {
                        editor.remove = Some(rule.id);
                    }
                    if editor.remove == Some(rule.id) {
                        if widgets::button::destructive_button(ui, "Confirmer la révocation", true)
                            .clicked()
                        {
                            state.threats.remove_allowlist_rule(rule.id);
                            state.refresh_authorizations();
                            editor.remove = None;
                            if editor.editing == Some(rule.id) {
                                editor.editing = None;
                                editor.pattern.clear();
                                editor.reason.clear();
                            }
                            state.push_toast(
                                widgets::toast::Toast::success("Autorisation révoquée"),
                                ui.ctx(),
                            );
                        }
                        if widgets::button::ghost_button(ui, "Annuler").clicked() {
                            editor.remove = None;
                        }
                    }
                });
            })
        });
    });
    ui.ctx().data_mut(|d| d.insert_temp(id, editor));
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    fn rule(kind: AllowlistRuleType, pattern: &str) -> AllowlistRule {
        AllowlistRule {
            id: uuid::Uuid::new_v4(),
            rule_type: kind,
            pattern: pattern.into(),
            description: "Maintenance approuvée".into(),
            created_at: chrono::Utc::now(),
            created_by: "Test".into(),
        }
    }
    #[test]
    fn address_scope_never_matches_partial_addresses() {
        let exact = rule(AllowlistRuleType::IpAddress, "192.168.1.1");
        assert!(exact.matches("192.168.1.1"));
        assert!(!exact.matches("192.168.1.10"));
        let subnet = rule(AllowlistRuleType::IpAddress, "10.5.0.0/16");
        assert!(subnet.matches("10.5.255.254"));
        assert!(!subnet.matches("10.6.0.1"));
        let ipv6 = rule(AllowlistRuleType::IpAddress, "2001:db8::/32");
        assert!(ipv6.matches("2001:db8::42"));
        assert!(!ipv6.matches("2001:db9::42"));
        for invalid in ["", "*", "192.168.1", "10.0.0.0/33", "::1/129", "10.0.0.1/"] {
            assert!(!valid_pattern(AllowlistRuleType::IpAddress, invalid));
        }
    }
    #[test]
    fn patterns_are_anchored_and_wildcards_are_explicit() {
        assert!(!rule(AllowlistRuleType::ProcessPattern, "backup").matches("malicious-backup"));
        assert!(rule(AllowlistRuleType::ProcessPattern, "backup-*").matches("backup-daily"));
        assert!(!rule(AllowlistRuleType::FilePath, "/safe/*").matches("/unsafe/file"));
        assert!(rule(AllowlistRuleType::FilePath, "/safe/*.log").matches("/safe/a.log"));
    }
    #[test]
    fn revocation_restores_unacknowledged_events_without_erasing_manual_triage() {
        let mut state = AppState::default();
        state.fim.alerts.push_back(crate::dto::GuiFimAlert {
            id: "event-1".into(),
            path: "/safe/a.log".into(),
            change_type: crate::dto::FimChangeType::Modified,
            old_hash: None,
            new_hash: None,
            timestamp: chrono::Utc::now(),
            acknowledged: false,
            allowlisted: false,
        });
        let id = state.add_allowlist_rule_global(
            AllowlistRuleType::FilePath,
            "/safe/*".into(),
            "Maintenance".into(),
            "Test".into(),
        );
        assert!(state.fim.alerts[0].allowlisted);
        assert!(!state.fim.alerts[0].acknowledged);
        state.threats.remove_allowlist_rule(id);
        state.refresh_authorizations();
        assert!(!state.fim.alerts[0].allowlisted);
        assert!(!state.fim.alerts[0].acknowledged);
        assert!(state.acknowledge_threat_item("fim", 0));
        state.refresh_authorizations();
        assert!(state.fim.alerts[0].acknowledged);
    }

    #[test]
    fn rules_survive_preferences_and_can_be_revoked() {
        let mut state = AppState::default();
        let id = state.add_allowlist_rule_global(
            AllowlistRuleType::IpAddress,
            "10.0.0.0/24".into(),
            "Maintenance".into(),
            "Test".into(),
        );
        let json =
            serde_json::to_string(&crate::state::GuiPreferences::from_state(&state)).unwrap();
        let saved: crate::state::GuiPreferences = serde_json::from_str(&json).unwrap();
        let mut restored = AppState::default();
        saved.apply_to(&mut restored);
        assert!(
            restored
                .threats
                .is_allowlisted(AllowlistRuleType::IpAddress, "10.0.0.42")
        );
        assert!(restored.threats.remove_allowlist_rule(id));
        restored.refresh_authorizations();
        assert!(
            !restored
                .threats
                .is_allowlisted(AllowlistRuleType::IpAddress, "10.0.0.42")
        );
    }
}
