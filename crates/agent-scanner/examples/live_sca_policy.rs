//! Runs the hardening policy shipped for this system and prints the result
//! of every check; nothing is changed.
//! `cargo run -p agent-scanner --example live_sca_policy`
use agent_scanner::check::CheckRegistry;
use agent_scanner::checks::sca;

#[tokio::main]
async fn main() {
    let mut registry = CheckRegistry::new();
    let host = sca::SystemHost::shared();
    let report = sca::register_builtin_policies(&mut registry, &host);
    for error in &report.errors {
        println!("not loaded: {error}");
    }
    let (mut passed, mut failed, mut not_applicable) = (0, 0, 0);
    let mut checks = registry.all();
    checks.sort_by_key(|check| check.definition().id.clone());
    for check in checks {
        let definition = check.definition();
        match check.execute().await {
            Ok(output) if output.is_not_applicable() => {
                not_applicable += 1;
                println!(
                    "N/A   {} — {} ({})",
                    definition.id, definition.name, output.message
                );
            }
            Ok(output) if output.passed => {
                passed += 1;
                println!("ok    {} — {}", definition.id, definition.name);
            }
            Ok(output) => {
                failed += 1;
                println!(
                    "FAIL  {} — {} ({})",
                    definition.id, definition.name, output.message
                );
            }
            Err(e) => println!("ERROR {} — {e}", definition.id),
        }
    }
    println!("{passed} passed, {failed} failed, {not_applicable} not applicable");
}
