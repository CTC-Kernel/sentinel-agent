//! Local voice assistant: native text-to-speech, microphone capture and
//! on-device Whisper transcription.
//!
//! Design goals (hands-free conversation comparable to consumer assistants):
//! * answers are read completely, sentence by sentence, and the microphone is
//!   only reopened once the synthesizer has really finished;
//! * “finish dictation” keeps and transcribes what was said, while “stop”
//!   discards it;
//! * the Whisper model can be installed from the GUI (pinned URL, SHA-256
//!   verified) and is loaded without restarting the agent.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(feature = "gui")]
use std::sync::mpsc;
#[cfg(feature = "gui")]
use tracing::{error, info, warn};

#[cfg(feature = "gui")]
use agent_gui::dto::{
    SpokenReplyMode, VoiceEngineInfo, VoiceInstallPhase, VoiceInstallProgress, VoiceOption,
    VoiceSettings, WhisperModelSpec,
};
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;

#[cfg(feature = "gui")]
type TtsSlot = Arc<std::sync::Mutex<Option<tts::Tts>>>;
#[cfg(feature = "gui")]
type WhisperSlot = Arc<tokio::sync::Mutex<Option<whisper_rs::WhisperContext>>>;

#[cfg(feature = "gui")]
const WHISPER_MISSING: &str = "modèle de dictée Whisper non installé : installez-le depuis « Réglages vocaux » pour activer la dictée";

/// Core service for handling OS-native Audio I/O (cpal/tts) and local AI Inference (whisper-rs).
pub struct VoiceService {
    #[cfg(feature = "gui")]
    event_tx: mpsc::Sender<AgentEvent>,

    #[cfg(feature = "gui")]
    tts_engine: TtsSlot,
    #[cfg(feature = "gui")]
    speech_epoch: Arc<std::sync::atomic::AtomicU64>,
    #[cfg(feature = "gui")]
    settings: Arc<std::sync::RwLock<VoiceSettings>>,
    /// When the synthesizer last went quiet; the microphone waits a moment
    /// after it so the tail of Sentinel's own voice is never transcribed.
    #[cfg(feature = "gui")]
    speech_ended_at: Arc<std::sync::Mutex<Option<std::time::Instant>>>,

    sound_manager: Option<crate::sounds::SoundManager>,

    #[cfg(feature = "gui")]
    whisper_ctx: WhisperSlot,
    /// Catalogue key of the loaded Whisper model (readable without the async lock).
    #[cfg(feature = "gui")]
    whisper_key: Arc<std::sync::Mutex<Option<String>>>,

    #[cfg(feature = "gui")]
    is_listening: Arc<AtomicBool>,

    /// Set to true when the UI requests an early stop. The VAD loop polls it every
    /// frame so users can toggle the mic off without waiting for silence timeout.
    /// The recording is discarded.
    cancel_requested: Arc<AtomicBool>,
    /// End the capture now but transcribe what was already said.
    #[cfg(feature = "gui")]
    finish_requested: Arc<AtomicBool>,

    #[cfg(feature = "gui")]
    installing: Arc<AtomicBool>,
    #[cfg(feature = "gui")]
    install_cancel: Arc<AtomicBool>,

    #[cfg(not(feature = "gui"))]
    _dummy: bool,
}

