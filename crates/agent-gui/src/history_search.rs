// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Search in the local history, for the assistant.
//!
//! The assistant's context describes the endpoint as it is now. A question
//! about the past ("que s'est-il passé mardi ?", "des alertes la semaine
//! dernière ?") needs the events recorded then. This module:
//!
//! 1. gathers every dated event the application holds (suspicious processes,
//!    network alerts, file integrity changes, USB devices, system incidents,
//!    vulnerabilities, response actions) into one list;
//! 2. reads the period the question is about (a weekday, "hier", "il y a
//!    3 jours", "la semaine dernière", a date…);
//! 3. renders the events of that period as a section of the context.
//!
//! Nothing is guessed: a question without a period gets no section, and a
//! period without events says so, with the dates the history actually covers.

use crate::dto::{FimChangeType, Severity, UsbEventType};
use crate::state::AppState;
use chrono::{DateTime, Datelike, Duration, FixedOffset, NaiveDate, TimeZone, Utc};
use regex::Regex;
use std::sync::LazyLock;

/// Events listed in the section; beyond that only the most severe are kept.
const MAX_LISTED_EVENTS: usize = 25;
const MAX_DETAIL_CHARS: usize = 140;

/// One dated event of the local history.
#[derive(Debug, Clone, PartialEq)]
pub struct HistoryEvent {
    pub timestamp: DateTime<Utc>,
    /// Source identifier: `process`, `network`, `fim`, `usb`, `system`,
    /// `vulnerability` or `response`.
    pub source: &'static str,
    pub severity: Severity,
    pub title: String,
    pub detail: String,
    /// Index of the event in its source list.
    pub source_index: usize,
}

/// Every dated event the application holds, in no particular order.
pub fn events(state: &AppState) -> Vec<HistoryEvent> {
    let mut events = Vec::new();

    for (index, process) in state.threats.suspicious_processes.iter().enumerate() {
        let severity = match process.confidence {
            90.. => Severity::Critical,
            70..=89 => Severity::High,
            40..=69 => Severity::Medium,
            _ => Severity::Low,
        };
        events.push(HistoryEvent {
            timestamp: process.detected_at,
            source: "process",
            severity,
            title: process.process_name.clone(),
            detail: format!(
                "{} \u{2014} Confiance: {}\u{202f}%",
                process.reason, process.confidence
            ),
            source_index: index,
        });
    }

    for (index, usb) in state.threats.usb_events.iter().enumerate() {
        let severity = match usb.event_type {
            UsbEventType::Connected => Severity::Medium,
            UsbEventType::Disconnected => Severity::Low,
            UsbEventType::Blocked => Severity::High,
        };
        events.push(HistoryEvent {
            timestamp: usb.timestamp,
            source: "usb",
            severity,
            title: usb.device_name.clone(),
            detail: format!(
                "{} \u{2014} VID:{:04X} PID:{:04X}",
                usb.event_type, usb.vendor_id, usb.product_id,
            ),
            source_index: index,
        });
    }

    for (index, change) in state.fim.alerts.iter().enumerate() {
        let severity = match change.change_type {
            FimChangeType::Deleted | FimChangeType::PermissionChanged => Severity::High,
            FimChangeType::Created | FimChangeType::Modified => Severity::Medium,
            FimChangeType::Renamed => Severity::Low,
        };
        events.push(HistoryEvent {
            timestamp: change.timestamp,
            source: "fim",
            severity,
            title: change.path.clone(),
            detail: format!("Changement : {}", change.change_type.label()),
            source_index: index,
        });
    }

    for (index, alert) in state.network.alerts.iter().enumerate() {
        let mut detail = alert.description.clone();
        if let Some(source) = &alert.source_ip {
            detail = format!("{detail} \u{2014} SRC: {source}");
        }
        if let Some(destination) = &alert.destination_ip {
            detail = match alert.destination_port {
                Some(port) => format!("{detail} \u{2014} DST: {destination}:{port}"),
                None => format!("{detail} \u{2014} DST: {destination}"),
            };
        }
        events.push(HistoryEvent {
            timestamp: alert.detected_at,
            source: "network",
            severity: alert.severity,
            title: alert.alert_type.clone(),
            detail,
            source_index: index,
        });
    }

    for (index, incident) in state.threats.system_incidents.iter().enumerate() {
        events.push(HistoryEvent {
            timestamp: incident.detected_at,
            source: "system",
            severity: incident.severity,
            title: incident.title.clone(),
            detail: incident.description.clone(),
            source_index: index,
        });
    }

    for (index, finding) in state.vulnerability_findings.iter().enumerate() {
        // A finding without a discovery date cannot be placed in time.
        let Some(timestamp) = finding.discovered_at else {
            continue;
        };
        events.push(HistoryEvent {
            timestamp,
            source: "vulnerability",
            severity: finding.severity,
            title: format!("{} \u{2014} {}", finding.cve_id, finding.affected_software),
            detail: finding.description.clone(),
            source_index: index,
        });
    }

    for (index, action) in state.threats.pending_actions.iter().enumerate() {
        events.push(HistoryEvent {
            timestamp: action.created_at,
            source: "response",
            severity: Severity::Info,
            title: format!("{} : {}", action.action_type.label_fr(), action.target),
            detail: match &action.error {
                Some(error) => format!("{} \u{2014} {error}", action.status.label_fr()),
                None => action.status.label_fr().to_string(),
            },
            source_index: index,
        });
    }

    events
}

