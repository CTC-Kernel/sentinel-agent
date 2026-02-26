//! GUI Demo - Example pour lancer l'interface graphique Sentinel Agent
//! 
//! Usage: cargo run --example gui_demo --features render

use agent_gui::{run_gui, events::AgentEvent, enrollment::EnrollmentCommand};
use std::sync::mpsc;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialiser le logging basique
    println!("Initialisation du logging...");
    
    println!("Démarrage de la GUI Sentinel Agent...");
    
    // Créer les canaux de communication
    let (event_tx, event_rx) = mpsc::channel::<AgentEvent>();
    let (command_tx, command_rx) = mpsc::channel::<agent_gui::events::GuiCommand>();
    let (enrollment_tx, enrollment_rx) = mpsc::channel::<EnrollmentCommand>();
    
    // Simuler un agent déjà enrollé pour la démo
    let enrolled = true;
    
    // Lancer la GUI
    run_gui(enrolled, event_rx, command_tx, enrollment_tx)?;
    
    Ok(())
}