#[cfg(not(feature = "gui"))]
impl Default for VoiceService {
    fn default() -> Self {
        Self {
            _dummy: false,
            sound_manager: crate::sounds::SoundManager::new(),
            cancel_requested: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl VoiceService {
    #[cfg(feature = "gui")]
    pub fn new(event_tx: mpsc::Sender<AgentEvent>) -> Self {
        let settings = VoiceSettings::default();
        let mut tts_engine = create_tts();
        if let Some(engine) = tts_engine.as_mut() {
            apply_tts_settings(engine, &settings);
        }

        let (whisper_ctx, whisper_key) = match pick_whisper_model(&settings.whisper_model) {
            Some((spec, path)) => match load_whisper_context(&path) {
                Ok(ctx) => {
                    info!("VoiceService: Whisper model loaded from {}", path.display());
                    (Some(ctx), Some(spec.key.to_string()))
                }
                Err(e) => {
                    warn!(
                        "VoiceService: Failed to load Whisper model at {}. Speech recognition is unavailable. {}",
                        path.display(),
                        e
                    );
                    (None, None)
                }
            },
            None => {
                info!(
                    "VoiceService: no Whisper model installed; dictation can be installed from the GUI"
                );
                (None, None)
            }
        };

        let service = Self {
            event_tx,
            tts_engine: Arc::new(std::sync::Mutex::new(tts_engine)),
            speech_epoch: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            settings: Arc::new(std::sync::RwLock::new(settings)),
            speech_ended_at: Arc::new(std::sync::Mutex::new(None)),
            sound_manager: crate::sounds::SoundManager::new(),
            whisper_ctx: Arc::new(tokio::sync::Mutex::new(whisper_ctx)),
            whisper_key: Arc::new(std::sync::Mutex::new(whisper_key)),
            is_listening: Arc::new(AtomicBool::new(false)),
            cancel_requested: Arc::new(AtomicBool::new(false)),
            finish_requested: Arc::new(AtomicBool::new(false)),
            installing: Arc::new(AtomicBool::new(false)),
            install_cancel: Arc::new(AtomicBool::new(false)),
        };
        service.publish_status();
        service
    }

    /// Discard the current capture. The running VAD loop exits at its next
    /// poll and the usual end-of-listening events fire.
    /// Safe to call when no capture is active (no-op).
    pub fn stop_listening(&self) {
        self.cancel_requested.store(true, Ordering::SeqCst);
    }

    /// End the current capture and transcribe what was already said, like
    /// releasing the microphone button of a consumer assistant.
    #[cfg(feature = "gui")]
    pub fn finish_listening(&self) {
        self.finish_requested.store(true, Ordering::SeqCst);
    }

    /// Stop native speech immediately. This enables “barge-in”: pressing the
    /// microphone while Sentinel is answering hands control back to the user
    /// without letting the recognizer capture the assistant's own voice.
    #[cfg(feature = "gui")]
    pub fn stop_speaking(&self) {
        self.speech_epoch
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        match self.tts_engine.lock() {
            Ok(mut engine) => {
                if let Some(engine) = engine.as_mut()
                    && let Err(error) = engine.stop()
                {
                    warn!("VoiceService: failed to stop native speech: {}", error);
                }
            }
            Err(_) => warn!("VoiceService: TTS lock poisoned while stopping speech"),
        }
        let _ = self
            .event_tx
            .send(AgentEvent::VoiceStatus { speaking: false });
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
        Self::default()
    }

    /// Apply the operator's preferences to the synthesizer and recognizer.
    #[cfg(feature = "gui")]
    pub fn configure(&self, settings: VoiceSettings) {
        let settings = settings.sanitized();
        if let Ok(mut engine) = self.tts_engine.lock()
            && let Some(engine) = engine.as_mut()
        {
            apply_tts_settings(engine, &settings);
        }
        let (voice_changed, model_changed) = match self.settings.write() {
            Ok(mut current) => {
                let changed = (
                    current.voice_id != settings.voice_id,
                    current.whisper_model != settings.whisper_model,
                );
                *current = settings;
                changed
            }
            Err(_) => (true, true),
        };
        // Enumerating system voices can be slow: only republish when the
        // visible status may have changed (not on every slider step).
        if voice_changed || model_changed {
            self.publish_status();
        }
    }

    /// Publish the voice capabilities of this host to the GUI.
    #[cfg(feature = "gui")]
    pub fn publish_status(&self) {
        let info = engine_info(&self.tts_engine, &self.whisper_key);
        let _ = self.event_tx.send(AgentEvent::VoiceEngineStatus {
            info: Box::new(info),
        });
    }

    /// Capture microphone audio via `cpal`, detect speech with an energy-based VAD,
    /// then transcribe via `whisper-rs` — and deliver the result as a
    /// `VoiceTranscription` event for the LLM pipeline.
    #[cfg(feature = "gui")]
    pub async fn start_listening(&self) {
        if self.is_listening.swap(true, Ordering::SeqCst) {
            info!("VoiceService: already listening, ignoring re-entrant call");
            return;
        }

        let tx = self.event_tx.clone();
        let _ = tx.send(AgentEvent::LlmVoiceState { active: true });

        if let Some(sm) = &self.sound_manager {
            sm.play_scan_start();
        }

        let whisper_ctx = self.whisper_ctx.clone();
        let whisper_key = self.whisper_key.clone();
        let tts_engine = self.tts_engine.clone();
        let is_listening = self.is_listening.clone();
        let cancel = self.cancel_requested.clone();
        let finish = self.finish_requested.clone();
        let speech_ended_at = self.speech_ended_at.clone();
        // Clear any stale request from a previous session.
        cancel.store(false, Ordering::SeqCst);
        finish.store(false, Ordering::SeqCst);
        let options = self
            .settings
            .read()
            .map(|settings| CaptureOptions::from_settings(&settings))
            .unwrap_or_default();

        // Whisper inference and cpal stream lifetime are both blocking — isolate
        // from the Tokio runtime so we never stall async workers.
        tokio::task::spawn_blocking(move || {
            wait_for_echo_to_settle(&speech_ended_at, &cancel);

            let outcome =
                match ensure_whisper_loaded(&whisper_ctx, &whisper_key, &options.model_key) {
                    Ok(()) => record_and_transcribe(&whisper_ctx, &tx, &cancel, &finish, &options),
                    Err(e) => {
                        let _ = tx.send(AgentEvent::VoiceEngineStatus {
                            info: Box::new(engine_info(&tts_engine, &whisper_key)),
                        });
                        Err(e)
                    }
                };

            // Release the session *before* publishing the outcome: the GUI may
            // immediately reopen the microphone (hands-free conversation).
            is_listening.store(false, Ordering::SeqCst);
            // Reset the mic level gauge so the UI indicator falls back to zero.
            let _ = tx.send(AgentEvent::AudioLevel { rms: 0.0 });
            let _ = tx.send(AgentEvent::LlmVoiceState { active: false });

            let cancelled = cancel.load(Ordering::SeqCst);
            match outcome {
                Ok(Some(text)) if !cancelled => {
                    info!(
                        "VoiceService: transcription ready ({} characters)",
                        text.chars().count()
                    );
                    let _ = tx.send(AgentEvent::VoiceTranscription { text });
                }
                Ok(_) if cancelled => info!("VoiceService: capture cancelled"),
                Ok(_) => {
                    info!("VoiceService: no speech detected");
                    let _ = tx.send(AgentEvent::VoiceNoSpeech);
                }
                Err(e) => {
                    warn!("VoiceService: capture/transcription failed: {}", e);
                    let _ = tx.send(AgentEvent::VoiceError {
                        message: format!("Impossible de dicter : {}", e),
                    });
                }
            }
        });
    }

    /// Read out text using the OS Native Voice Synth (NSSpeechSynthesizer on macOS, SAPI on Win).
    /// This runs in a dedicated OS thread to never block Tokio runtime.
    #[cfg(feature = "gui")]
    pub fn speak(&self, text: &str) {
        let generation = self
            .speech_epoch
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
            + 1;
        self.speak_if_current(text, generation);
    }

    #[cfg(feature = "gui")]
    pub fn speech_generation(&self) -> u64 {
        self.speech_epoch.load(std::sync::atomic::Ordering::SeqCst)
    }

    /// A stop during inference invalidates the future spoken answer too.
    ///
    /// The answer is spoken sentence group by sentence group. Each group waits
    /// for the synthesizer to finish, so long answers are never cut by a
    /// premature “speech finished” (which used to reopen the microphone and
    /// interrupt the voice mid-sentence), and “Stop” takes effect between
    /// sentences even on backends that cannot stop instantly.
    #[cfg(feature = "gui")]
    pub fn speak_if_current(&self, text: &str, generation: u64) {
        // A complete answer is one segment: sentences are packed into natural
        // groups before being queued.
        if let Some(stream) = self.speak_stream(generation) {
            let _ = stream.tx.send(text.to_string());
        }
    }

    /// Start speaking an answer while it is still being generated: push the
    /// streamed fragments, then `finish`. Speech starts with the first
    /// complete sentence instead of waiting for the whole answer.
    #[cfg(feature = "gui")]
    pub fn speak_stream(&self, generation: u64) -> Option<SpeechStream> {
        if self.speech_generation() != generation {
            return None;
        }
        info!("VoiceService: Native voice synthesis triggered.");

        let settings = self
            .settings
            .read()
            .map(|settings| settings.clone())
            .unwrap_or_default();
        let (segments_tx, segments) = mpsc::channel::<String>();
        let tx = self.event_tx.clone();
        let engine_lock = self.tts_engine.clone();
        let epoch = self.speech_epoch.clone();
        let speech_ended_at = self.speech_ended_at.clone();
        std::thread::spawn(move || {
            let is_current = || epoch.load(std::sync::atomic::Ordering::SeqCst) == generation;
            let limit = match settings.reply_mode {
                SpokenReplyMode::Full => FULL_CHARS,
                SpokenReplyMode::Summary => SUMMARY_CHARS,
            };
            let mut spoken_chars = 0usize;
            let mut truncated = false;
            let mut announced = false;
            let mut first = true;
            let mut failure = None;

            'segments: while let Ok(mut segment) = segments.recv() {
                if !is_current() {
                    return;
                }
                // Lines generated while the previous ones were being read are
                // spoken together: fewer, more natural pauses.
                for more in segments.try_iter() {
                    segment.push('\n');
                    segment.push_str(&more);
                }
                if truncated {
                    continue;
                }
                for chunk in spoken_chunks(&segment, SpokenReplyMode::Full) {
                    let len = chunk.chars().count();
                    if spoken_chars > 0 && spoken_chars + len > limit {
                        truncated = true;
                        continue 'segments;
                    }
                    spoken_chars += len;
                    if !is_current() {
                        return;
                    }
                    if let Err(e) = speak_chunk(&engine_lock, &settings, &chunk, first) {
                        failure = Some(e);
                        break 'segments;
                    }
                    first = false;
                    if !announced {
                        announced = true;
                        let _ = tx.send(AgentEvent::VoiceStatus { speaking: true });
                    }
                    wait_for_speech_end(&engine_lock, &chunk, settings.rate, &epoch, generation);
                }
            }

            if !is_current() {
                return;
            }
            if truncated && failure.is_none() {
                let notice = "La suite de la réponse est affichée à l’écran.";
                if speak_chunk(&engine_lock, &settings, notice, false).is_ok() {
                    wait_for_speech_end(&engine_lock, notice, settings.rate, &epoch, generation);
                }
                if !is_current() {
                    return;
                }
            }
            if let Ok(mut ended) = speech_ended_at.lock() {
                *ended = Some(std::time::Instant::now());
            }
            if let Some(e) = failure {
                warn!("VoiceService: TTS engine speak failed: {}", e);
                let message = if announced {
                    format!(
                        "La lecture vocale s’est interrompue ({e}). La réponse complète reste affichée."
                    )
                } else {
                    format!(
                        "La synthèse vocale du système est indisponible ({e}). La réponse reste affichée à l’écran."
                    )
                };
                let _ = tx.send(AgentEvent::VoiceError { message });
            }
            let _ = tx.send(AgentEvent::VoiceStatus { speaking: false });
        });
        Some(SpeechStream {
            tx: segments_tx,
            splitter: SpeechSplitter::default(),
        })
    }

    /// Download, verify and load a Whisper model from the pinned catalogue.
    #[cfg(feature = "gui")]
    pub async fn install_model(&self, model_key: &str) {
        let tx = self.event_tx.clone();
        let report =
            |phase: VoiceInstallPhase, downloaded: u64, total: u64, error: Option<String>| {
                let _ = tx.send(AgentEvent::VoiceModelInstall {
                    progress: VoiceInstallProgress {
                        model_key: model_key.to_string(),
                        phase,
                        downloaded_bytes: downloaded,
                        total_bytes: total,
                        error,
                    },
                });
            };
        let Some(spec) = agent_gui::dto::whisper_model_spec(model_key) else {
            report(
                VoiceInstallPhase::Failed,
                0,
                0,
                Some("modèle inconnu du catalogue".to_string()),
            );
            return;
        };
        if self.installing.swap(true, Ordering::SeqCst) {
            info!("VoiceService: a Whisper installation is already running");
            return;
        }
        self.install_cancel.store(false, Ordering::SeqCst);
        info!("[AUDIT] Installing Whisper model '{}'", spec.key);

        match download_whisper_model(spec, &tx, &self.install_cancel).await {
            Ok(path) => {
                report(
                    VoiceInstallPhase::Loading,
                    spec.size_bytes,
                    spec.size_bytes,
                    None,
                );
                let load_path = path.clone();
                let loaded =
                    tokio::task::spawn_blocking(move || load_whisper_context(&load_path)).await;
                match loaded {
                    Ok(Ok(ctx)) => {
                        *self.whisper_ctx.lock().await = Some(ctx);
                        if let Ok(mut key) = self.whisper_key.lock() {
                            *key = Some(spec.key.to_string());
                        }
                        if let Ok(mut settings) = self.settings.write() {
                            settings.whisper_model = spec.key.to_string();
                        }
                        info!(
                            "VoiceService: Whisper model '{}' installed at {}",
                            spec.key,
                            path.display()
                        );
                        report(
                            VoiceInstallPhase::Ready,
                            spec.size_bytes,
                            spec.size_bytes,
                            None,
                        );
                    }
                    Ok(Err(e)) => report(
                        VoiceInstallPhase::Failed,
                        spec.size_bytes,
                        spec.size_bytes,
                        Some(format!("modèle téléchargé mais impossible à charger : {e}")),
                    ),
                    Err(e) => report(
                        VoiceInstallPhase::Failed,
                        spec.size_bytes,
                        spec.size_bytes,
                        Some(format!("chargement interrompu : {e}")),
                    ),
                }
            }
            Err(InstallError::Cancelled) => {
                report(VoiceInstallPhase::Cancelled, 0, spec.size_bytes, None)
            }
            Err(InstallError::Failed(e)) => {
                warn!("VoiceService: Whisper installation failed: {}", e);
                report(VoiceInstallPhase::Failed, 0, spec.size_bytes, Some(e));
            }
        }
        self.installing.store(false, Ordering::SeqCst);
        self.publish_status();
    }

    #[cfg(feature = "gui")]
    pub fn cancel_install(&self) {
        self.install_cancel.store(true, Ordering::SeqCst);
    }
}

/// Feeds a streamed answer to the voice, one speakable segment at a time.
#[cfg(feature = "gui")]
pub struct SpeechStream {
    tx: mpsc::Sender<String>,
    splitter: SpeechSplitter,
}

#[cfg(feature = "gui")]
impl SpeechStream {
    /// Add freshly generated text.
    pub fn push(&mut self, delta: &str) {
        for segment in self.splitter.push(delta) {
            let _ = self.tx.send(segment);
        }
    }

    /// The answer is complete: speak what remains, then release the voice.
    pub fn finish(mut self) {
        for segment in self.splitter.finish() {
            let _ = self.tx.send(segment);
        }
    }
}

/// Cuts a token stream into speakable segments: complete lines, or the
/// completed sentences of a long line. Code blocks become a single short
/// announcement and `<think>` reasoning is dropped.
#[cfg(feature = "gui")]
#[derive(Debug, Default)]
struct SpeechSplitter {
    line: String,
    in_code: bool,
    in_think: bool,
}

#[cfg(feature = "gui")]
impl SpeechSplitter {
    /// Shortest prefix of an unfinished line worth speaking on its own.
    const MIN_EARLY_SEGMENT: usize = 40;

    fn push(&mut self, delta: &str) -> Vec<String> {
        let mut out = Vec::new();
        for c in delta.chars() {
            if c == '\n' {
                let line = std::mem::take(&mut self.line);
                self.complete_line(&line, &mut out);
            } else {
                self.line.push(c);
            }
        }
        self.early_sentences(&mut out);
        out
    }

    fn finish(&mut self) -> Vec<String> {
        let mut out = Vec::new();
        let line = std::mem::take(&mut self.line);
        self.complete_line(&line, &mut out);
        out
    }

    fn complete_line(&mut self, line: &str, out: &mut Vec<String>) {
        let mut line = line;
        if self.in_think {
            match line.find("</think>") {
                Some(end) => {
                    self.in_think = false;
                    line = &line[end + "</think>".len()..];
                }
                None => return,
            }
        }
        if let Some(start) = line.find("<think>") {
            let before = &line[..start];
            let after = &line[start + "<think>".len()..];
            if !before.trim().is_empty() {
                out.push(before.to_string());
            }
            match after.find("</think>") {
                Some(end) => line = &after[end + "</think>".len()..],
                None => {
                    self.in_think = true;
                    return;
                }
            }
        }
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            if !self.in_code {
                // An empty fenced block is spoken as the short announcement.
                out.push("```\n```".to_string());
            }
            self.in_code = !self.in_code;
            return;
        }
        if !self.in_code && !line.trim().is_empty() {
            out.push(line.to_string());
        }
    }

    /// Speak the finished sentences of a long line without waiting for its end.
    fn early_sentences(&mut self, out: &mut Vec<String>) {
        if self.in_code || self.in_think {
            return;
        }
        let trimmed = self.line.trim_start();
        if trimmed.starts_with('`') || trimmed.starts_with('~') || trimmed.starts_with('<') {
            return;
        }
        let boundary = self
            .line
            .char_indices()
            .zip(self.line.chars().skip(1))
            .filter(|((_, c), next)| {
                matches!(c, '.' | '!' | '?' | '…' | ';') && next.is_whitespace()
            })
            .map(|((i, c), _)| i + c.len_utf8())
            .last();
        if let Some(end) = boundary
            && self.line[..end].chars().count() >= Self::MIN_EARLY_SEGMENT
        {
            let rest = self.line[end..].trim_start().to_string();
            let head = std::mem::replace(&mut self.line, rest);
            out.push(head[..end].to_string());
        }
    }
}

// ---------------------------------------------------------------------------
// Text-to-speech
// ---------------------------------------------------------------------------

#[cfg(feature = "gui")]
fn create_tts() -> Option<tts::Tts> {
    match tts::Tts::default() {
        Ok(engine) => Some(engine),
        Err(e) => {
            error!(
                "VoiceService: Failed to bind native OS TTS. Audio output is unavailable. {}",
                e
            );
            None
        }
    }
}

/// Map the operator's 0.5×–2× preference onto the backend's own rate range.
#[cfg(feature = "gui")]
fn backend_rate(multiplier: f32, min: f32, normal: f32, max: f32) -> f32 {
    let rate = if multiplier >= 1.0 {
        normal + (multiplier - 1.0) * (max - normal) * 0.5
    } else {
        normal - (1.0 - multiplier) * (normal - min)
    };
    rate.clamp(min.min(max), max.max(min))
}

#[cfg(feature = "gui")]
fn is_french(voice: &tts::Voice) -> bool {
    voice
        .language()
        .as_str()
        .to_ascii_lowercase()
        .starts_with("fr")
}

/// Prefer natural French voices (macOS “Premium/Enhanced”, Windows “Natural/Neural”).
#[cfg(feature = "gui")]
fn voice_quality_score(voice: &tts::Voice) -> i32 {
    let name = voice.name().to_lowercase();
    let language = voice.language().as_str().to_ascii_lowercase();
    let mut score = 0;
    if language.starts_with("fr") {
        score += 100;
    }
    if language == "fr-fr" {
        score += 10;
    }
    for marker in [
        "premium", "enhanced", "amélior", "neural", "natural", "siri",
    ] {
        if name.contains(marker) {
            score += 20;
        }
    }
    score
}

#[cfg(feature = "gui")]
fn apply_tts_settings(engine: &mut tts::Tts, settings: &VoiceSettings) {
    let features = engine.supported_features();
    if features.rate {
        let rate = backend_rate(
            settings.rate,
            engine.min_rate(),
            engine.normal_rate(),
            engine.max_rate(),
        );
        if let Err(e) = engine.set_rate(rate) {
            warn!("VoiceService: unable to set speech rate: {}", e);
        }
    }
    if features.volume {
        let (min, max) = (engine.min_volume(), engine.max_volume());
        if let Err(e) = engine.set_volume(min + settings.volume * (max - min)) {
            warn!("VoiceService: unable to set speech volume: {}", e);
        }
    }
    if features.voice
        && let Ok(voices) = engine.voices()
    {
        let requested = settings
            .voice_id
            .as_ref()
            .and_then(|id| voices.iter().find(|voice| &voice.id() == id));
        let chosen = requested.or_else(|| {
            voices
                .iter()
                .filter(|voice| is_french(voice))
                .max_by_key(|voice| voice_quality_score(voice))
        });
        let current = if features.get_voice {
            engine.voice().ok().flatten().map(|voice| voice.id())
        } else {
            None
        };
        if let Some(voice) = chosen
            && current.as_deref() != Some(voice.id().as_str())
            && let Err(e) = engine.set_voice(voice)
        {
            warn!(
                "VoiceService: unable to select voice '{}': {}",
                voice.name(),
                e
            );
        }
    }
}

#[cfg(feature = "gui")]
fn engine_info(
    tts_engine: &TtsSlot,
    whisper_key: &Arc<std::sync::Mutex<Option<String>>>,
) -> VoiceEngineInfo {
    let installed_models: Vec<String> = agent_gui::dto::WHISPER_MODELS
        .iter()
        .filter(|spec| find_whisper_model_file(spec).is_some())
        .map(|spec| spec.key.to_string())
        .collect();
    let stt_model = whisper_key.lock().ok().and_then(|key| key.clone());
    let mut info = VoiceEngineInfo {
        stt_ready: stt_model.is_some() || !installed_models.is_empty(),
        stt_model,
        installed_models,
        ..VoiceEngineInfo::default()
    };
    if let Ok(engine) = tts_engine.lock()
        && let Some(engine) = engine.as_ref()
    {
        let features = engine.supported_features();
        info.tts_available = true;
        info.can_set_rate = features.rate;
        info.can_set_volume = features.volume;
        info.can_set_voice = features.voice;
        if features.voice
            && let Ok(voices) = engine.voices()
        {
            let mut voices: Vec<_> = voices
                .iter()
                .map(|voice| (is_french(voice), voice_quality_score(voice), voice))
                .collect();
            voices.sort_by(|a, b| {
                b.0.cmp(&a.0)
                    .then(b.1.cmp(&a.1))
                    .then(a.2.name().cmp(&b.2.name()))
            });
            info.voices = voices
                .into_iter()
                .take(300)
                .map(|(_, _, voice)| VoiceOption {
                    id: voice.id(),
                    name: voice.name(),
                    language: voice.language().as_str().to_string(),
                })
                .collect();
        }
        if features.get_voice {
            info.active_voice_id = engine.voice().ok().flatten().map(|voice| voice.id());
        }
    }
    info
}

/// Queue one sentence group. A failing backend is re-created once: some
/// platform synthesizers die after sleep/resume or an audio device change.
#[cfg(feature = "gui")]
fn speak_chunk(
    engine_lock: &TtsSlot,
    settings: &VoiceSettings,
    chunk: &str,
    interrupt: bool,
) -> Result<(), String> {
    let mut engine = engine_lock
        .lock()
        .map_err(|_| "verrou de synthèse vocale corrompu".to_string())?;
    if engine.is_none() {
        *engine = create_tts();
        if let Some(engine) = engine.as_mut() {
            apply_tts_settings(engine, settings);
        }
    }
    let Some(tts) = engine.as_mut() else {
        return Err("aucune voix système disponible".to_string());
    };
    match tts.speak(chunk, interrupt) {
        Ok(_) => Ok(()),
        Err(first) => {
            warn!(
                "VoiceService: speech failed, re-creating the synthesizer: {}",
                first
            );
            let mut fresh = tts::Tts::default().map_err(|e| e.to_string())?;
            apply_tts_settings(&mut fresh, settings);
            fresh.speak(chunk, interrupt).map_err(|e| e.to_string())?;
            *engine = Some(fresh);
            Ok(())
        }
    }
}

/// Conservative spoken duration of a text at the operator's rate.
#[cfg(feature = "gui")]
fn estimated_speech(chunk: &str, rate: f32) -> std::time::Duration {
    let chars = chunk.chars().count() as f32;
    let millis = (chars * 70.0 / rate.clamp(0.5, 2.0)).clamp(800.0, 60_000.0);
    std::time::Duration::from_millis(millis as u64)
}

/// Wait for the native synthesizer rather than guessing from the text length.
/// The estimate remains a portability fallback for backends which do not expose
/// `is_speaking` (and a safety deadline for a wedged platform synthesizer).
#[cfg(feature = "gui")]
fn wait_for_speech_end(
    engine_lock: &TtsSlot,
    chunk: &str,
    rate: f32,
    epoch: &std::sync::atomic::AtomicU64,
    generation: u64,
) {
    use std::time::{Duration, Instant};

    let estimated = estimated_speech(chunk, rate);
    let started = Instant::now();
    // Generous: a long answer must never be declared finished while the voice
    // is still speaking, or the conversation would reopen the microphone on it.
    let deadline = started + estimated * 2 + Duration::from_secs(5);
    // Some backends (WinRT) synthesize the whole utterance before playing.
    let start_grace = Duration::from_millis(600 + 6 * chunk.chars().count() as u64);
    let mut observed_speech = false;

    loop {
        if epoch.load(std::sync::atomic::Ordering::SeqCst) != generation {
            return;
        }
        let speaking = engine_lock
            .lock()
            .ok()
            .and_then(|engine| engine.as_ref().and_then(|tts| tts.is_speaking().ok()));

        match speaking {
            Some(true) => observed_speech = true,
            Some(false) if observed_speech || started.elapsed() >= start_grace => break,
            Some(false) => {}
            // Unsupported backends still get the conservative text-based wait,
            // in small steps so “Stop” stays responsive.
            None => {
                if started.elapsed() >= estimated {
                    break;
                }
            }
        }

        if Instant::now() >= deadline {
            warn!("VoiceService: TTS completion timed out; releasing voice session");
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

#[cfg(feature = "gui")]
const SPOKEN_CHUNK_CHARS: usize = 260;
#[cfg(feature = "gui")]
const SUMMARY_CHARS: usize = 650;
/// Safety cap for pathological answers (roughly ten minutes of speech).
#[cfg(feature = "gui")]
const FULL_CHARS: usize = 9_000;

/// Turn a Markdown answer into natural sentence groups for the synthesizer.
#[cfg(feature = "gui")]
fn spoken_chunks(text: &str, mode: SpokenReplyMode) -> Vec<String> {
    let limit = match mode {
        SpokenReplyMode::Full => FULL_CHARS,
        SpokenReplyMode::Summary => SUMMARY_CHARS,
    };
    let mut kept = Vec::new();
    let mut total = 0usize;
    let mut truncated = false;
    for sentence in split_sentences(&spoken_text(text)) {
        let len = sentence.chars().count();
        if total > 0 && total + len > limit {
            truncated = true;
            break;
        }
        total += len;
        kept.push(sentence);
    }
    let mut chunks = pack_sentences(kept, SPOKEN_CHUNK_CHARS);
    if truncated {
        chunks.push("La suite de la réponse est affichée à l’écran.".to_string());
    }
    chunks
}

#[cfg(feature = "gui")]
fn push_sentence(out: &mut String, sentence: &str) {
    let sentence = sentence
        .trim()
        .trim_end_matches([':', ',', ';', '-', '—'])
        .trim();
    if sentence.chars().filter(|c| c.is_alphanumeric()).count() == 0 {
        return;
    }
    if !out.is_empty() {
        out.push(' ');
    }
    out.push_str(sentence);
    if !sentence.ends_with(['.', '!', '?', '…']) {
        out.push('.');
    }
}

/// Reasoning models (DeepSeek-R1 distills) prefix answers with a
/// `<think>…</think>` block. It is never read aloud; an unterminated block
/// (answer cut by the token budget) leaves nothing to read.
#[cfg(feature = "gui")]
fn without_reasoning(text: &str) -> std::borrow::Cow<'_, str> {
    if !text.contains("<think>") {
        return std::borrow::Cow::Borrowed(text);
    }
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find("<think>") {
        out.push_str(&rest[..start]);
        match rest[start..].find("</think>") {
            Some(end) => rest = &rest[start + end + "</think>".len()..],
            None => {
                rest = "";
                break;
            }
        }
    }
    out.push_str(rest);
    std::borrow::Cow::Owned(out)
}

/// Strip Markdown, code blocks and links which sound unnatural when read.
#[cfg(feature = "gui")]
fn spoken_text(text: &str) -> String {
    let text = without_reasoning(text);
    let mut out = String::with_capacity(text.len().min(FULL_CHARS + 64));
    let mut in_code_block = false;
    for raw in text.lines() {
        let line = raw.trim();
        if line.starts_with("```") || line.starts_with("~~~") {
            if !in_code_block {
                push_sentence(&mut out, "Un bloc de code est affiché à l’écran");
            }
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block || line.is_empty() {
            continue;
        }
        // Markdown table separators and horizontal rules.
        if line
            .chars()
            .all(|c| matches!(c, '|' | '-' | ':' | ' ' | '*' | '_' | '='))
        {
            continue;
        }
        let line = line.trim_start_matches(['#', '>']).trim_start();
        let line = ["- ", "* ", "+ ", "• "]
            .iter()
            .find_map(|bullet| line.strip_prefix(bullet))
            .unwrap_or(line);
        let cleaned = line
            .replace('|', ", ")
            .split_whitespace()
            .filter(|word| !word.contains("://") && !word.starts_with("www."))
            .map(|word| {
                word.replace("**", "")
                    .replace(['`', '[', ']'], "")
                    .trim_matches(['*', '_'])
                    .to_string()
            })
            .filter(|word| !word.is_empty())
            .collect::<Vec<_>>()
            .join(" ");
        push_sentence(&mut out, &cleaned);
    }
    out
}

#[cfg(feature = "gui")]
fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut current = String::new();
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        current.push(c);
        let boundary = matches!(c, '.' | '!' | '?' | '…' | ';')
            && chars.peek().is_none_or(|next| next.is_whitespace());
        if boundary {
            let sentence = current.trim().to_string();
            if !sentence.is_empty() {
                sentences.push(sentence);
            }
            current.clear();
        }
    }
    let rest = current.trim();
    if !rest.is_empty() {
        sentences.push(rest.to_string());
    }
    sentences
}

/// Group sentences into chunks of at most `max` characters, splitting overly
/// long sentences on commas, then on words.
#[cfg(feature = "gui")]
fn pack_sentences(sentences: Vec<String>, max: usize) -> Vec<String> {
    let mut pieces = Vec::new();
    for sentence in sentences {
        if sentence.chars().count() <= max {
            pieces.push(sentence);
            continue;
        }
        let mut piece = String::new();
        for word in sentence.split_inclusive([',', ' ']) {
            if !piece.is_empty() && piece.chars().count() + word.chars().count() > max {
                pieces.push(piece.trim().to_string());
                piece.clear();
            }
            piece.push_str(word);
        }
        if !piece.trim().is_empty() {
            pieces.push(piece.trim().to_string());
        }
    }

    let mut chunks: Vec<String> = Vec::new();
    for piece in pieces {
        match chunks.last_mut() {
            Some(last) if last.chars().count() + 1 + piece.chars().count() <= max => {
                last.push(' ');
                last.push_str(&piece);
            }
            _ => chunks.push(piece),
        }
    }
    chunks
}

// ---------------------------------------------------------------------------
// Whisper model management
// ---------------------------------------------------------------------------

#[cfg(feature = "gui")]
fn whisper_install_dir() -> std::path::PathBuf {
    agent_common::config::AgentConfig::platform_data_dir()
        .join("models")
        .join("whisper")
}

/// Locations searched for a Whisper model: the platform data dir (where the
/// GUI installs it), next to the executable (packaged builds, macOS bundle
/// resources) and the historic relative `models/whisper` directory.
#[cfg(feature = "gui")]
fn find_whisper_model_file(spec: &WhisperModelSpec) -> Option<std::path::PathBuf> {
    let mut candidates = vec![whisper_install_dir().join(spec.file_name)];
    if let Ok(exe) = std::env::current_exe()
        && let Some(dir) = exe.parent()
    {
        candidates.push(dir.join("models").join("whisper").join(spec.file_name));
        candidates.push(
            dir.join("..")
                .join("Resources")
                .join("models")
                .join("whisper")
                .join(spec.file_name),
        );
    }
    candidates.push(
        std::path::PathBuf::from("models")
            .join("whisper")
            .join(spec.file_name),
    );
    candidates.into_iter().find(|path| {
        path.metadata()
            .is_ok_and(|meta| meta.is_file() && meta.len() > 0)
    })
}

/// The preferred model when installed, otherwise the first installed one.
#[cfg(feature = "gui")]
fn pick_whisper_model(preferred: &str) -> Option<(&'static WhisperModelSpec, std::path::PathBuf)> {
    let preferred = agent_gui::dto::whisper_model_spec(preferred);
    preferred
        .into_iter()
        .chain(agent_gui::dto::WHISPER_MODELS.iter())
        .find_map(|spec| find_whisper_model_file(spec).map(|path| (spec, path)))
}

#[cfg(feature = "gui")]
fn load_whisper_context(path: &std::path::Path) -> Result<whisper_rs::WhisperContext, String> {
    whisper_rs::WhisperContext::new_with_params(
        &path.to_string_lossy(),
        whisper_rs::WhisperContextParameters::default(),
    )
    .map_err(|e| e.to_string())
}

/// Load the preferred model lazily: a model installed or copied after start-up
/// is picked up at the next dictation, without restarting the agent.
#[cfg(feature = "gui")]
fn ensure_whisper_loaded(
    whisper_ctx: &WhisperSlot,
    whisper_key: &Arc<std::sync::Mutex<Option<String>>>,
    preferred: &str,
) -> Result<(), String> {
    let mut ctx = whisper_ctx.blocking_lock();
    let loaded_key = whisper_key.lock().ok().and_then(|key| key.clone());
    if ctx.is_some() && loaded_key.as_deref() == Some(preferred) {
        return Ok(());
    }
    let Some((spec, path)) = pick_whisper_model(preferred) else {
        return if ctx.is_some() {
            Ok(())
        } else {
            Err(WHISPER_MISSING.to_string())
        };
    };
    if ctx.is_some() && loaded_key.as_deref() == Some(spec.key) {
        return Ok(());
    }
    match load_whisper_context(&path) {
        Ok(loaded) => {
            info!(
                "VoiceService: Whisper model '{}' loaded from {}",
                spec.key,
                path.display()
            );
            *ctx = Some(loaded);
            if let Ok(mut key) = whisper_key.lock() {
                *key = Some(spec.key.to_string());
            }
            Ok(())
        }
        Err(e) if ctx.is_some() => {
            warn!(
                "VoiceService: keeping the current Whisper model, '{}' failed to load: {}",
                spec.key, e
            );
            Ok(())
        }
        Err(e) => Err(format!(
            "modèle Whisper « {} » illisible ({e}) : réinstallez-le depuis « Réglages vocaux »",
            spec.label
        )),
    }
}

#[cfg(feature = "gui")]
enum InstallError {
    Cancelled,
    Failed(String),
}

/// Stream the model to a `.part` file while hashing it; only a file whose size
/// and SHA-256 match the pinned catalogue is moved into place.
#[cfg(feature = "gui")]
async fn download_whisper_model(
    spec: &WhisperModelSpec,
    tx: &mpsc::Sender<AgentEvent>,
    cancel: &AtomicBool,
) -> Result<std::path::PathBuf, InstallError> {
    use futures_util::StreamExt;
    use sha2::{Digest, Sha256};
    use tokio::io::AsyncWriteExt;

    let failed =
        |context: &str, e: &dyn std::fmt::Display| InstallError::Failed(format!("{context} : {e}"));
    let progress = |phase, downloaded| {
        let _ = tx.send(AgentEvent::VoiceModelInstall {
            progress: VoiceInstallProgress {
                model_key: spec.key.to_string(),
                phase,
                downloaded_bytes: downloaded,
                total_bytes: spec.size_bytes,
                error: None,
            },
        });
    };

    let dir = whisper_install_dir();
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| failed(&format!("création de {}", dir.display()), &e))?;
    let final_path = dir.join(spec.file_name);
    let part_path = dir.join(format!("{}.part", spec.file_name));

    progress(VoiceInstallPhase::Downloading, 0);
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(20))
        .timeout(std::time::Duration::from_secs(3_600))
        .user_agent(concat!("SentinelAgent/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| failed("client HTTP", &e))?;
    let response = client
        .get(spec.download_url())
        .send()
        .await
        .and_then(|response| response.error_for_status())
        .map_err(|e| {
            failed(
                "téléchargement impossible (vérifiez l’accès à huggingface.co)",
                &e,
            )
        })?;
    if let Some(length) = response.content_length()
        && length != spec.size_bytes
    {
        return Err(InstallError::Failed(format!(
            "taille inattendue ({length} octets au lieu de {})",
            spec.size_bytes
        )));
    }

    let mut file = tokio::fs::File::create(&part_path)
        .await
        .map_err(|e| failed("écriture du modèle", &e))?;
    let mut hasher = Sha256::new();
    let mut downloaded = 0u64;
    let mut last_report = std::time::Instant::now();
    let mut stream = response.bytes_stream();

    let result: Result<(), InstallError> = async {
        while let Some(chunk) = stream.next().await {
            if cancel.load(Ordering::SeqCst) {
                return Err(InstallError::Cancelled);
            }
            let chunk = chunk.map_err(|e| failed("connexion interrompue", &e))?;
            downloaded += chunk.len() as u64;
            if downloaded > spec.size_bytes {
                return Err(InstallError::Failed(
                    "fichier plus volumineux que prévu".to_string(),
                ));
            }
            hasher.update(&chunk);
            file.write_all(&chunk)
                .await
                .map_err(|e| failed("écriture du modèle", &e))?;
            if last_report.elapsed() >= std::time::Duration::from_millis(250) {
                last_report = std::time::Instant::now();
                progress(VoiceInstallPhase::Downloading, downloaded);
            }
        }
        file.flush()
            .await
            .map_err(|e| failed("écriture du modèle", &e))?;
        file.sync_all()
            .await
            .map_err(|e| failed("écriture du modèle", &e))?;
        progress(VoiceInstallPhase::Verifying, downloaded);
        if downloaded != spec.size_bytes {
            return Err(InstallError::Failed(format!(
                "téléchargement incomplet ({downloaded} / {} octets)",
                spec.size_bytes
            )));
        }
        let digest = hex::encode(std::mem::take(&mut hasher).finalize());
        if !digest.eq_ignore_ascii_case(spec.sha256) {
            return Err(InstallError::Failed(
                "empreinte SHA-256 invalide : fichier rejeté".to_string(),
            ));
        }
        Ok(())
    }
    .await;
    drop(file);

    if let Err(e) = result {
        let _ = tokio::fs::remove_file(&part_path).await;
        return Err(e);
    }
    tokio::fs::rename(&part_path, &final_path)
        .await
        .map_err(|e| failed("installation du modèle", &e))?;
    Ok(final_path)
}

// ---------------------------------------------------------------------------
// Capture and transcription
// ---------------------------------------------------------------------------

#[cfg(feature = "gui")]
#[derive(Debug, Clone)]
struct CaptureOptions {
    model_key: String,
    language: String,
    end_of_speech_ms: usize,
    max_seconds: usize,
    start_timeout_ms: usize,
}

#[cfg(feature = "gui")]
impl Default for CaptureOptions {
    fn default() -> Self {
        Self::from_settings(&VoiceSettings::default())
    }
}

#[cfg(feature = "gui")]
impl CaptureOptions {
    fn from_settings(settings: &VoiceSettings) -> Self {
        let settings = settings.clone().sanitized();
        Self {
            model_key: settings.whisper_model,
            language: settings.dictation_language,
            end_of_speech_ms: settings.end_of_speech_ms as usize,
            // Long questions are welcome: Whisper handles them in 30 s windows.
            max_seconds: 120,
            start_timeout_ms: 10_000,
        }
    }
}

/// Keep the microphone closed for a moment after Sentinel stopped speaking.
#[cfg(feature = "gui")]
fn wait_for_echo_to_settle(
    speech_ended_at: &std::sync::Mutex<Option<std::time::Instant>>,
    cancel: &AtomicBool,
) {
    const SETTLE: std::time::Duration = std::time::Duration::from_millis(350);
    let ended = speech_ended_at.lock().ok().and_then(|ended| *ended);
    if let Some(ended) = ended {
        let elapsed = ended.elapsed();
        if elapsed < SETTLE && !cancel.load(Ordering::SeqCst) {
            std::thread::sleep(SETTLE - elapsed);
        }
    }
}

/// Short vocabulary hint: Whisper recognizes security jargon much better.
#[cfg(feature = "gui")]
const WHISPER_PROMPT_FR: &str =
    "Sentinel, cybersécurité, CVE, EDR, SOC, RSSI, pare-feu, vulnérabilités, conformité.";

/// Capture mic audio until a natural end-of-speech is detected, then run Whisper.
#[cfg(feature = "gui")]
fn record_and_transcribe(
    whisper_ctx: &WhisperSlot,
    tx_level: &mpsc::Sender<AgentEvent>,
    cancel: &Arc<AtomicBool>,
    finish: &Arc<AtomicBool>,
    options: &CaptureOptions,
) -> Result<Option<String>, String> {
    use cpal::SampleFormat;
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use std::sync::Mutex;
    use std::time::Duration;

    if whisper_ctx.blocking_lock().is_none() {
        return Err(WHISPER_MISSING.into());
    }
    if cancel.load(Ordering::SeqCst) {
        return Ok(None);
    }
    let host = cpal::default_host();
    let device = host.default_input_device().ok_or_else(|| {
        "aucun microphone détecté : branchez-en un ou autorisez l’accès au micro".to_string()
    })?;
    let dev_name = device.name().unwrap_or_else(|_| "(inconnu)".into());
    info!("VoiceService: capturing from '{}'", dev_name);

    let supported = device.default_input_config().map_err(|e| {
        format!("microphone inaccessible ({e}) : vérifiez les autorisations du système")
    })?;
    let sample_rate = supported.sample_rate().0;
    let channels = supported.channels() as usize;
    let sample_format = supported.sample_format();
    let config: cpal::StreamConfig = supported.clone().into();

    let shared: Arc<Mutex<Vec<f32>>> =
        Arc::new(Mutex::new(Vec::with_capacity(sample_rate as usize * 20)));
    let buf_cb = shared.clone();

    let (stream_error_tx, stream_error_rx) = mpsc::channel();
    let err_fn = move |err| {
        error!("cpal input error: {}", err);
        let _ = stream_error_tx.send(format!("erreur du microphone : {err}"));
    };

    let stream = match sample_format {
        SampleFormat::F32 => device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    push_mono(&buf_cb, data, channels, |s| s);
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("ouverture du microphone : {e}"))?,
        SampleFormat::I16 => device
            .build_input_stream(
                &config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    push_mono(&buf_cb, data, channels, |s| s as f32 / 32_768.0);
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("ouverture du microphone : {e}"))?,
        SampleFormat::U16 => device
            .build_input_stream(
                &config,
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    push_mono(&buf_cb, data, channels, |s| {
                        (s as f32 - 32_768.0) / 32_768.0
                    });
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("ouverture du microphone : {e}"))?,
        other => return Err(format!("format audio non supporté: {other:?}")),
    };

    stream
        .play()
        .map_err(|e| format!("démarrage du microphone : {e}"))?;

    // VAD parameters — all expressed in 20 ms frames at the native mono rate.
    let frame_ms = 20usize;
    let frame_len = (sample_rate as usize * frame_ms) / 1000;
    let max_total_samples = sample_rate as usize * options.max_seconds;
    // Natural pauses inside a sentence must not end the dictation.
    let silence_hangover_frames = options.end_of_speech_ms / frame_ms;
    let min_speech_frames = 250 / frame_ms; // require 250 ms before ending
    let initial_timeout_frames = options.start_timeout_ms / frame_ms;
    let preroll_frames = 300 / frame_ms; // keep 300 ms before onset
    let mut vad = VoiceActivityDetector::default();
    let mut in_speech = false;
    let mut speech_frames = 0usize;
    let mut silence_frames = 0usize;
    let mut idle_frames = 0usize;
    let mut preroll: std::collections::VecDeque<Vec<f32>> =
        std::collections::VecDeque::with_capacity(preroll_frames + 1);
    let mut captured: Vec<f32> = Vec::with_capacity(sample_rate as usize * 20);
    let mut cursor = 0usize;
    let mut last_audio = std::time::Instant::now();
    // Throttle the audio-level event to ~10 Hz (every 5 frames at 20 ms).
    let mut level_frame_counter: usize = 0;

    loop {
        std::thread::sleep(Duration::from_millis(frame_ms as u64 / 2));

        // Honor a user-initiated cancel (mic toggle off) between frames.
        if cancel.load(Ordering::SeqCst) {
            info!("VoiceService: capture cancelled by UI");
            return Ok(None);
        }
        // “Finish” keeps what was said so far, like releasing a talk button.
        if finish.load(Ordering::SeqCst) {
            info!("VoiceService: capture finished by UI");
            break;
        }

        if let Ok(error) = stream_error_rx.try_recv() {
            return Err(error);
        }
        if last_audio.elapsed() > Duration::from_secs(3) {
            return Err("aucun signal reçu du microphone : vérifiez le périphérique d’entrée et les autorisations du système".into());
        }

        // Pull one frame from the shared buffer.
        let frame: Vec<f32> = {
            let guard = shared.lock().map_err(|_| "mutex poisoned".to_string())?;
            if guard.len() < cursor + frame_len {
                continue;
            }
            guard[cursor..cursor + frame_len].to_vec()
        };
        cursor += frame_len;
        last_audio = std::time::Instant::now();

        let rms = rms_of(&frame);

        level_frame_counter += 1;
        if level_frame_counter >= 5 {
            level_frame_counter = 0;
            // Soft-clip to [0, 1] — speech typically sits in [0.01, 0.3].
            let normalized = (rms * 4.0).min(1.0);
            let _ = tx_level.send(AgentEvent::AudioLevel { rms: normalized });
        }

        let (speech_on, speech_off) = vad.thresholds();

        if !in_speech {
            preroll.push_back(frame.clone());
            while preroll.len() > preroll_frames {
                preroll.pop_front();
            }

            if rms > speech_on {
                in_speech = true;
                silence_frames = 0;
                for p in preroll.drain(..) {
                    captured.extend_from_slice(&p);
                }
                speech_frames = 1;
            } else {
                vad.observe_noise(rms);
                idle_frames += 1;
                if idle_frames >= initial_timeout_frames {
                    info!(
                        "VoiceService: no speech within the start timeout, ending capture session"
                    );
                    break;
                }
            }
        } else {
            captured.extend_from_slice(&frame);
            speech_frames += 1;

            if rms < speech_off {
                silence_frames += 1;
                if silence_frames >= silence_hangover_frames && speech_frames >= min_speech_frames {
                    info!(
                        "VoiceService: end of speech after {} ms",
                        speech_frames * frame_ms
                    );
                    break;
                }
            } else {
                silence_frames = 0;
            }

            if captured.len() >= max_total_samples {
                info!("VoiceService: max duration reached");
                break;
            }
        }
    }

    // Stop the stream before CPU-heavy transcription.
    drop(stream);

    if cancel.load(Ordering::SeqCst) || captured.len() < (sample_rate as usize * 300) / 1000 {
        return Ok(None);
    }
    let _ = tx_level.send(AgentEvent::VoiceTranscribing);

    // Whisper expects mono f32 at 16 kHz.
    let samples_16k = if sample_rate == 16_000 {
        captured
    } else {
        resample_to_16k(&captured, sample_rate)
    };

    // Pad to at least 1 s — whisper-rs rejects very short inputs on some builds.
    let min_len = 16_000;
    let samples_16k = if samples_16k.len() < min_len {
        let mut padded = samples_16k;
        padded.resize(min_len, 0.0);
        padded
    } else {
        samples_16k
    };

    let ctx_guard = whisper_ctx.blocking_lock();
    let ctx = ctx_guard
        .as_ref()
        .ok_or_else(|| WHISPER_MISSING.to_string())?;

    let mut state = ctx
        .create_state()
        .map_err(|e| format!("create_state: {e}"))?;
    let mut params =
        whisper_rs::FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });
    let threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .clamp(1, 8);
    params.set_n_threads(threads as std::os::raw::c_int);
    params.set_language(Some(options.language.as_str()));
    if options.language == "fr" {
        params.set_initial_prompt(WHISPER_PROMPT_FR);
    }
    params.set_translate(false);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_no_context(true);
    params.set_suppress_blank(true);
    params.set_suppress_non_speech_tokens(true);
    params.set_single_segment(false);

    state
        .full(params, &samples_16k)
        .map_err(|e| format!("whisper full: {e}"))?;

    let n = state
        .full_n_segments()
        .map_err(|e| format!("full_n_segments: {e}"))?;
    let mut text = String::new();
    for i in 0..n {
        if let Ok(seg) = state.full_get_segment_text(i) {
            text.push_str(&seg);
        }
    }
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");

    if cancel.load(Ordering::SeqCst) || text.is_empty() || is_whisper_hallucination(&text) {
        return Ok(None);
    }

    Ok(Some(text))
}

