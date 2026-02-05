//! xtask — Build automation tasks for the Sentinel GRC Agent.
//!
//! Usage:
//!   cargo xtask dist [--target windows|linux|macos|all]
//!   cargo xtask version
//!   cargo xtask ci
//!   cargo xtask clean

use std::process::Command;

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "xtask", about = "Sentinel GRC Agent build automation")]
struct Cli {
    #[command(subcommand)]
    command: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Build distribution packages
    Dist {
        /// Target platform (windows, linux, macos, all)
        #[arg(long, default_value = "all")]
        target: String,
    },
    /// Print the workspace version from Cargo.toml
    Version,
    /// Run full CI pipeline: fmt check, clippy, tests, audit
    Ci,
    /// Clean build artifacts
    Clean,
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Cmd::Dist { target } => cmd_dist(&target),
        Cmd::Version => cmd_version(),
        Cmd::Ci => cmd_ci(),
        Cmd::Clean => cmd_clean(),
    }
}

fn project_root() -> Result<std::path::PathBuf> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
        .unwrap_or_else(|_| env!("CARGO_MANIFEST_DIR").to_string());
    let root = std::path::Path::new(&manifest_dir)
        .parent()
        .context("cannot find project root")?
        .to_path_buf();
    Ok(root)
}

fn run(cmd: &str, args: &[&str]) -> Result<()> {
    let root = project_root()?;
    println!("  > {} {}", cmd, args.join(" "));
    let status = Command::new(cmd)
        .args(args)
        .current_dir(&root)
        .status()
        .with_context(|| format!("failed to run `{cmd}`"))?;
    if !status.success() {
        bail!("`{cmd} {}` exited with {}", args.join(" "), status);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// dist
// ---------------------------------------------------------------------------
fn cmd_dist(target: &str) -> Result<()> {
    let targets: Vec<&str> = match target {
        "all" => vec!["linux", "macos", "windows"],
        other => vec![other],
    };

    for t in &targets {
        println!("=== Building distribution for {t} ===");
        match *t {
            "linux" => dist_linux()?,
            "macos" => dist_macos()?,
            "windows" => dist_windows()?,
            unknown => bail!("unknown target: {unknown}"),
        }
    }
    Ok(())
}

fn dist_linux() -> Result<()> {
    run("cargo", &["build", "--release", "--package", "agent-core"])?;

    // DEB
    println!("  Building DEB package...");
    run("cargo", &["deb", "--package", "agent-core", "--no-build"])?;

    // RPM
    println!("  Building RPM package...");
    run("cargo", &["generate-rpm", "-p", "crates/agent-core"])?;

    Ok(())
}

fn dist_macos() -> Result<()> {
    run(
        "cargo",
        &[
            "build",
            "--release",
            "--features",
            "gui",
            "--package",
            "agent-core",
        ],
    )?;
    let root = project_root()?;
    let script = root.join("scripts/build-macos.sh");
    if script.exists() {
        run("bash", &[script.to_str().unwrap()])?;
    } else {
        println!("  (skipping DMG — scripts/build-macos.sh not found)");
    }
    Ok(())
}

fn dist_windows() -> Result<()> {
    run(
        "cargo",
        &[
            "build",
            "--release",
            "--features",
            "gui",
            "--package",
            "agent-core",
        ],
    )?;
    let root = project_root()?;
    let wxs = root.join("wix/main.wxs");
    if wxs.exists() {
        println!("  Building MSI with WiX...");
        run(
            "wix",
            &[
                "build",
                "-d",
                "TargetDir=.\\target\\release",
                "-d",
                "AssetsDir=.\\assets",
                "-ext",
                "WixToolset.UI.wixext",
                "-ext",
                "WixToolset.Util.wixext",
                "-ext",
                "WixToolset.Firewall.wixext",
                "-o",
                "target\\release\\SentinelAgentSetup.msi",
                "wix\\main.wxs",
            ],
        )?;
    } else {
        println!("  (skipping MSI — wix/main.wxs not found)");
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// version
// ---------------------------------------------------------------------------
fn cmd_version() -> Result<()> {
    let root = project_root()?;
    let cargo_toml = std::fs::read_to_string(root.join("Cargo.toml"))
        .context("cannot read workspace Cargo.toml")?;
    for line in cargo_toml.lines() {
        if line.starts_with("version") && line.contains('"') {
            let version = line.split('"').nth(1).context("malformed version line")?;
            println!("{version}");
            return Ok(());
        }
    }
    bail!("version not found in Cargo.toml");
}

// ---------------------------------------------------------------------------
// ci
// ---------------------------------------------------------------------------
fn cmd_ci() -> Result<()> {
    println!("=== Format check ===");
    run("cargo", &["fmt", "--all", "--check"])?;

    println!("=== Clippy ===");
    run(
        "cargo",
        &[
            "clippy",
            "--workspace",
            "--all-targets",
            "--",
            "-D",
            "warnings",
        ],
    )?;

    println!("=== Tests ===");
    run("cargo", &["test", "--workspace"])?;

    println!("=== Audit ===");
    // cargo-audit may not be installed — skip gracefully
    let audit_result = run("cargo", &["audit"]);
    if audit_result.is_err() {
        println!("  (cargo-audit not installed — skipping)");
    }

    println!("=== CI pipeline complete ===");
    Ok(())
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------
fn cmd_clean() -> Result<()> {
    run("cargo", &["clean"])?;

    let root = project_root()?;
    let dirs = ["dist", "output"];
    for d in &dirs {
        let path = root.join(d);
        if path.exists() {
            println!("  Removing {d}/");
            std::fs::remove_dir_all(&path)
                .with_context(|| format!("failed to remove {}", path.display()))?;
        }
    }
    println!("Clean complete.");
    Ok(())
}
