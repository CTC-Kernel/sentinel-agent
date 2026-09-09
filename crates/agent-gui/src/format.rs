// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! French-locale formatting for the numbers the interface shows.
//!
//! The product speaks French everywhere except in its numbers, which were
//! printed the way Rust prints them: `12345`, `87.4`. In French a thousands
//! group is separated by a narrow no-break space and the decimal mark is a
//! comma, and a percent sign is preceded by the same narrow space. These
//! helpers exist so a stat card and a table cell agree on that.

/// Narrow no-break space (U+202F): the French thousands separator.
pub const THIN_SPACE: char = '\u{202f}';

/// Group an integer by thousands: `12345` → `12 345`.
pub fn int(n: impl TryInto<u64>) -> String {
    let digits = n.try_into().unwrap_or(u64::MAX).to_string();
    let mut out = String::with_capacity(digits.len() + digits.len() / 3);
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push(THIN_SPACE);
        }
        out.push(ch);
    }
    out
}

/// Signed variant of [`int`].
pub fn int_signed(n: i64) -> String {
    if n < 0 {
        format!("\u{2212}{}", int(n.unsigned_abs()))
    } else {
        int(n as u64)
    }
}

/// Decimal with a comma and grouped integer part: `1234.5` → `1 234,5`.
pub fn decimal(v: impl Into<f64>, decimals: usize) -> String {
    let v: f64 = v.into();
    let rounded = format!("{v:.decimals$}");
    let (sign, rest) = match rounded.strip_prefix('-') {
        Some(r) => ("\u{2212}", r),
        None => ("", rounded.as_str()),
    };
    let (whole, frac) = rest.split_once('.').unwrap_or((rest, ""));
    let whole: u64 = whole.parse().unwrap_or(0);
    if frac.is_empty() {
        format!("{sign}{}", int(whole))
    } else {
        format!("{sign}{},{frac}", int(whole))
    }
}

/// Percentage with the French narrow space before the sign: `87.4` → `87,4 %`.
pub fn pct(v: impl Into<f64>, decimals: usize) -> String {
    format!("{}{THIN_SPACE}%", decimal(v, decimals))
}

/// Byte count in French units: `1 240 000` → `1,2 Mo`.
pub fn bytes(b: u64) -> String {
    const UNITS: [&str; 5] = ["o", "Ko", "Mo", "Go", "To"];
    let mut value = b as f64;
    let mut unit = 0;
    while value >= 1000.0 && unit < UNITS.len() - 1 {
        value /= 1000.0;
        unit += 1;
    }
    // One decimal only when it carries information: "1,2 Mo" yes, "16,0 Go" no.
    let tenths = (value * 10.0).round();
    let decimals = if unit == 0 || value >= 100.0 || tenths % 10.0 == 0.0 {
        0
    } else {
        1
    };
    format!("{}{THIN_SPACE}{}", decimal(value, decimals), UNITS[unit])
}

/// `"s"` when `n` takes a plural; French keeps 0 and 1 singular.
pub fn plural_suffix(n: impl TryInto<u64>) -> &'static str {
    if n.try_into().unwrap_or(u64::MAX) > 1 {
        "s"
    } else {
        ""
    }
}

/// A count with a regular plural: `count(3, "échec")` → `3 échecs`,
/// `count(1, "échec")` → `1 échec`. Replaces the `échec(s)` hedge.
pub fn count(n: impl TryInto<u64>, singular: &str) -> String {
    let n = n.try_into().unwrap_or(u64::MAX);
    format!("{} {singular}{}", int(n), plural_suffix(n))
}

/// Relative time, coarse on purpose: `à l'instant`, `il y a 5 min`,
/// `il y a 2 h`, `il y a 3 j`.
pub fn ago(now: chrono::DateTime<chrono::Utc>, then: chrono::DateTime<chrono::Utc>) -> String {
    let secs = (now - then).num_seconds().max(0);
    if secs < 120 {
        "\u{00e0} l'instant".into()
    } else if secs < 3_600 {
        format!("il y a {} min", secs / 60)
    } else if secs < 86_400 {
        format!("il y a {} h", secs / 3_600)
    } else {
        format!("il y a {} j", secs / 86_400)
    }
}

/// Compact duration: `3 j 05 h`, `2 h 17 min`, `48 min`, `35 s`.
pub fn duration_short(secs: u64) -> String {
    let (d, h, m, s) = (
        secs / 86_400,
        (secs / 3_600) % 24,
        (secs / 60) % 60,
        secs % 60,
    );
    if d > 0 {
        format!("{d}{THIN_SPACE}j {h:02}{THIN_SPACE}h")
    } else if h > 0 {
        format!("{h}{THIN_SPACE}h {m:02}{THIN_SPACE}min")
    } else if m > 0 {
        format!("{m}{THIN_SPACE}min")
    } else {
        format!("{s}{THIN_SPACE}s")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn groups_thousands_with_a_narrow_space() {
        assert_eq!(int(0_u32), "0");
        assert_eq!(int(999_u64), "999");
        assert_eq!(int(1_000_u64), "1\u{202f}000");
        assert_eq!(int(1_234_567_u64), "1\u{202f}234\u{202f}567");
        assert_eq!(int_signed(-42_000), "\u{2212}42\u{202f}000");
    }

    #[test]
    fn decimals_use_a_comma() {
        assert_eq!(decimal(87.4_f32, 1), "87,4");
        assert_eq!(decimal(1234.5, 1), "1\u{202f}234,5");
        assert_eq!(decimal(3.0, 0), "3");
        assert_eq!(decimal(-0.25, 2), "\u{2212}0,25");
        assert_eq!(pct(87.43, 1), "87,4\u{202f}%");
    }

    #[test]
    fn counts_agree_in_number() {
        assert_eq!(count(0_u32, "\u{00e9}chec"), "0 \u{00e9}chec");
        assert_eq!(count(1_usize, "\u{00e9}chec"), "1 \u{00e9}chec");
        assert_eq!(
            count(1_200_u64, "r\u{00e9}sultat"),
            "1\u{202f}200 r\u{00e9}sultats"
        );
        assert_eq!(plural_suffix(2_u8), "s");
    }

    #[test]
    fn relative_time_is_coarse() {
        use chrono::{Duration, Utc};
        let now = Utc::now();
        assert_eq!(ago(now, now - Duration::seconds(30)), "\u{00e0} l'instant");
        assert_eq!(ago(now, now - Duration::minutes(5)), "il y a 5 min");
        assert_eq!(ago(now, now - Duration::hours(2)), "il y a 2 h");
        assert_eq!(ago(now, now - Duration::days(3)), "il y a 3 j");
    }

    #[test]
    fn bytes_use_french_units() {
        assert_eq!(bytes(512), "512\u{202f}o");
        assert_eq!(bytes(1_240_000), "1,2\u{202f}Mo");
        assert_eq!(bytes(16_000_000_000), "16\u{202f}Go");
        assert_eq!(bytes(150_000), "150\u{202f}Ko");
    }

    #[test]
    fn durations_read_at_a_glance() {
        assert_eq!(duration_short(35), "35\u{202f}s");
        assert_eq!(duration_short(48 * 60), "48\u{202f}min");
        assert_eq!(
            duration_short(2 * 3600 + 17 * 60),
            "2\u{202f}h 17\u{202f}min"
        );
        assert_eq!(
            duration_short(3 * 86_400 + 5 * 3_600),
            "3\u{202f}j 05\u{202f}h"
        );
    }
}