#[cfg(feature = "gui")]
fn push_mono<T: Copy>(
    shared: &Arc<std::sync::Mutex<Vec<f32>>>,
    data: &[T],
    channels: usize,
    to_f32: impl Fn(T) -> f32,
) {
    if let Ok(mut buf) = shared.lock() {
        if channels <= 1 {
            buf.extend(data.iter().copied().map(&to_f32));
        } else {
            for frame in data.chunks(channels) {
                let mut sum = 0f32;
                for s in frame {
                    sum += to_f32(*s);
                }
                buf.push(sum / frame.len() as f32);
            }
        }
    }
}

/// Start listening immediately: the first syllable must never calibrate the
/// noise floor. Only frames below the onset threshold update the estimate.
#[cfg(feature = "gui")]
struct VoiceActivityDetector {
    noise_rms: f32,
}

#[cfg(feature = "gui")]
impl Default for VoiceActivityDetector {
    fn default() -> Self {
        Self { noise_rms: 0.0005 }
    }
}

#[cfg(feature = "gui")]
impl VoiceActivityDetector {
    fn thresholds(&self) -> (f32, f32) {
        (
            (self.noise_rms * 2.5).clamp(0.002, 0.025),
            (self.noise_rms * 1.5).clamp(0.001, 0.015),
        )
    }

