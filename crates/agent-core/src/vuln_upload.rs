// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Paginated vulnerability upload (`POST /v1/agents/:agentId/vulnerabilities`).
//!
//! Contract:
//! - every scan sends at least one page, even with zero findings;
//! - pages hold at most [`MAX_ITEMS_PER_PAGE`] items and share one `scan_id`;
//! - `scan_complete` is false whenever something reduced the scan coverage,
//!   identical on every page; the server only resolves findings missing from
//!   a scan when every page was received and `scan_complete` is true;
//! - pages are sent sequentially, each retried on network errors, 5xx and 429
//!   ([`UPLOAD_BACKOFF`]); another 4xx is final; a page that definitively
//!   fails stops the upload (the server then resolves nothing for that scan).

use agent_scanner::VulnerabilityFinding;
use agent_scanner::vulnerability::{normalize_cve_id, truncate_utf16};
use serde_json::{Value, json};
use std::future::Future;
use std::time::Duration;

/// Server cap on items per request.
pub(crate) const MAX_ITEMS_PER_PAGE: usize = 500;
/// Server cap on `page_count`.
pub(crate) const MAX_PAGES: usize = 1000;
/// Delay before each retry of a page (3 attempts in total).
pub(crate) const UPLOAD_BACKOFF: [Duration; 2] = [Duration::from_secs(2), Duration::from_secs(8)];

const MAX_PACKAGE_NAME: usize = 255;
const MAX_VERSION: usize = 128;
const MAX_DESCRIPTION: usize = 4096;
const MAX_REMEDIATION: usize = 2048;
const MAX_AI_ANALYSIS: usize = 4096;
const MAX_SOURCE: usize = 64;
const MAX_ADVISORY_ID: usize = 64;

/// Round a CVSS score to one decimal (no `f32` noise such as 9.800000190734863).
fn round_cvss(score: f32) -> Option<f64> {
    let value = (f64::from(score) * 10.0).round() / 10.0;
    (value.is_finite() && (0.0..=10.0).contains(&value)).then_some(value)
}

/// Build the upload item of a finding, or `None` when it must not be
/// uploaded (no valid CVE id, empty package name).
pub(crate) fn build_item(v: &VulnerabilityFinding) -> Option<Value> {
    let cve_id = v.cve_id.as_deref().and_then(normalize_cve_id)?;
    let package_name = v.package_name.trim();
    if package_name.is_empty() {
        return None;
    }
    let advisory_id = v
        .advisory_id
        .as_deref()
        .map(str::trim)
        .filter(|id| !id.is_empty() && id.encode_utf16().count() <= MAX_ADVISORY_ID);

    Some(json!({
        "package_name": truncate_utf16(package_name, MAX_PACKAGE_NAME),
        "installed_version": truncate_utf16(&v.installed_version, MAX_VERSION),
        "available_version": v.available_version.as_deref().map(|s| truncate_utf16(s, MAX_VERSION)),
        "cve_id": cve_id,
        "advisory_id": advisory_id,
        "cvss_score": v.cvss_score.and_then(round_cvss),
        "severity": v.severity.to_string(),
        "description": truncate_utf16(&v.description, MAX_DESCRIPTION),
        "remediation": v.remediation.as_deref().map(|s| truncate_utf16(s, MAX_REMEDIATION)),
        "detected_at": v.detected_at.to_rfc3339(),
        "source": truncate_utf16(&v.source, MAX_SOURCE),
        "ai_confidence": v.ai_confidence.map(|c| f64::from(c.min(100)) / 100.0),
        "is_false_positive": v.is_false_positive,
        "ai_analysis": v.ai_analysis.as_deref().map(|s| truncate_utf16(s, MAX_AI_ANALYSIS)),
    }))
}

/// Split the uploadable findings into request bodies.
///
/// Always returns at least one page. If the findings would exceed
/// [`MAX_PAGES`], the extra items are dropped and the scan is reported as
/// incomplete (so nothing is wrongly resolved server-side).
pub(crate) fn build_pages(
    findings: &[VulnerabilityFinding],
    scan_type: &str,
    scan_id: &str,
    scan_complete: bool,
) -> Vec<Value> {
    let mut items: Vec<Value> = findings.iter().filter_map(build_item).collect();
    let mut scan_complete = scan_complete;
    if items.len() > MAX_ITEMS_PER_PAGE * MAX_PAGES {
        items.truncate(MAX_ITEMS_PER_PAGE * MAX_PAGES);
        scan_complete = false;
    }

    let chunks: Vec<Vec<Value>> = if items.is_empty() {
        vec![Vec::new()]
    } else {
        items
            .chunks(MAX_ITEMS_PER_PAGE)
            .map(<[Value]>::to_vec)
            .collect()
    };
    let page_count = chunks.len();

    chunks
        .into_iter()
        .enumerate()
        .map(|(i, vulnerabilities)| {
            json!({
                "vulnerabilities": vulnerabilities,
                "scan_type": scan_type,
                "scan_id": scan_id,
                "page": i + 1,
                "page_count": page_count,
                "scan_complete": scan_complete,
            })
        })
        .collect()
}

