//! Convert a report's HTML file to PDF, to check the layout by eye.
//!
//! `cargo run -p agent-gui --example report_pdf -- report.html report.pdf`
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let (Some(input), Some(output)) = (args.next(), args.next()) else {
        return Err("usage: <report.html> <report.pdf>".into());
    };
    let html = std::fs::read_to_string(&input)?;
    let title = std::path::Path::new(&input)
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .unwrap_or_default();
    std::fs::write(
        &output,
        agent_gui::pdf::report_pdf(&title, &html, chrono::Utc::now()),
    )?;
    println!("{output}");
    Ok(())
}