/// Label of an event source, as shown to the operator and the assistant.
pub fn source_label(source: &str) -> &'static str {
    match source {
        "process" => "Processus",
        "network" => "Réseau",
        "fim" => "Intégrité des fichiers",
        "usb" => "USB",
        "system" => "Système",
        "vulnerability" => "Vulnérabilité",
        "response" => "Action de réponse",
        _ => "Autre",
    }
}

fn severity_label(severity: Severity) -> &'static str {
    match severity {
        Severity::Critical => "critique",
        Severity::High => "élevée",
        Severity::Medium => "moyenne",
        Severity::Low => "faible",
        Severity::Info => "information",
    }
}

fn severity_rank(severity: Severity) -> u8 {
    match severity {
        Severity::Critical => 4,
        Severity::High => 3,
        Severity::Medium => 2,
        Severity::Low => 1,
        Severity::Info => 0,
    }
}

/// A period a question is about: `start` inclusive, `end` exclusive.
#[derive(Debug, Clone, PartialEq)]
pub struct TimeWindow {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    /// How the period is named in the section (`le mardi 29/09/2026`…).
    pub label: String,
}

/// Lower-case, without accents, with a plain apostrophe: what the period
/// expressions are matched against.
fn fold(text: &str) -> String {
    text.chars()
        .flat_map(char::to_lowercase)
        .map(|c| match c {
            'à' | 'â' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'î' | 'ï' => 'i',
            'ô' | 'ö' => 'o',
            'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            '\u{2019}' => '\'',
            other => other,
        })
        .collect()
}

const WEEKDAYS: [&str; 7] = [
    "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
];
const MONTHS: [&str; 12] = [
    "janvier",
    "fevrier",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "aout",
    "septembre",
    "octobre",
    "novembre",
    "decembre",
];

fn pattern(source: &str) -> Regex {
    Regex::new(source).expect("static pattern is valid")
}

static ISO_DATE: LazyLock<Regex> = LazyLock::new(|| pattern(r"\b(\d{4})-(\d{2})-(\d{2})\b"));
static SLASH_DATE: LazyLock<Regex> =
    LazyLock::new(|| pattern(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{4}|\d{2}))?\b"));