    fn observe_noise(&mut self, rms: f32) {
        self.noise_rms = self.noise_rms * 0.95 + rms * 0.05;
    }
}

#[cfg(feature = "gui")]
fn rms_of(frame: &[f32]) -> f32 {
    if frame.is_empty() {
        return 0.0;
    }
    let sum_sq: f32 = frame.iter().map(|s| s * s).sum();
    (sum_sq / frame.len() as f32).sqrt()
}

/// Downmix + resample to 16 kHz mono f32. Box-average for integer ratios (48 k, 32 k, 16 k),
/// linear interpolation otherwise (44.1 k, etc.). Good enough for Whisper.
#[cfg(feature = "gui")]
fn resample_to_16k(samples: &[f32], from_sr: u32) -> Vec<f32> {
    let to_sr = 16_000u32;
    if from_sr == to_sr {
        return samples.to_vec();
    }

    if from_sr > to_sr && from_sr.is_multiple_of(to_sr) {
        let factor = (from_sr / to_sr) as usize;
        return samples
            .chunks(factor)
            .map(|c| c.iter().sum::<f32>() / c.len() as f32)
            .collect();
    }

    let ratio = to_sr as f64 / from_sr as f64;
    let out_len = ((samples.len() as f64) * ratio).round() as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let src = i as f64 / ratio;
        let idx = src as usize;
        let frac = (src - idx as f64) as f32;
        let a = *samples.get(idx).unwrap_or(&0.0);
        let b = *samples.get(idx + 1).unwrap_or(&a);
        out.push(a * (1.0 - frac) + b * frac);
    }
    out
}

