//! Runs the rootkit checks on this machine and prints what they find;
//! nothing is changed. `cargo run -p agent-scanner --example live_rootcheck`
use agent_scanner::security::rootcheck::Rootcheck;

fn main() {
    let started = std::time::Instant::now();
    let findings = Rootcheck::findings_now();
    println!(
        "{} finding(s) in {:.1}s",
        findings.len(),
        started.elapsed().as_secs_f32()
    );
    for finding in &findings {
        let incident = finding.incident();
        println!("- [{}] {}", incident.severity, incident.title);
    }
}