static NAMED_DATE: LazyLock<Regex> = LazyLock::new(|| {
    pattern(&format!(
        r"\b(\d{{1,2}})(?:er)? ({})(?: (\d{{4}}))?\b",
        MONTHS.join("|")
    ))
});
static DAYS_AGO: LazyLock<Regex> = LazyLock::new(|| pattern(r"\bil y a (\d{1,3}) jours?\b"));
static HOURS_AGO: LazyLock<Regex> = LazyLock::new(|| pattern(r"\bil y a (\d{1,3}) heures?\b"));
static LAST_DAYS: LazyLock<Regex> =
    LazyLock::new(|| pattern(r"\b(?:(\d{1,3}) derniers jours|depuis (\d{1,3}) jours?)\b"));
static LAST_HOURS: LazyLock<Regex> =
    LazyLock::new(|| pattern(r"\b(?:(\d{1,3}) dernieres heures|depuis (\d{1,3}) heures?)\b"));
static WEEKDAY: LazyLock<Regex> =
    LazyLock::new(|| pattern(&format!(r"\b({})\b", WEEKDAYS.join("|"))));

fn word(text: &str, expression: &str) -> bool {
    Regex::new(&format!(
        r"(?:^|[^a-z0-9]){}(?:$|[^a-z0-9])",
        regex::escape(expression)
    ))
    .is_ok_and(|regex| regex.is_match(text))
}

/// Midnight starting `date` in the operator's time zone.
fn day_start(date: NaiveDate, offset: &FixedOffset) -> Option<DateTime<Utc>> {
    offset
        .from_local_datetime(&date.and_hms_opt(0, 0, 0)?)
        .single()
        .map(|local| local.with_timezone(&Utc))
}

fn day_window(date: NaiveDate, offset: &FixedOffset) -> Option<TimeWindow> {
    let start = day_start(date, offset)?;
    let weekday = WEEKDAYS[date.weekday().num_days_from_monday() as usize];
    Some(TimeWindow {
        start,
        end: start + Duration::days(1),
        label: format!("le {weekday} {}", date.format("%d/%m/%Y")),
    })
}

fn range_window(
    first_day: NaiveDate,
    end: DateTime<Utc>,
    last_day: NaiveDate,
    offset: &FixedOffset,
) -> Option<TimeWindow> {
    Some(TimeWindow {
        start: day_start(first_day, offset)?,
        end,
        label: format!(
            "du {} au {}",
            first_day.format("%d/%m/%Y"),
            last_day.format("%d/%m/%Y")
        ),
    })
}

