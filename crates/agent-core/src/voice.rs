use std::sync::Arc;
use std::sync::mpsc;
#[cfg(feature = "gui")]
use tracing::{error, info, warn};

#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;

/// Core service for handling OS-native Audio I/O (cpal/tts) and local AI Inference (whisper-rs).
pub struct VoiceService {
    #[cfg(feature = "gui")]
    event_tx: mpsc::Sender<AgentEvent>,
    
    #[cfg(feature = "gui")]
    tts_engine: Arc<std::sync::Mutex<Option<tts::Tts>>>,
    
    #[cfg(feature = "voice")]
    sound_manager: Option<crate::sounds::SoundManager>,
    
    #[cfg(feature = "voice")]
    whisper_ctx: Arc<tokio::sync::Mutex<Option<whisper_rs::WhisperContext>>>,

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

        #[cfg(feature = "voice")]
        let whisper_ctx = {
            let model_path = "models/whisper/ggml-base.bin";
            match whisper_rs::WhisperContext::new_with_params(model_path, whisper_rs::WhisperContextParameters::default()) {
                Ok(ctx) => {
                    info!("VoiceService: Whisper model loaded from {}", model_path);
                    Some(ctx)
                },
                Err(e) => {
                    warn!("VoiceService: Failed to load Whisper model at {}. STT will be mocked. {}", model_path, e);
                    None
                }
            }
        };

        Self {
            event_tx,
            tts_engine: Arc::new(std::sync::Mutex::new(tts_engine)),
            #[cfg(feature = "voice")]
            sound_manager: crate::sounds::SoundManager::new(),
            #[cfg(feature = "voice")]
            whisper_ctx: Arc::new(tokio::sync::Mutex::new(whisper_ctx)),
        }
    }

    pub fn play_beep(&self) {
        if let Some(sm) = &self.sound_manager {
            sm.play_confirmation();
        }
    }

    pub fn play_scan_sound(&self) {
        if let Some(sm) = &self.sound_manager {
            sm.play_scan_start();
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
        info!("VoiceService: Listening started (Whisper + cpal)...");
        
        let tx = self.event_tx.clone();
        #[cfg(feature = "voice")]
        let _ctx_lock = self.whisper_ctx.clone();

        // Notify GUI to start pulse animation
        if let Err(e) = tx.send(AgentEvent::LlmVoiceState { active: true }) {
             warn!("VoiceService: Failed to send voice state start: {}", e);
        }

        tokio::spawn(async move {
            // Simulated local whisper block until cpal fully decodes the 16kHz buffer chunk
            // In a full implementation, we'd loop cpal samples into whisper-rs here.
            tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
            
            let _ = tx.send(AgentEvent::VoiceTranscription {
                text: "J'écoute sur le moteur vocal local. Prêt à exécuter vos ordres GRC.".to_string(),
            });
            
            // Notify GUI to stop pulse animation
            let _ = tx.send(AgentEvent::LlmVoiceState { active: false });
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
            let _ = tx.send(AgentEvent::VoiceStatus { speaking: true });
            
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
            let _ = tx.send(AgentEvent::VoiceStatus { speaking: false });
        });
    }
}
