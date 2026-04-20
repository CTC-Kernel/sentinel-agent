use std::sync::Arc;
#[cfg(feature = "voice")]
use std::sync::atomic::{AtomicBool, Ordering};
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

    #[cfg(feature = "voice")]
    is_listening: Arc<AtomicBool>,

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
            let model_path = resolve_whisper_model_path();
            match whisper_rs::WhisperContext::new_with_params(
                &model_path.to_string_lossy(),
                whisper_rs::WhisperContextParameters::default(),
            ) {
                Ok(ctx) => {
                    info!("VoiceService: Whisper model loaded from {}", model_path.display());
                    Some(ctx)
                }
                Err(e) => {
                    warn!(
                        "VoiceService: Failed to load Whisper model at {}. STT will be mocked. {}",
                        model_path.display(),
                        e
                    );
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
            #[cfg(feature = "voice")]
            is_listening: Arc::new(AtomicBool::new(false)),
        }
    }

    #[cfg(feature = "voice")]
    pub fn play_beep(&self) {
        if let Some(sm) = &self.sound_manager {
            sm.play_confirmation();
        }
    }

    #[cfg(feature = "voice")]
    pub fn play_scan_sound(&self) {
        if let Some(sm) = &self.sound_manager {
            sm.play_scan_start();
        }
    }

    #[cfg(not(feature = "gui"))]
    pub fn new() -> Self {
        Self { _dummy: false }
    }

    /// Capture microphone audio via `cpal`, detect speech with an energy-based VAD,
    /// then transcribe via `whisper-rs` — and deliver the result as a
    /// `VoiceTranscription` event for the LLM pipeline.
    #[cfg(feature = "gui")]
    pub async fn start_listening(&self) {
        #[cfg(feature = "voice")]
        {
            if self.is_listening.swap(true, Ordering::SeqCst) {
                info!("VoiceService: already listening, ignoring re-entrant call");
                return;
            }
        }

        let tx = self.event_tx.clone();
        let _ = tx.send(AgentEvent::LlmVoiceState { active: true });

        #[cfg(feature = "voice")]
        {
            if let Some(sm) = &self.sound_manager {
                sm.play_scan_start();
            }

            let whisper_ctx = self.whisper_ctx.clone();
            let is_listening = self.is_listening.clone();
            let tx_task = tx.clone();

            // Whisper inference and cpal stream lifetime are both blocking — isolate
            // from the Tokio runtime so we never stall async workers.
            tokio::task::spawn_blocking(move || {
                let outcome = record_and_transcribe(&whisper_ctx);

                match outcome {
                    Ok(Some(text)) => {
                        info!("VoiceService: transcription = {:?}", text);
                        let _ = tx_task.send(AgentEvent::VoiceTranscription { text });
                    }
                    Ok(None) => {
                        info!("VoiceService: no speech detected");
                    }
                    Err(e) => {
                        warn!("VoiceService: capture/transcription failed: {}", e);
                        let _ = tx_task.send(AgentEvent::VoiceTranscription {
                            text: format!("(Erreur moteur vocal : {})", e),
                        });
                    }
                }

                is_listening.store(false, Ordering::SeqCst);
                let _ = tx_task.send(AgentEvent::LlmVoiceState { active: false });
            });
        }

        #[cfg(not(feature = "voice"))]
        {
            let tx_fallback = tx.clone();
            tokio::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
                let _ = tx_fallback.send(AgentEvent::VoiceTranscription {
                    text: "(Moteur vocal désactivé à la compilation)".to_string(),
                });
                let _ = tx_fallback.send(AgentEvent::LlmVoiceState { active: false });
            });
        }
    }

    /// Read out text using the OS Native Voice Synth (NSSpeechSynthesizer on macOS, SAPI on Win).
    /// This runs in a dedicated OS thread to never block Tokio runtime.
    #[cfg(feature = "gui")]
    pub fn speak(&self, text: &str) {
        info!("VoiceService: Native voice synthesis triggered.");

        let tx = self.event_tx.clone();
        let rt_text = text.to_string();
        let engine_lock = self.tts_engine.clone();

        std::thread::spawn(move || {
            let _ = tx.send(AgentEvent::VoiceStatus { speaking: true });

            let mut synth_duration = std::time::Duration::from_millis(2000);

            if let Ok(mut engine_opt) = engine_lock.lock()
                && let Some(engine) = engine_opt.as_mut()
            {
                if let Err(e) = engine.speak(&rt_text, false) {
                    warn!("VoiceService: TTS engine speak failed: {}", e);
                } else {
                    let char_count = rt_text.len() as u64;
                    synth_duration = std::time::Duration::from_millis(150 * char_count.max(10));
                }
            }

            std::thread::sleep(synth_duration);
            let _ = tx.send(AgentEvent::VoiceStatus { speaking: false });
        });
    }
}

/// Resolve the Whisper model path, preferring the platform data dir and falling
/// back to the historic `models/whisper/ggml-base.bin` relative path.
#[cfg(feature = "voice")]
fn resolve_whisper_model_path() -> std::path::PathBuf {
    let platform = agent_common::config::AgentConfig::platform_data_dir()
        .join("models")
        .join("whisper")
        .join("ggml-base.bin");
    if platform.exists() {
        return platform;
    }
    std::path::PathBuf::from("models/whisper/ggml-base.bin")
}