/// The period a question is about, or `None` when it names none.
///
/// A date without a year, and a weekday, mean their most recent occurrence
/// (today included).
pub fn time_window(question: &str, now: DateTime<FixedOffset>) -> Option<TimeWindow> {
    let text = fold(question);
    let offset = *now.offset();
    let today = now.date_naive();
    let now_utc = now.with_timezone(&Utc);
    let number = |captures: &regex::Captures<'_>, group: usize| -> Option<i64> {
        captures.get(group)?.as_str().parse().ok()
    };
    // A date in the future this year was last seen the year before.
    let most_recent = |day: u32, month: u32| -> Option<NaiveDate> {
        NaiveDate::from_ymd_opt(today.year(), month, day)
            .filter(|date| *date <= today)
            .or_else(|| NaiveDate::from_ymd_opt(today.year() - 1, month, day))
    };

    if let Some(captures) = ISO_DATE.captures(&text) {
        let date = NaiveDate::from_ymd_opt(
            i32::try_from(number(&captures, 1)?).ok()?,
            u32::try_from(number(&captures, 2)?).ok()?,
            u32::try_from(number(&captures, 3)?).ok()?,
        )?;
        return day_window(date, &offset);
    }
    if let Some(captures) = NAMED_DATE.captures(&text) {
        let day = u32::try_from(number(&captures, 1)?).ok()?;
        let month = MONTHS.iter().position(|name| *name == &captures[2])? as u32 + 1;
        let date = match number(&captures, 3) {
            Some(year) => NaiveDate::from_ymd_opt(i32::try_from(year).ok()?, month, day)?,
            None => most_recent(day, month)?,
        };
        return day_window(date, &offset);
    }
    if let Some(captures) = SLASH_DATE.captures(&text) {
        let day = u32::try_from(number(&captures, 1)?).ok()?;
        let month = u32::try_from(number(&captures, 2)?).ok()?;
        let date = match number(&captures, 3) {
            Some(year) if year < 100 => {
                NaiveDate::from_ymd_opt(2000 + i32::try_from(year).ok()?, month, day)?
            }
            Some(year) => NaiveDate::from_ymd_opt(i32::try_from(year).ok()?, month, day)?,
            None => most_recent(day, month)?,
        };
        return day_window(date, &offset);
    }

    if word(&text, "avant-hier") {
        return day_window(today - Duration::days(2), &offset);
    }
    if word(&text, "hier") {
        return day_window(today - Duration::days(1), &offset);
    }
    if [
        "aujourd'hui",
        "ce matin",
        "cet apres-midi",
        "ce soir",
        "cette nuit",
    ]
    .iter()
    .any(|expression| word(&text, expression))
    {
        return day_window(today, &offset);
    }

    if let Some(captures) = DAYS_AGO.captures(&text) {
        return day_window(today - Duration::days(number(&captures, 1)?), &offset);
    }
    if let Some(captures) = HOURS_AGO
        .captures(&text)
        .or_else(|| LAST_HOURS.captures(&text))
    {
        let hours = number(&captures, 1).or_else(|| number(&captures, 2))?;
        return Some(TimeWindow {
            start: now_utc - Duration::hours(hours),
            end: now_utc,
            label: format!("les {hours} dernières heures"),
        });
    }
    if word(&text, "derniere heure") {
        return Some(TimeWindow {
            start: now_utc - Duration::hours(1),
            end: now_utc,
            label: "la dernière heure".to_string(),
        });
    }
    if let Some(captures) = LAST_DAYS.captures(&text) {
        let days = number(&captures, 1).or_else(|| number(&captures, 2))?;
        return range_window(today - Duration::days(days), now_utc, today, &offset);
    }

    let monday = today - Duration::days(i64::from(today.weekday().num_days_from_monday()));
    if word(&text, "semaine derniere") || word(&text, "semaine passee") {
        let previous_monday = monday - Duration::days(7);
        return range_window(
            previous_monday,
            day_start(monday, &offset)?,
            monday - Duration::days(1),
            &offset,
        );
    }
    if word(&text, "cette semaine") {
        return range_window(monday, now_utc, today, &offset);
    }
    if word(&text, "week-end") || word(&text, "weekend") {
        // The most recent Saturday, today included.
        let since_saturday = (i64::from(today.weekday().num_days_from_monday()) + 2) % 7;
        let saturday = today - Duration::days(since_saturday);
        return range_window(
            saturday,
            day_start(saturday + Duration::days(2), &offset)?.min(now_utc),
            saturday + Duration::days(1),
            &offset,
        );
    }
    let first_of_month = today.with_day(1)?;
    if word(&text, "mois dernier") || word(&text, "mois passe") {
        let last_of_previous = first_of_month - Duration::days(1);
        return range_window(
            last_of_previous.with_day(1)?,
            day_start(first_of_month, &offset)?,
            last_of_previous,
            &offset,
        );
    }
    if word(&text, "ce mois") || word(&text, "ce mois-ci") {
        return range_window(first_of_month, now_utc, today, &offset);
    }

    if let Some(captures) = WEEKDAY.captures(&text) {
        let wanted = WEEKDAYS.iter().position(|name| *name == &captures[1])? as i64;
        let current = i64::from(today.weekday().num_days_from_monday());
        let back = (current - wanted).rem_euclid(7);
        return day_window(today - Duration::days(back), &offset);
    }
    None
}

fn excerpt(text: &str) -> String {
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if text.chars().count() <= MAX_DETAIL_CHARS {
        text
    } else {
        let cut: String = text.chars().take(MAX_DETAIL_CHARS).collect();
        format!("{cut}…")
    }
}

