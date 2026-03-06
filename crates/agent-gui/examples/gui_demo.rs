// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! GUI Demo - Example pour lancer l'interface graphique Sentinel Agent
//!
//! Usage: cargo run --example gui_demo --features render

use agent_gui::{enrollment::EnrollmentCommand, events::AgentEvent, run_gui};
use std::sync::mpsc;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialiser le logging basique
    println!("Initialisation du logging...");

    println!("Démarrage de la GUI Sentinel Agent...");

    // Créer les canaux de communication
    let (_event_tx, event_rx) = mpsc::channel::<AgentEvent>();
    let (_command_tx, _command_rx) = mpsc::channel::<agent_gui::events::GuiCommand>();
    let (_enrollment_tx, _enrollment_rx) = mpsc::channel::<EnrollmentCommand>();

    // Simuler un agent déjà enrollé pour la démo
    let enrolled = true;

    // Lancer la GUI
    run_gui(enrolled, event_rx, _command_tx, _enrollment_tx)?;

    Ok(())
}