/// Whisper tends to invent stock French captions when fed near-silence. Filter those.
#[cfg(feature = "gui")]
fn is_whisper_hallucination(text: &str) -> bool {
    let low = text.to_lowercase();
    const NEEDLES: &[&str] = &[
        "sous-titres réalisés",
        "sous-titrage",
        "merci d'avoir regardé",
        "merci de votre attention",
        "abonnez-vous",
        "thanks for watching",
        "♪",
    ];
    if NEEDLES.iter().any(|n| low.contains(n))
        || low.trim_end_matches('.') == WHISPER_PROMPT_FR.to_lowercase().trim_end_matches('.')
    {
        return true;
    }
    // Pure punctuation or very short fillers.
    let trimmed: String = low.chars().filter(|c| c.is_alphanumeric()).collect();
    trimmed.len() < 2
}

#[cfg(all(test, feature = "gui"))]
mod workflow_tests {
    use super::*;

    #[test]
    fn quiet_speech_is_detected_even_when_it_starts_immediately() {
        let mut vad = VoiceActivityDetector::default();
        // A quiet voice that the old 0.0072 initial threshold rejected.
        for rms in [0.003, 0.004, 0.003, 0.005] {
            assert!(rms > vad.thresholds().0);
        }
        for _ in 0..500 {
            let noise = 0.0004;
            assert!(noise < vad.thresholds().0);
            vad.observe_noise(noise);
        }
        assert!(0.003 > vad.thresholds().0);
        assert!(vad.thresholds().1 < vad.thresholds().0);
    }