/// Render the events of `window` as a section of the assistant's context.
pub fn render_section(
    events: &[HistoryEvent],
    window: &TimeWindow,
    offset: &FixedOffset,
) -> String {
    let mut selected: Vec<&HistoryEvent> = events
        .iter()
        .filter(|event| event.timestamp >= window.start && event.timestamp < window.end)
        .collect();

    if selected.is_empty() {
        let covered = match (
            events.iter().map(|event| event.timestamp).min(),
            events.iter().map(|event| event.timestamp).max(),
        ) {
            (Some(first), Some(last)) => format!(
                "L'historique local couvre du {} au {}.",
                first.with_timezone(offset).format("%d/%m/%Y"),
                last.with_timezone(offset).format("%d/%m/%Y")
            ),
            _ => "L'historique local ne contient aucun événement daté.".to_string(),
        };
        return format!(
            "HISTORIQUE DEMANDÉ ({}) : aucun événement enregistré par l'agent sur cette période. {covered}",
            window.label
        );
    }

    let total = selected.len();
    // Too many to list: keep the most severe, then show them in order.
    selected.sort_by(|a, b| {
        severity_rank(b.severity)
            .cmp(&severity_rank(a.severity))
            .then(a.timestamp.cmp(&b.timestamp))
    });
    selected.truncate(MAX_LISTED_EVENTS);
    selected.sort_by_key(|event| event.timestamp);

    let several_days = window.end - window.start > Duration::days(1);
    let lines: Vec<String> = selected
        .iter()
        .map(|event| {
            let local = event.timestamp.with_timezone(offset);
            let when = if several_days {
                local.format("%d/%m %H:%M")
            } else {
                local.format("%H:%M")
            };
            let detail = excerpt(&event.detail);
            let separator = if detail.is_empty() { "" } else { " \u{2014} " };
            format!(
                "- {when} [{}, {}] {}{separator}{detail}",
                source_label(event.source),
                severity_label(event.severity),
                excerpt(&event.title),
            )
        })
        .collect();

    let mut section = format!(
        "HISTORIQUE DEMANDÉ ({}) — {total} événement{} enregistré{} par l'agent, dans l'ordre :\n{}",
        window.label,
        if total > 1 { "s" } else { "" },
        if total > 1 { "s" } else { "" },
        lines.join("\n")
    );
    if total > selected.len() {
        section.push_str(&format!(
            "\n(+ {} autres événements moins graves, non listés)",
            total - selected.len()
        ));
    }
    section
}