/// Failure of one page send attempt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum PageError {
    /// Network error, 5xx or 429: worth retrying.
    Retryable(String),
    /// Any other rejection: retrying will not help.
    Fatal(String),
}

/// Classify an HTTP response status for the upload.
pub(crate) fn classify_status(status: u16, body: &str) -> Result<(), PageError> {
    match status {
        200..=299 => Ok(()),
        429 | 500..=599 => Err(PageError::Retryable(format!(
            "HTTP {status}: {}",
            truncate_utf16(body, 300)
        ))),
        _ => Err(PageError::Fatal(format!(
            "HTTP {status}: {}",
            truncate_utf16(body, 300)
        ))),
    }
}

/// Send pages sequentially with per-page retries.
///
/// `send(page)` performs one attempt. Each page is tried `backoff.len() + 1`
/// times at most, sleeping `backoff[n]` before retry `n + 1`. Returns the
/// number of pages sent, or an error (with the number of pages sent before
/// the failure) as soon as one page definitively fails — remaining pages are
/// not sent.
pub(crate) async fn send_pages<'a, F, Fut>(
    pages: &'a [Value],
    backoff: &[Duration],
    mut send: F,
) -> Result<usize, (usize, String)>
where
    F: FnMut(&'a Value) -> Fut,
    Fut: Future<Output = Result<(), PageError>>,
{
    for (index, page) in pages.iter().enumerate() {
        let mut attempt = 0usize;
        loop {
            match send(page).await {
                Ok(()) => break,
                Err(PageError::Retryable(e)) if attempt < backoff.len() => {
                    tracing::warn!(
                        "Vulnerability page {}/{} failed (attempt {}): {}; retrying",
                        index + 1,
                        pages.len(),
                        attempt + 1,
                        e
                    );
                    tokio::time::sleep(backoff[attempt]).await;
                    attempt += 1;
                }
                Err(PageError::Retryable(e)) | Err(PageError::Fatal(e)) => {
                    return Err((
                        index,
                        format!("page {}/{} failed: {}", index + 1, pages.len(), e),
                    ));
                }
            }
        }
    }
    Ok(pages.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_scanner::Severity;
    use std::cell::RefCell;

    fn finding(i: usize) -> VulnerabilityFinding {
        let mut f = VulnerabilityFinding::with_cve(
            format!("pkg{i}"),
            "1.0",
            format!("CVE-2024-{:04}", 1000 + i),
            9.8,
            "desc",
            "osv/debian:12",
        );
        f.advisory_id = Some(format!("DSA-{i}-1"));
        f
    }

    #[test]
    fn empty_scan_still_sends_one_page() {
        let pages = build_pages(&[], "cve_check", "scan-1", true);
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0]["vulnerabilities"], json!([]));
        assert_eq!(pages[0]["page"], 1);
        assert_eq!(pages[0]["page_count"], 1);
        assert_eq!(pages[0]["scan_complete"], true);
        assert_eq!(pages[0]["scan_id"], "scan-1");
        assert_eq!(pages[0]["scan_type"], "cve_check");
    }

    #[test]
    fn findings_without_cve_are_not_uploaded_but_page_is_sent() {
        let f = VulnerabilityFinding::outdated_package("vim", "1", "2", "apt");
        let pages = build_pages(&[f], "cve_check", "s", false);
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0]["vulnerabilities"], json!([]));
        assert_eq!(pages[0]["scan_complete"], false);
    }

    #[test]
    fn paginates_at_500_with_same_scan_id_and_flag() {
        let findings: Vec<_> = (0..1001).map(finding).collect();
        let pages = build_pages(&findings, "cve_check", "scan-x", false);
        assert_eq!(pages.len(), 3);
        let sizes: Vec<usize> = pages
            .iter()
            .map(|p| p["vulnerabilities"].as_array().unwrap().len())
            .collect();
        assert_eq!(sizes, vec![500, 500, 1]);
        for (i, p) in pages.iter().enumerate() {
            assert_eq!(p["page"], i + 1);
            assert_eq!(p["page_count"], 3);
            assert_eq!(p["scan_id"], "scan-x");
            assert_eq!(p["scan_complete"], false);
        }
        assert_eq!(pages[2]["vulnerabilities"][0]["package_name"], "pkg1000");

        let exactly_500: Vec<_> = (0..500).map(finding).collect();
        assert_eq!(build_pages(&exactly_500, "cve_check", "s", true).len(), 1);
    }

    #[test]
    fn item_fields_follow_contract() {
        let mut f = finding(1);
        f.cve_id = Some("cve-2024-1001".to_string());
        f.cvss_score = Some(9.8);
        f.description = "é".repeat(5000);
        f.remediation = Some("🔒".repeat(2000));
        f.ai_analysis = Some("x".repeat(5000));
        f.ai_confidence = Some(85);
        f.severity = Severity::Critical;
        let item = build_item(&f).unwrap();

        assert_eq!(item["cve_id"], "CVE-2024-1001");
        assert_eq!(item["advisory_id"], "DSA-1-1");
        assert_eq!(item["severity"], "critical");
        // Exactly 9.8 in JSON, not 9.800000190734863.
        assert_eq!(serde_json::to_string(&item["cvss_score"]).unwrap(), "9.8");
        assert!(item["description"].as_str().unwrap().encode_utf16().count() <= 4096);
        assert!(item["remediation"].as_str().unwrap().encode_utf16().count() <= 2048);
        assert!(item["ai_analysis"].as_str().unwrap().encode_utf16().count() <= 4096);
        assert_eq!(item["ai_confidence"], 0.85);
    }

    #[test]
    fn item_without_score_sends_null_and_rejects_non_cve_ids() {
        let mut f = finding(2);
        f.cvss_score = None;
        f.severity = Severity::Medium;
        let item = build_item(&f).unwrap();
        assert!(item["cvss_score"].is_null());
        assert_eq!(item["severity"], "medium");

        f.cve_id = Some("GHSA-aaaa-bbbb-cccc".to_string());
        assert!(build_item(&f).is_none());

        let mut long_adv = finding(3);
        long_adv.advisory_id = Some("A".repeat(65));
        assert!(build_item(&long_adv).unwrap()["advisory_id"].is_null());
    }

    #[test]
    fn classify_statuses() {
        assert_eq!(classify_status(200, ""), Ok(()));
        assert!(matches!(classify_status(429, ""), Err(PageError::Retryable(_))));
        assert!(matches!(classify_status(503, ""), Err(PageError::Retryable(_))));
        assert!(matches!(classify_status(400, "bad"), Err(PageError::Fatal(_))));
        assert!(matches!(classify_status(401, ""), Err(PageError::Fatal(_))));
    }

    fn pages(n: usize) -> Vec<Value> {
        (1..=n).map(|i| json!({ "page": i })).collect()
    }

    const NO_WAIT: [Duration; 2] = [Duration::ZERO, Duration::ZERO];

    #[tokio::test]
    async fn retries_transient_errors_then_succeeds() {
        let calls = RefCell::new(Vec::new());
        let result = send_pages(&pages(2), &NO_WAIT, |p| {
            let page = p["page"].as_u64().unwrap();
            calls.borrow_mut().push(page);
            let n = calls.borrow().iter().filter(|&&c| c == page).count();
            async move {
                if page == 1 && n < 3 {
                    Err(PageError::Retryable("503".into()))
                } else {
                    Ok(())
                }
            }
        })
        .await;
        assert_eq!(result, Ok(2));
        assert_eq!(*calls.borrow(), vec![1, 1, 1, 2]);
    }

    #[tokio::test]
    async fn stops_after_three_failed_attempts() {
        let calls = RefCell::new(Vec::new());
        let result = send_pages(&pages(3), &NO_WAIT, |p| {
            let page = p["page"].as_u64().unwrap();
            calls.borrow_mut().push(page);
            async move {
                if page == 2 {
                    Err(PageError::Retryable("network".into()))
                } else {
                    Ok(())
                }
            }
        })
        .await;
        assert!(matches!(result, Err((1, _))));
        // Page 3 is never sent.
        assert_eq!(*calls.borrow(), vec![1, 2, 2, 2]);
    }

    #[tokio::test]
    async fn does_not_retry_client_errors() {
        let calls = RefCell::new(0usize);
        let result = send_pages(&pages(2), &NO_WAIT, |_| {
            *calls.borrow_mut() += 1;
            async { Err(PageError::Fatal("HTTP 400".into())) }
        })
        .await;
        assert!(matches!(result, Err((0, _))));
        assert_eq!(*calls.borrow(), 1);
    }
}
