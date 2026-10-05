//! Local triage exceptions. These rules do not modify the operating-system firewall.
use crate::{
    app::AppState,
    dto::{AllowlistRule, AllowlistRuleType},
    events::GuiCommand,
    icons, theme, widgets,
};

#[derive(Clone, Default)]
struct Editor {
    kind: usize,
    pattern: String,
    reason: String,
    search: String,
    editing: Option<uuid::Uuid>,
    remove: Option<uuid::Uuid>,
    /// The empty state's call to action: focus the target field next frame.
    focus_target: bool,
}
const KINDS: [AllowlistRuleType; 5] = [
    AllowlistRuleType::IpAddress,
    AllowlistRuleType::ProcessPattern,
    AllowlistRuleType::FilePath,
    AllowlistRuleType::UsbDevice,
    AllowlistRuleType::SystemIncident,
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

fn kind_icon(kind: AllowlistRuleType) -> &'static str {
    match kind {
        AllowlistRuleType::IpAddress | AllowlistRuleType::Domain => icons::NETWORK,
        AllowlistRuleType::ProcessPattern => icons::BUG,
        AllowlistRuleType::FilePath => icons::FILE_SHIELD,
        AllowlistRuleType::UsbDevice => icons::PLUG,
        AllowlistRuleType::SystemIncident => icons::SHIELD,
    }
}

fn section_label(ui: &mut egui::Ui, text: &str) {
    ui.label(
        egui::RichText::new(text)
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_NORMAL)
            .strong(),
    );
}

pub(super) fn show(ui: &mut egui::Ui, state: &mut AppState) -> Option<GuiCommand> {
    let id = ui.id().with("authorization_editor");
    let mut editor = ui
        .ctx()
        .data_mut(|d| d.get_temp::<Editor>(id).unwrap_or_default());
    ui.label(
        egui::RichText::new("Autorisations & exceptions")
            .font(theme::font_h3())
            .color(theme::text_primary()),
    );
    ui.label(
        egui::RichText::new(
            "Exceptions de triage enregistrées sur ce poste. Elles ne créent aucune règle de \
             pare-feu et ne désactivent pas la collecte des événements.",
        )
        .font(theme::font_body())
        .color(theme::text_secondary()),
    );
    ui.add_space(theme::SPACE_MD);
    widgets::ResponsiveGrid::new(340.0, theme::SPACE_MD).show(ui, &[0, 1], |ui, _, item| {
        widgets::data_card(ui, "Autorisations", |ui| {
            if *item == 0 {
                editor_form(ui, state, &mut editor);
            } else {
                scope_card(ui);
            }
        });
    });

    ui.add_space(theme::SPACE_LG);
    let total = state.threats.allowlist_rules.len();
    ui.horizontal(|ui| {
        section_label(
            ui,
            &match total {
                0 => "AUCUNE AUTORISATION".to_owned(),
                1 => "1 AUTORISATION".to_owned(),
                n => format!("{} AUTORISATIONS", crate::format::int(n)),
            },
        );
    });
    ui.add_space(theme::SPACE_XS);
    if total > 0 {
        widgets::search_input(
            ui,
            &mut editor.search,
            "Rechercher une cible ou une justification…",
        );
        ui.add_space(theme::SPACE_SM);
    }
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
        widgets::data_card(ui, "Règles d’autorisation", |ui| {
            let (title, detail) = if total == 0 {
                (
                    "Aucune exception enregistrée",
                    "Tous les événements sont traités normalement. Une autorisation classe une \
                     activité légitime (sauvegarde, outil d'administration…) comme exception.",
                )
            } else {
                (
                    "Aucune autorisation ne correspond",
                    "Modifiez la recherche ci-dessus.",
                )
            };
            if widgets::empty_state_with_action(
                ui,
                icons::SHIELD_CHECK,
                title,
                Some(detail),
                (total == 0).then_some(("Créer une autorisation", || {})),
            ) {
                editor.focus_target = true;
            }
        });
    }
    widgets::ResponsiveGrid::new(320.0, theme::SPACE_MD).show(ui, &rules, |ui, _, rule| {
        ui.push_id(rule.id, |ui| {
            widgets::card(ui, |ui| rule_card(ui, state, &mut editor, rule))
        });
    });
    ui.ctx().data_mut(|d| d.insert_temp(id, editor));
    None
}