/// The history section for a question, or `None` when the question names no
/// period.
pub fn history_section(
    state: &AppState,
    question: &str,
    now: DateTime<FixedOffset>,
) -> Option<String> {
    let window = time_window(question, now)?;
    Some(render_section(&events(state), &window, now.offset()))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Sunday 4 October 2026, 15:30, UTC+2.
    fn now() -> DateTime<FixedOffset> {
        DateTime::parse_from_rfc3339("2026-10-04T15:30:00+02:00").unwrap()
    }

    fn window(question: &str) -> TimeWindow {
        time_window(question, now()).unwrap_or_else(|| panic!("no period in {question:?}"))
    }

    fn local(text: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(text)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn day(date: &str) -> (DateTime<Utc>, DateTime<Utc>) {
        (
            local(&format!("{date}T00:00:00+02:00")),
            local(&format!("{date}T00:00:00+02:00")) + Duration::days(1),
        )
    }

    #[test]
    fn single_days_are_read_in_the_operators_time_zone() {
        for (question, date, label) in [
            (
                "Que s'est-il passé mardi sur ce poste ?",
                "2026-09-29",
                "le mardi 29/09/2026",
            ),
            ("Des alertes hier ?", "2026-10-03", "le samedi 03/10/2026"),
            ("Et avant-hier ?", "2026-10-02", "le vendredi 02/10/2026"),
            (
                "Quoi de neuf aujourd’hui ?",
                "2026-10-04",
                "le dimanche 04/10/2026",
            ),
            ("Résume ce matin", "2026-10-04", "le dimanche 04/10/2026"),
            (
                "Que s'est-il passé il y a 3 jours ?",
                "2026-10-01",
                "le jeudi 01/10/2026",
            ),
            (
                "Incidents du 2 octobre",
                "2026-10-02",
                "le vendredi 02/10/2026",
            ),
            (
                "Incidents du 1er septembre 2026",
                "2026-09-01",
                "le mardi 01/09/2026",
            ),
            ("Alertes du 28/09", "2026-09-28", "le lundi 28/09/2026"),
            ("Alertes du 28/09/26", "2026-09-28", "le lundi 28/09/2026"),
            (
                "Événements du 2026-09-30",
                "2026-09-30",
                "le mercredi 30/09/2026",
            ),
            // Today is a Sunday: "dimanche" is today, not a week ago.
            (
                "Que s'est-il passé dimanche ?",
                "2026-10-04",
                "le dimanche 04/10/2026",
            ),
            ("Et lundi dernier ?", "2026-09-28", "le lundi 28/09/2026"),
        ] {
            let found = window(question);
            assert_eq!((found.start, found.end), day(date), "{question}");
            assert_eq!(found.label, label, "{question}");
        }
    }

    #[test]
    fn a_date_still_to_come_this_year_means_last_year() {
        let found = window("Que s'est-il passé le 25 décembre ?");
        assert_eq!((found.start, found.end), day("2025-12-25"));
    }

    #[test]
    fn ranges_cover_weeks_months_and_recent_hours() {
        let this_week = window("Résume cette semaine");
        assert_eq!(this_week.start, local("2026-09-28T00:00:00+02:00"));
        assert_eq!(this_week.end, local("2026-10-04T15:30:00+02:00"));
        assert_eq!(this_week.label, "du 28/09/2026 au 04/10/2026");

        let last_week = window("Des incidents la semaine dernière ?");
        assert_eq!(last_week.start, local("2026-09-21T00:00:00+02:00"));
        assert_eq!(last_week.end, local("2026-09-28T00:00:00+02:00"));
        assert_eq!(last_week.label, "du 21/09/2026 au 27/09/2026");

        let weekend = window("Que s'est-il passé ce week-end ?");
        assert_eq!(weekend.start, local("2026-10-03T00:00:00+02:00"));
        assert_eq!(
            weekend.end,
            local("2026-10-04T15:30:00+02:00"),
            "still ongoing"
        );

        let last_month = window("Bilan du mois dernier");
        assert_eq!(last_month.start, local("2026-09-01T00:00:00+02:00"));
        assert_eq!(last_month.end, local("2026-10-01T00:00:00+02:00"));

        let this_month = window("Bilan de ce mois-ci");
        assert_eq!(this_month.start, local("2026-10-01T00:00:00+02:00"));

        let week_span = window("Alertes des 7 derniers jours");
        assert_eq!(week_span.start, local("2026-09-27T00:00:00+02:00"));
        assert_eq!(week_span.end, local("2026-10-04T15:30:00+02:00"));

        let hours = window("Quoi de neuf depuis 6 heures ?");
        assert_eq!(hours.start, local("2026-10-04T09:30:00+02:00"));
        assert_eq!(hours.label, "les 6 dernières heures");
        assert_eq!(
            window("Sur les 24 dernières heures ?").start,
            local("2026-10-03T15:30:00+02:00")
        );
        assert_eq!(
            window("Depuis la dernière heure ?").start,
            local("2026-10-04T14:30:00+02:00")
        );
    }

    #[test]
    fn questions_without_a_period_get_no_history() {
        for question in [
            "Quel est l'état du pare-feu ?",
            "Quels sont les risques prioritaires ?",
            // "hier" inside another word is not yesterday.
            "Le fichier cahier.txt est-il surveillé ?",
            "Explique CVE-2024-3094",
            "Combien de contrôles sur 34 ?",
            "",
        ] {
            assert_eq!(time_window(question, now()), None, "{question}");
        }
        // Impossible dates are not a period either.
        assert_eq!(time_window("Alertes du 31/02", now()), None);
        assert_eq!(time_window("Alertes du 45 octobre", now()), None);
    }

    fn event(when: &str, source: &'static str, severity: Severity, title: &str) -> HistoryEvent {
        HistoryEvent {
            timestamp: local(when),
            source,
            severity,
            title: title.to_string(),
            detail: format!("détail de {title}"),
            source_index: 0,
        }
    }

    #[test]
    fn section_lists_the_period_in_order_with_local_times() {
        let events = vec![
            event(
                "2026-09-29T16:45:00+02:00",
                "network",
                Severity::High,
                "c2_beacon",
            ),
            event(
                "2026-09-29T09:05:00+02:00",
                "process",
                Severity::Critical,
                "powershell.exe",
            ),
            event(
                "2026-09-30T08:00:00+02:00",
                "fim",
                Severity::Medium,
                "/etc/hosts",
            ),
            event("2026-09-28T23:59:59+02:00", "usb", Severity::Low, "Clé USB"),
        ];
        let section = render_section(
            &events,
            &window("Que s'est-il passé mardi ?"),
            now().offset(),
        );
        assert_eq!(
            section,
            "HISTORIQUE DEMANDÉ (le mardi 29/09/2026) — 2 événements enregistrés par l'agent, dans l'ordre :\n\
             - 09:05 [Processus, critique] powershell.exe — détail de powershell.exe\n\
             - 16:45 [Réseau, élevée] c2_beacon — détail de c2_beacon"
        );

        let week = render_section(&events, &window("la semaine dernière"), now().offset());
        assert!(week.contains("aucun événement enregistré"));
        assert!(week.contains("L'historique local couvre du 28/09/2026 au 30/09/2026."));

        let this_week = render_section(&events, &window("cette semaine"), now().offset());
        assert!(
            this_week.contains("- 28/09 23:59 [USB, faible] Clé USB"),
            "{this_week}"
        );
        assert!(
            this_week
                .starts_with("HISTORIQUE DEMANDÉ (du 28/09/2026 au 04/10/2026) — 4 événements")
        );
    }

    #[test]
    fn a_crowded_period_keeps_the_most_severe_events() {
        let mut events: Vec<HistoryEvent> = (0..40)
            .map(|minute| {
                event(
                    &format!("2026-09-29T10:{minute:02}:00+02:00"),
                    "fim",
                    Severity::Low,
                    &format!("fichier-{minute}"),
                )
            })
            .collect();
        events.push(event(
            "2026-09-29T10:59:00+02:00",
            "system",
            Severity::Critical,
            "Ransomware suspecté",
        ));

        let section = render_section(&events, &window("mardi"), now().offset());
        assert!(section.contains("41 événements"));
        assert!(section.contains("[Système, critique] Ransomware suspecté"));
        assert_eq!(section.matches("\n- ").count(), MAX_LISTED_EVENTS);
        assert!(section.ends_with("(+ 16 autres événements moins graves, non listés)"));
    }

    #[test]
    fn an_empty_history_says_so() {
        let section = render_section(&[], &window("hier"), now().offset());
        assert_eq!(
            section,
            "HISTORIQUE DEMANDÉ (le samedi 03/10/2026) : aucun événement enregistré par l'agent sur cette période. L'historique local ne contient aucun événement daté."
        );
        let state = AppState::default();
        assert_eq!(
            history_section(&state, "Quel est l'état du pare-feu ?", now()),
            None
        );
        assert!(history_section(&state, "Et hier ?", now()).is_some());
    }

    #[test]
    fn long_details_are_cut_on_character_boundaries() {
        let long = "é".repeat(400);
        let cut = excerpt(&long);
        assert_eq!(cut.chars().count(), MAX_DETAIL_CHARS + 1);
        assert!(cut.ends_with('…'));
        assert_eq!(excerpt("  deux   espaces\nligne  "), "deux espaces ligne");
    }
}
