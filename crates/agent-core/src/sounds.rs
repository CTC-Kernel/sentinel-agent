// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use tracing::error;

/// Iron Man style frequency-based beep synthesizer for Sentinel.
pub struct SoundManager {
    device: cpal::Device,
    config: cpal::StreamConfig,
}

impl SoundManager {
    pub fn new() -> Option<Self> {
        let host = cpal::default_host();
        let device = host.default_output_device()?;
        let config = device.default_output_config().ok()?;
        
        Some(Self {
            device,
            config: config.into(),
        })
    }

    /// Play a sequence of tones (Iron Man style confirmation).
    pub fn play_confirmation(&self) {
        let tones = vec![
            (880.0, 0.1), // A5
            (1760.0, 0.05), // A6
        ];
        self.play_tones(tones);
    }

    /// Play a "Scan Started" sound (rising frequency).
    pub fn play_scan_start(&self) {
        let tones = vec![
            (440.0, 0.1),
            (554.37, 0.1),
            (659.25, 0.1),
        ];
        self.play_tones(tones);
    }

    /// Play an error sound (falling frequency).
    pub fn play_error(&self) {
        let tones = vec![
            (220.0, 0.2),
            (110.0, 0.3),
        ];
        self.play_tones(tones);
    }

    fn play_tones(&self, tones: Vec<(f32, f32)>) {
        let sample_rate = self.config.sample_rate.0 as f32;
        let channels = self.config.channels as usize;
        let device = self.device.clone();
        let config = self.config.clone();

        std::thread::spawn(move || {
            for (freq, duration) in tones {
                let mut sample_clock = 0f32;
                let _num_samples = (duration * sample_rate) as usize;
                
                let stream = device.build_output_stream(
                    &config,
                    move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                        for frame in data.chunks_mut(channels) {
                            let value = (sample_clock * freq * 2.0 * std::f32::consts::PI / sample_rate).sin();
                            for sample in frame.iter_mut() {
                                *sample = value * 0.2; // Volume 20%
                            }
                            sample_clock += 1.0;
                        }
                    },
                    |err| error!("SoundManager: Stream error: {}", err),
                    None,
                ).ok();

                if let Some(s) = stream {
                    let _ = s.play();
                    std::thread::sleep(std::time::Duration::from_secs_f32(duration));
                }
            }
        });
    }
}