fn editor_form(ui: &mut egui::Ui, state: &mut AppState, editor: &mut Editor) {
    ui.horizontal(|ui| {
        widgets::icon_tile(ui, icons::SHIELD_CHECK, theme::ACCENT, 32.0);
        ui.label(
            egui::RichText::new(if editor.editing.is_some() {
                "Modifier une autorisation"
            } else {
                "Nouvelle autorisation"
            })
            .font(theme::font_body_strong())
            .color(theme::text_primary()),
        );
    });
    ui.add_space(theme::SPACE_MD);

    section_label(ui, "TYPE D'EXCEPTION");
    ui.add_space(theme::SPACE_XS);
    // One width for every field: text_input caps itself at the modal width.
    let field_w = ui.available_width().min(theme::MODAL_WIDTH);
    let labels: Vec<&str> = KINDS.iter().map(|k| k.label()).collect();
    if let Some(kind) = widgets::Dropdown::new("authorization_kind", &labels, editor.kind)
        .width(field_w)
        .show(ui)
    {
        editor.kind = kind;
    }
    ui.add_space(theme::SPACE_SM);

    section_label(ui, "CIBLE AUTORISÉE");
    ui.add_space(theme::SPACE_XS);
    let hint = match editor.kind {
        0 => "192.168.1.20 ou 10.0.0.0/24",
        1 => "backup-agent ou backup-*",
        2 => "/var/log/application/*.log",
        3 => "0x0781:0x5567",
        _ => "firewall_disabled ou Pare-feu*",
    };
    let target = widgets::text_input(ui, &mut editor.pattern, hint);
    if std::mem::take(&mut editor.focus_target) {
        target.request_focus();
    }
    let valid = valid_pattern(KINDS[editor.kind], editor.pattern.trim());
    let duplicate = state.threats.allowlist_rules.iter().any(|r| {
        Some(r.id) != editor.editing
            && r.rule_type == KINDS[editor.kind]
            && r.pattern == editor.pattern.trim()
    });
    if !editor.pattern.is_empty() && !valid {
        ui.label(
            egui::RichText::new("Saisissez une cible valide et précise.")
                .font(theme::font_caption())
                .color(theme::readable_color(theme::WARNING)),
        );
    }
    if duplicate {
        ui.label(
            egui::RichText::new("Cette autorisation existe déjà.")
                .font(theme::font_caption())
                .color(theme::readable_color(theme::WARNING)),
        );
    }
    ui.add_space(theme::SPACE_SM);

    section_label(ui, "JUSTIFICATION OBLIGATOIRE");
    ui.add_space(theme::SPACE_XS);
    egui::Frame::new()
        .fill(theme::bg_tertiary())
        .stroke(egui::Stroke::new(theme::BORDER_THIN, theme::border()))
        .corner_radius(theme::ROUNDING_MD)
        .inner_margin(theme::SPACE_SM)
        .show(ui, |ui| {
            ui.set_width(field_w - theme::SPACE_SM * 2.0);
            ui.add(
                egui::TextEdit::multiline(&mut editor.reason)
                    .hint_text("Pourquoi cette activité est-elle légitime ?")
                    .frame(false)
                    .desired_rows(3)
                    .desired_width(f32::INFINITY),
            );
        });
    ui.add_space(theme::SPACE_MD);

    ui.horizontal(|ui| {
        if widgets::button::primary_button(
            ui,
            format!("{}  Enregistrer l’autorisation", icons::CHECK),
            valid && !duplicate && !editor.reason.trim().is_empty(),
        )
        .clicked()
            && state.require_admin("Enregistrer une autorisation (exception de détection)")
        {
            if let Some(existing) = editor.editing {
                state.threats.remove_allowlist_rule(existing);
            }
            state.add_allowlist_rule_global(
                KINDS[editor.kind],
                editor.pattern.trim().into(),
                editor.reason.trim().into(),
                "Opérateur local".into(),
            );
            editor.pattern.clear();
            editor.reason.clear();
            editor.editing = None;
            state.push_toast(
                widgets::toast::Toast::success("Autorisation enregistrée"),
                ui.ctx(),
            );
        }
        if editor.editing.is_some() && widgets::button::ghost_button(ui, "Annuler").clicked() {
            editor.editing = None;
            editor.pattern.clear();
            editor.reason.clear();
        }
    });
}

