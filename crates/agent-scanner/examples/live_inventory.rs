//! Takes the inventory of this machine and prints a summary; nothing is
//! changed. `cargo run -p agent-scanner --example live_inventory`
use agent_scanner::inventory::collect;

fn main() {
    let inventory = collect();
    if let Some(system) = &inventory.system {
        println!(
            "{} on {} {} ({}), kernel {}, {} threads, {} MiB, serial number {}",
            system.os_label().as_deref().unwrap_or("?"),
            system.manufacturer.as_deref().unwrap_or("?"),
            system.model.as_deref().unwrap_or("?"),
            system.processor.as_deref().unwrap_or("?"),
            system.kernel.as_deref().unwrap_or("?"),
            system.threads.unwrap_or(0),
            system.memory_bytes.unwrap_or(0) >> 20,
            // Not printed: this output ends up in tickets.
            if system.serial_number.is_some() {
                "read"
            } else {
                "unknown"
            }
        );
    }
    if !inventory.hotfixes.is_empty() {
        println!("{} Windows updates", inventory.hotfixes.len());
    }
    println!(
        "{} accounts ({} able to log in), {} groups, {} services, {} listening ports",
        inventory.users.len(),
        inventory
            .users
            .iter()
            .filter(|user| user.can_log_in)
            .count(),
        inventory.groups.len(),
        inventory.services.len(),
        inventory.listening_ports.len()
    );
    for port in inventory.listening_ports.iter().take(12) {
        println!(
            "  {}/{} on {} ({})",
            port.port,
            port.protocol,
            port.address,
            port.process.as_deref().unwrap_or("?")
        );
    }
    for service in inventory.services.iter().take(6) {
        println!("  service {} [{}]", service.name, service.state);
    }
}
