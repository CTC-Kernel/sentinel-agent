//! Offscreen captures.
//!
//! Since eframe 0.34 (wgpu 29), a window that is not on screen because the
//! screen is locked, the display asleep or the window covered is not painted,
//! so a window capture never gets its pixels. `PREVIEW_OUT` therefore runs the
//! same `Preview` app through egui_kittest, which renders into a texture with
//! no window at all, with the renderer eframe gives the window.

use std::time::{Duration, Instant};

use agent_gui::theme;
use eframe::{egui, egui_wgpu};
use egui_kittest::{Harness, TestRenderer, wgpu::WgpuTestRenderer};

use crate::Preview;

/// Frames rendered before the capture when PREVIEW_SHOT is not set.
const DEFAULT_FRAMES: u32 = 8;

/// The scale of a window capture on a Retina Mac, so both kinds of capture
/// have the same size: the 1360x820 point window gives a 2720x1640 PNG.
const PIXELS_PER_POINT: f32 = 2.0;

/// How long a frame waits for images still being decoded. They decode on a
/// worker thread, which a window gives the real time between its frames.
const IMAGE_WAIT: Duration = Duration::from_secs(2);

/// Render PREVIEW_SHOT frames (or [`DEFAULT_FRAMES`]) offscreen and write the
/// last one to `path` as a PNG.
pub fn capture(path: &str, size: egui::Vec2) -> Result<(), String> {
    let frames = std::env::var("PREVIEW_SHOT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_FRAMES);
    let mut harness = Harness::builder()
        .with_size(size)
        .with_pixels_per_point(PIXELS_PER_POINT)
        .with_os(egui::os::OperatingSystem::from_target_os())
        // Time moves on by one 60 Hz frame per step, as on a display.
        .with_step_dt(1.0 / 60.0)
        // The builder runs frames of its own to settle the UI; keep them to
        // the minimum so PREVIEW_SHOT counts frames as the window does.
        .with_max_steps(0)
        .renderer(NoPointer(window_renderer()?))
        .build_eframe(|cc| {
            theme::configure_fonts(&cc.egui_ctx);
            Preview {
                offscreen: true,
                shot_after: Some(frames),
                ..Preview::default()
            }
        });

    let hover = crate::hover_pos();
    // Every frame of the app counts itself, so this ends after `frames` steps
    // at most.
    for _ in 0..frames {
        if harness.state().frame_count >= frames {
            break;
        }
        let deadline = Instant::now() + IMAGE_WAIT;
        while harness.ctx.has_pending_images() && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(5));
        }
        if let Some(pos) = hover {
            harness.hover_at(pos);
        }
        harness.step();
    }

    let image = harness.render()?;
    image.save(path).map_err(|err| err.to_string())?;
    eprintln!(
        "PREVIEW_OUT: {}x{} (offscreen, screen {:?})",
        image.width(),
        image.height(),
        harness.ctx.content_rect().size()
    );
    Ok(())
}

/// The renderer eframe gives the window (dithering, hardware texture
/// filtering) rather than kittest's predictable one, so an offscreen capture
/// has the pixels a window capture of the same frame would.
fn window_renderer() -> Result<WgpuTestRenderer, String> {
    let config = egui_wgpu::WgpuConfiguration::default();
    let instance = pollster::block_on(config.wgpu_setup.new_instance());
    let state = pollster::block_on(egui_wgpu::RenderState::create(
        &config,
        &instance,
        None,
        egui_wgpu::RendererOptions::default(),
    ))
    .map_err(|err| format!("no GPU for an offscreen render: {err}"))?;
    Ok(WgpuTestRenderer::from_render_state(state))
}

/// kittest draws a pointer at the hover position (PREVIEW_HOVER); a window
/// capture never shows it, so it is left out: the last shape of the frame, a
/// triangle whose tip is that position.
struct NoPointer(WgpuTestRenderer);

impl TestRenderer for NoPointer {
    fn setup_eframe(&self, cc: &mut eframe::CreationContext<'_>, frame: &mut eframe::Frame) {
        self.0.setup_eframe(cc, frame);
    }

    fn handle_delta(&mut self, delta: &egui::TexturesDelta) {
        self.0.handle_delta(delta);
    }

    fn render(
        &mut self,
        ctx: &egui::Context,
        output: &egui::FullOutput,
    ) -> Result<image::RgbaImage, String> {
        let tip = ctx.input(|i| i.pointer.hover_pos());
        let is_pointer = |clipped: &egui::epaint::ClippedShape| {
            matches!(&clipped.shape, egui::Shape::Path(path)
                if path.points.len() == 3 && path.points.first() == tip.as_ref())
        };
        if tip.is_some() && output.shapes.last().is_some_and(is_pointer) {
            let mut output = output.clone();
            output.shapes.pop();
            return self.0.render(ctx, &output);
        }
        self.0.render(ctx, output)
    }
}