/// What each kind of exception compares, then what authorising implies.
fn scope_card(ui: &mut egui::Ui) {
    ui.label(
        egui::RichText::new("Portée de l’exception")
            .font(theme::font_body_strong())
            .color(theme::text_primary()),
    );
    ui.add_space(theme::SPACE_SM);
    for (icon, title, detail) in [
        (
            icons::NETWORK,
            "Adresse IP",
            "Adresse exacte ou sous-réseau CIDR IPv4 / IPv6 ; seule l’adresse distante est comparée.",
        ),
        (
            icons::BUG,
            "Processus",
            "Nom exact ; * remplace une suite de caractères (backup-*).",
        ),
        (
            icons::FILE_SHIELD,
            "Fichier",
            "Chemin exact ou motif (/var/log/app/*.log).",
        ),
        (
            icons::PLUG,
            "USB",
            "Identifiants fabricant:produit (0x0781:0x5567).",
        ),
        (
            icons::SHIELD,
            "Incident système",
            "Type ou titre de l’incident.",
        ),
    ] {
        ui.horizontal_top(|ui| {
            ui.label(
                egui::RichText::new(icon)
                    .size(theme::ICON_XS)
                    .color(theme::accent_text()),
            );
            ui.vertical(|ui| {
                ui.label(
                    egui::RichText::new(title)
                        .font(theme::font_body_strong())
                        .color(theme::text_primary()),
                );
                ui.add(
                    egui::Label::new(
                        egui::RichText::new(detail)
                            .font(theme::font_caption())
                            .color(theme::text_secondary()),
                    )
                    .wrap(),
                );
            });
        });
        ui.add_space(theme::SPACE_XS);
    }
    ui.add_space(theme::SPACE_SM);
    egui::Frame::new()
        .fill(theme::tinted_surface(theme::INFO))
        .corner_radius(theme::ROUNDING_MD)
        .inner_margin(theme::SPACE_MD)
        .show(ui, |ui| {
            ui.set_width(ui.available_width());
            for line in [
                "Acquitter : vous avez pris connaissance de l’événement.",
                "Autoriser : les événements correspondants deviennent des exceptions ; plus de notification, ni règle de détection ni playbook.",
                "Ils restent collectés et transmis à la plateforme et au SIEM.",
                "Révoquer rétablit leur visibilité ; les acquittements manuels sont conservés.",
            ] {
                ui.add(
                    egui::Label::new(
                        egui::RichText::new(line)
                            .font(theme::font_caption())
                            .color(theme::text_primary()),
                    )
                    .wrap(),
                );
            }
        });
}

fn rule_card(ui: &mut egui::Ui, state: &mut AppState, editor: &mut Editor, rule: &AllowlistRule) {
    ui.horizontal(|ui| {
        widgets::icon_tile(ui, kind_icon(rule.rule_type), theme::SUCCESS, 30.0);
        ui.vertical(|ui| {
            ui.label(
                egui::RichText::new(&rule.pattern)
                    .font(theme::font_mono())
                    .color(theme::text_primary()),
            );
            widgets::status_badge(ui, rule.rule_type.label(), theme::INFO);
        });
    });
    ui.add_space(theme::SPACE_SM);
    ui.add(
        egui::Label::new(
            egui::RichText::new(&rule.description)
                .font(theme::font_body())
                .color(theme::text_secondary()),
        )
        .wrap(),
    );
    ui.label(
        egui::RichText::new(format!(
            "{} · {}",
            rule.created_by,
            rule.created_at.format("%d/%m/%Y %H:%M")
        ))
        .font(theme::font_caption())
        .color(theme::text_tertiary()),
    );
    ui.add_space(theme::SPACE_SM);
    ui.horizontal_wrapped(|ui| {
        if let Some(kind) = KINDS.iter().position(|k| *k == rule.rule_type)
            && widgets::button::secondary_button(ui, format!("{}  Modifier", icons::PENCIL), true)
                .clicked()
        {
            editor.kind = kind;
            editor.pattern = rule.pattern.clone();
            editor.reason = rule.description.clone();
            editor.editing = Some(rule.id);
        }
        if editor.remove != Some(rule.id)
            && widgets::button::ghost_button(ui, format!("{}  Révoquer", icons::TRASH)).clicked()
        {
            editor.remove = Some(rule.id);
        }
        if editor.remove == Some(rule.id) {
            if widgets::button::destructive_button(ui, "Confirmer la révocation", true).clicked() {
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
