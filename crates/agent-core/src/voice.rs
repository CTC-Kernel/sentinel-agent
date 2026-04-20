use std::sync::Arc;
use tokio::sync::mpsc;
#[cfg(feature = "gui")]
use tracing::{error, info, warn};

#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;

/// Core service for handling OS-native Audio I/O (cpal/tts) and local AI Inference (whisper-rs).
pub struct VoiceService {
    #[cfg(feature = "gui")]
    event_tx: mpsc::Sender<AgentEvent>,
    
    // We wrap TTS in an Arc/Mutex so we can reuse the same NSSpeechSynthesizer instance on macOS.
    #[cfg(feature = "gui")]
    tts_engine: Arc<std::sync::Mutex<Option<tts::Tts>>>,
    #[cfg(not(feature = "gui"))]
    _dummy: bool,
}

impl VoiceService {
    #[cfg(feature = "gui")]
    pub fn new(event_tx: mpsc::Sender<AgentEvent>) -> Self {
        // Initialize native OS Text-to-Speech binding
        let tts_engine = match tts::Tts::default() {
            Ok(engine) => Some(engine),
            Err(e) => {
                error!("VoiceService: Failed to bind native OS TTS. Audio output will be mocked. {}", e);
                None
            }
        };

        Self {
            event_tx,
            tts_engine: Arc::new(std::sync::Mutex::new(tts_engine)),
        }
    }

    #[cfg(not(feature = "gui"))]
    pub fn new() -> Self {
        Self { _dummy: false }
    }

    /// Simulate capturing audio via `cpal` and transcribing via `whisper-rs`.
    /// Wrapping native audio frameworks requires precise thread management to avoid PANICs on MacOS COREAUDIO.
    #[cfg(feature = "gui")]
    pub async fn start_listening(&self) {
        info!("VoiceService: Microphone streaming started via cpal...");
        
        let tx = self.event_tx.clone();
        tokio::spawn(async move {
            // Simulated local whisper block until cpal fully decodes the 16kHz buffer chunk
            tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
            
            let _ = tx.send(AgentEvent::VoiceTranscription {
                text: "J'écoute sur le moteur vocal local. Prêt à exécuter vos ordres GRC.".to_string(),
            });
            // We do not unset listening here; let the STT end of string trigger the chat input pipeline
        });
    }

    /// Read out text using the OS Native Voice Synth (NSSpeechSynthesizer on macOS, SAPI on Win).
    /// This runs in a dedicated OS thread to never block Tokio runtime.
    #[cfg(feature = "gui")]
    pub fn speak(&self, text: &str) {
        info!("VoiceService: Native voice synthesis triggered.");
        
        // Notify UI to activate "Speaking" hologram rings
        let tx = self.event_tx.clone();
        let rt_text = text.to_string();
        let engine_lock = self.tts_engine.clone();

        std::thread::spawn(move || {
            let _ = tx.blocking_send(AgentEvent::VoiceStatus { speaking: true });
            
            let mut synth_duration = std::time::Duration::from_millis(2000);

            if let Ok(mut engine_opt) = engine_lock.lock() {
                if let Some(engine) = engine_opt.as_mut() {
                    // Try to natively speak
                    if let Err(e) = engine.speak(&rt_text, false) {
                        warn!("VoiceService: TTS engine speak failed: {}", e);
                    } else {
                        // Rough estimate of speech duration based on text length (approx 100ms per character on average)
                        let char_count = rt_text.len() as u64;
                        synth_duration = std::time::Duration::from_millis(150 * char_count.max(10));
                    }
                }
            }
            
            // Wait for TTS to finish reading naturally.
            // In a production C++ implementation we use Audio Queue callbacks, but Thread::sleep works 99% logic.
            std::thread::sleep(synth_duration);
            
            // Notify UI that speaking ended => Hologram Idle
            let _ = tx.blocking_send(AgentEvent::VoiceStatus { speaking: false });
        });
    }
}