    fn silent_service(tx: mpsc::Sender<AgentEvent>) -> VoiceService {
        // No OS audio backend, microphone or model is opened in these tests.
        VoiceService {
            event_tx: tx,
            tts_engine: Arc::new(std::sync::Mutex::new(None)),
            speech_epoch: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            settings: Arc::new(std::sync::RwLock::new(VoiceSettings::default())),
            speech_ended_at: Arc::new(std::sync::Mutex::new(None)),
            sound_manager: None,
            whisper_ctx: Arc::new(tokio::sync::Mutex::new(None)),
            whisper_key: Arc::new(std::sync::Mutex::new(None)),
            is_listening: Arc::new(AtomicBool::new(false)),
            cancel_requested: Arc::new(AtomicBool::new(false)),
            finish_requested: Arc::new(AtomicBool::new(false)),
            installing: Arc::new(AtomicBool::new(false)),
            install_cancel: Arc::new(AtomicBool::new(false)),
        }
    }

    #[test]
    fn stopping_speech_invalidates_an_answer_still_being_generated() {
        let (tx, rx) = mpsc::channel();
        let service = silent_service(tx);
        let generation = service.speech_generation();
        service.stop_speaking();
        assert!(matches!(
            rx.try_recv(),
            Ok(AgentEvent::VoiceStatus { speaking: false })
        ));
        service.speak_if_current("Réponse devenue obsolète", generation);
        assert!(rx.try_recv().is_err());
        assert_ne!(service.speech_generation(), generation);
        service.stop_listening();
        assert!(service.cancel_requested.load(Ordering::SeqCst));
        service.finish_listening();
        assert!(service.finish_requested.load(Ordering::SeqCst));
    }