/// Capture mic audio until a natural end-of-speech is detected, then run Whisper.
#[cfg(feature = "voice")]
fn record_and_transcribe(
    whisper_ctx: &Arc<tokio::sync::Mutex<Option<whisper_rs::WhisperContext>>>,
) -> Result<Option<String>, String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use cpal::SampleFormat;
    use std::sync::Mutex;
    use std::time::Duration;

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "aucun microphone détecté".to_string())?;
    let dev_name = device.name().unwrap_or_else(|_| "(inconnu)".into());
    info!("VoiceService: capturing from '{}'", dev_name);

    let supported = device
        .default_input_config()
        .map_err(|e| format!("default_input_config: {e}"))?;
    let sample_rate = supported.sample_rate().0;
    let channels = supported.channels() as usize;
    let sample_format = supported.sample_format();
    let config: cpal::StreamConfig = supported.clone().into();

    let shared: Arc<Mutex<Vec<f32>>> =
        Arc::new(Mutex::new(Vec::with_capacity(sample_rate as usize * 20)));
    let buf_cb = shared.clone();

    let err_fn = |err| error!("cpal input error: {}", err);

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
            .map_err(|e| format!("build_input_stream f32: {e}"))?,
        SampleFormat::I16 => device
            .build_input_stream(
                &config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    push_mono(&buf_cb, data, channels, |s| s as f32 / 32_768.0);
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("build_input_stream i16: {e}"))?,
        SampleFormat::U16 => device
            .build_input_stream(
                &config,
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    push_mono(&buf_cb, data, channels, |s| (s as f32 - 32_768.0) / 32_768.0);
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("build_input_stream u16: {e}"))?,
        other => return Err(format!("format audio non supporté: {other:?}")),
    };

    stream.play().map_err(|e| format!("stream.play: {e}"))?;

    // VAD parameters — all expressed in 20 ms frames at the native mono rate.
    let frame_ms = 20usize;
    let frame_len = (sample_rate as usize * frame_ms) / 1000;
    let max_total_samples = sample_rate as usize * 20; // 20 s hard cap
    let silence_hangover_frames = 700 / frame_ms; // 700 ms of silence ends speech
    let min_speech_frames = 250 / frame_ms; // require 250 ms before ending
    let initial_timeout_frames = 6_000 / frame_ms; // 6 s to start talking
    let preroll_frames = 250 / frame_ms; // keep 250 ms before onset
    let calibration_total = 300 / frame_ms; // first 300 ms = noise floor

    let mut noise_rms: f32 = 0.004;
    let mut calibrated = 0usize;
    let mut in_speech = false;
    let mut speech_frames = 0usize;
    let mut silence_frames = 0usize;
    let mut idle_frames = 0usize;
    let mut preroll: std::collections::VecDeque<Vec<f32>> =
        std::collections::VecDeque::with_capacity(preroll_frames + 1);
    let mut captured: Vec<f32> = Vec::with_capacity(max_total_samples);
    let mut cursor = 0usize;

    loop {
        std::thread::sleep(Duration::from_millis(frame_ms as u64 / 2));

        // Pull one frame from the shared buffer.
        let frame: Vec<f32> = {
            let guard = shared.lock().map_err(|_| "mutex poisoned".to_string())?;
            if guard.len() < cursor + frame_len {
                continue;
            }
            guard[cursor..cursor + frame_len].to_vec()
        };
        cursor += frame_len;

        let rms = rms_of(&frame);

        if calibrated < calibration_total {
            // Track the loudest calibration frame as noise floor so breathing/fan are accepted.
            noise_rms = noise_rms.max(rms);
            calibrated += 1;
            preroll.push_back(frame);
            while preroll.len() > preroll_frames {
                preroll.pop_front();
            }
            continue;
        }

        let speech_on = (noise_rms * 3.0).max(0.015);
        let speech_off = (noise_rms * 1.8).max(0.009);

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
                captured.extend_from_slice(&frame);
                speech_frames = 1;
            } else {
                idle_frames += 1;
                if idle_frames >= initial_timeout_frames {
                    info!("VoiceService: no speech within 6 s, aborting");
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

    if captured.len() < (sample_rate as usize * 300) / 1000 {
        return Ok(None);
    }

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
        .ok_or_else(|| "modèle Whisper non chargé (models/whisper/ggml-base.bin)".to_string())?;

    let mut state = ctx
        .create_state()
        .map_err(|e| format!("create_state: {e}"))?;
    let mut params =
        whisper_rs::FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("fr"));
    params.set_translate(false);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_no_context(true);
    params.set_suppress_blank(true);
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
    let text = text.trim().to_string();

    if text.is_empty() || is_whisper_hallucination(&text) {
        return Ok(None);
    }

    Ok(Some(text))
}

#[cfg(feature = "voice")]
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

#[cfg(feature = "voice")]
fn rms_of(frame: &[f32]) -> f32 {
    if frame.is_empty() {
        return 0.0;
    }
    let sum_sq: f32 = frame.iter().map(|s| s * s).sum();
    (sum_sq / frame.len() as f32).sqrt()
}

/// Downmix + resample to 16 kHz mono f32. Box-average for integer ratios (48 k, 32 k, 16 k),
/// linear interpolation otherwise (44.1 k, etc.). Good enough for Whisper.
#[cfg(feature = "voice")]
fn resample_to_16k(samples: &[f32], from_sr: u32) -> Vec<f32> {
    let to_sr = 16_000u32;
    if from_sr == to_sr {
        return samples.to_vec();
    }

    if from_sr > to_sr && from_sr % to_sr == 0 {
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
#[cfg(feature = "voice")]
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
    if NEEDLES.iter().any(|n| low.contains(n)) {
        return true;
    }
    // Pure punctuation or very short fillers.
    let trimmed: String = low.chars().filter(|c| c.is_alphanumeric()).collect();
    trimmed.len() < 2
}