    #[test]
    fn missing_whisper_model_fails_before_opening_microphone() {
        let (tx, _rx) = mpsc::channel();
        let error = record_and_transcribe(
            &Arc::new(tokio::sync::Mutex::new(None)),
            &tx,
            &Arc::new(AtomicBool::new(false)),
            &Arc::new(AtomicBool::new(false)),
            &CaptureOptions::default(),
        )
        .unwrap_err();
        assert!(error.contains("Whisper"));
    }

    #[test]
    fn capture_options_follow_operator_settings() {
        let settings = VoiceSettings {
            end_of_speech_ms: 2_000,
            dictation_language: "auto".into(),
            ..VoiceSettings::default()
        };
        let options = CaptureOptions::from_settings(&settings);
        assert_eq!(options.end_of_speech_ms, 2_000);
        assert_eq!(options.language, "auto");
        assert!(options.max_seconds >= 60, "long questions must not be cut");
    }

    #[test]
    fn long_answers_are_read_completely_in_sentence_chunks() {
        let sentence =
            "Le poste présente une vulnérabilité critique qui doit être corrigée rapidement.";
        let answer = (0..40)
            .map(|i| format!("{i}. {sentence}"))
            .collect::<Vec<_>>()
            .join("\n");
        let chunks = spoken_chunks(&answer, SpokenReplyMode::Full);
        assert!(chunks.len() > 5);
        assert!(
            chunks
                .iter()
                .all(|chunk| chunk.chars().count() <= SPOKEN_CHUNK_CHARS)
        );
        let spoken = chunks.join(" ");
        assert_eq!(spoken.matches("vulnérabilité critique").count(), 40);
        assert!(!spoken.contains("affichée à l’écran"));
    }

    #[test]
    fn summary_mode_stops_on_a_sentence_boundary() {
        let answer = "Première phrase importante. ".repeat(80);
        let chunks = spoken_chunks(&answer, SpokenReplyMode::Summary);
        let spoken = chunks.join(" ");
        assert!(spoken.chars().count() < SUMMARY_CHARS + 120);
        assert!(spoken.ends_with("La suite de la réponse est affichée à l’écran."));
        assert!(!spoken.contains("Première phrase importante Première"));
    }

    #[test]
    fn markdown_code_and_links_are_not_read_aloud() {
        let answer = "## Constat\n**Risque élevé** sur `sshd` :\n- voir https://example.com/cve\n```bash\nrm -rf /tmp/x\n```\n| Hôte | Score |\n|---|---|\n| srv1 | 9 |";
        let spoken = spoken_chunks(answer, SpokenReplyMode::Full).join(" ");
        assert!(!spoken.contains('#') && !spoken.contains('*') && !spoken.contains('`'));
        assert!(!spoken.contains("https") && !spoken.contains("rm -rf"));
        assert!(spoken.contains("Un bloc de code est affiché à l’écran."));
        assert!(spoken.contains("Risque élevé sur sshd."));
        assert!(spoken.contains("srv1"));
    }

    #[test]
    fn reasoning_blocks_are_never_read_aloud() {
        let answer =
            "<think>\nJe dois d'abord analyser les processus.\n</think>\nLe poste est sain.";
        assert_eq!(
            spoken_chunks(answer, SpokenReplyMode::Full),
            vec!["Le poste est sain."]
        );
        let truncated = "<think>Raisonnement interminable";
        assert!(spoken_chunks(truncated, SpokenReplyMode::Full).is_empty());
    }

    #[test]
    fn very_long_sentences_are_split_on_words() {
        let answer = "mot ".repeat(400);
        let chunks = spoken_chunks(&answer, SpokenReplyMode::Full);
        assert!(chunks.len() >= 6);
        assert!(
            chunks
                .iter()
                .all(|chunk| chunk.chars().count() <= SPOKEN_CHUNK_CHARS)
        );
    }

    #[test]
    fn empty_answer_releases_the_voice_session() {
        let (tx, rx) = mpsc::channel();
        let service = silent_service(tx);
        service.speak("");
        assert!(matches!(
            rx.recv_timeout(std::time::Duration::from_secs(2)),
            Ok(AgentEvent::VoiceStatus { speaking: false })
        ));
    }

    fn split_stream(fragments: &[&str]) -> Vec<String> {
        let mut splitter = SpeechSplitter::default();
        let mut out: Vec<String> = fragments.iter().flat_map(|f| splitter.push(f)).collect();
        out.extend(splitter.finish());
        out
    }

    #[test]
    fn streamed_answer_is_spoken_sentence_by_sentence() {
        // Tokens arrive a few characters at a time.
        let answer = "Le poste présente trois risques majeurs à traiter. Le premier concerne OpenSSL qui doit être mis à jour. Le second";
        let fragments: Vec<String> = answer
            .chars()
            .collect::<Vec<_>>()
            .chunks(3)
            .map(|c| c.iter().collect())
            .collect();
        let mut splitter = SpeechSplitter::default();
        let mut early = Vec::new();
        for fragment in &fragments {
            early.extend(splitter.push(fragment));
        }
        assert!(
            !early.is_empty(),
            "speech must start before the answer ends"
        );
        assert!(early[0].starts_with("Le poste présente trois risques"));
        let mut all = early;
        all.extend(splitter.finish());
        assert_eq!(
            all.join(" ").split_whitespace().collect::<Vec<_>>(),
            answer.split_whitespace().collect::<Vec<_>>()
        );
    }

    #[test]
    fn streamed_code_and_reasoning_are_not_spoken() {
        let segments = split_stream(&[
            "<think>\nJe réfléchis",
            " longuement.\n</think>\nVoici la commande :\n```bash\nrm -rf /tmp/x\n",
            "```\nFin.",
        ]);
        let spoken = segments
            .iter()
            .flat_map(|s| spoken_chunks(s, SpokenReplyMode::Full))
            .collect::<Vec<_>>()
            .join(" ");
        assert!(!spoken.contains("réfléchis") && !spoken.contains("rm -rf"));
        assert!(spoken.contains("Voici la commande."));
        assert_eq!(spoken.matches("Un bloc de code").count(), 1);
        assert!(spoken.ends_with("Fin."));
    }

    #[test]
    fn short_numbered_prefixes_are_not_spoken_alone() {
        let segments = split_stream(&[
            "1. Mettre à jour",
            " OpenSSL vers la version 3.0.14 corrigée",
        ]);
        assert_eq!(
            segments,
            vec!["1. Mettre à jour OpenSSL vers la version 3.0.14 corrigée"]
        );
    }

    #[test]
    fn backend_rate_mapping_stays_in_range() {
        assert_eq!(backend_rate(1.0, 0.0, 0.5, 1.0), 0.5);
        assert!(backend_rate(2.0, 0.0, 0.5, 1.0) > 0.5);
        assert!(backend_rate(0.5, 0.0, 0.5, 1.0) < 0.5);
        assert!(backend_rate(2.0, -10.0, 0.0, 10.0) <= 10.0);
        assert!(backend_rate(0.5, -10.0, 0.0, 10.0) >= -10.0);
    }

    #[test]
    fn missing_model_is_reported_without_a_microphone() {
        let error = ensure_whisper_loaded(
            &Arc::new(tokio::sync::Mutex::new(None)),
            &Arc::new(std::sync::Mutex::new(None)),
            "unknown",
        );
        // Either a model is installed on the test host, or the error explains how to install one.
        if let Err(message) = error {
            assert!(message.contains("Réglages vocaux"));
        }
    }
}
