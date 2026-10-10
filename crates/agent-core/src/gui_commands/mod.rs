// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Commands sent by the desktop interface to the agent, and what handles
//! them.

use std::sync::atomic::AtomicBool;
use std::sync::mpsc::TryRecvError;
use std::sync::{Arc, Mutex};

use agent_core::RuntimeHandle;
use agent_core::audit_trail::LocalAuditTrail;
use agent_core::remote_ai::RemoteAi;
use agent_core::supervised_tasks::TaskSet;
use agent_gui::events::{AgentEvent, GuiCommand};
use agent_storage::Database;
use agent_sync::AuthenticatedClient;
use tracing::error;

pub(crate) mod ai;
pub(crate) mod control;
pub(crate) mod grc;
pub(crate) mod playbooks;
pub(crate) mod reports;
pub(crate) mod response;
pub(crate) mod settings;
pub(crate) mod voice;

/// The local AI model service, when the agent is built with it.
#[cfg(feature = "llm")]
pub(crate) type LlmService = agent_core::llm_service::LLMService;
#[cfg(not(feature = "llm"))]
pub(crate) type LlmService = ();

/// What the dispatcher does once a command was handled.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Flow {
    /// Go on with the next command.
    Continue,
    /// The agent is shutting down: stop reading commands.
    Stop,
}

/// What the command handlers share: the running agent, the channel back to
/// the interface, and the services a command may need.
pub(crate) struct CommandContext {
    /// The running agent.
    pub handle: RuntimeHandle,
    /// Events back to the interface.
    pub events: std::sync::mpsc::Sender<AgentEvent>,
    /// The encrypted database, when it could be opened.
    pub db: Option<Arc<Database>>,
    /// The platform client; `None` in standalone mode.
    pub sync_client: Option<Arc<AuthenticatedClient>>,
    pub llm_service: Option<Arc<LlmService>>,
    pub audit_trail: Option<Arc<LocalAuditTrail>>,
    #[cfg(feature = "voice")]
    pub voice_service: Option<Arc<agent_core::voice::VoiceService>>,
    /// Cancellation flag of the assistant answer being generated.
    pub llm_cancel: Arc<Mutex<Option<Arc<AtomicBool>>>>,
    /// The AI provider chosen in the settings.
    pub remote_ai: RemoteAi,
    /// The tasks the handlers start: reaped by the dispatcher, so one that
    /// panics is logged and one that overruns is reported.
    pub tasks: TaskSet,
}

/// How long a task started by a command may run before it is reported as
/// slow. Nothing is stopped: the operator reads it in the log.
pub(crate) mod expected {
    use std::time::Duration;

    /// A local write, or one request to the platform.
    pub(crate) const SHORT: Duration = Duration::from_secs(60);
    /// A response action on the host, or a playbook.
    pub(crate) const ACTION: Duration = Duration::from_secs(5 * 60);
    /// An answer or an analysis of the AI model.
    pub(crate) const ANALYSIS: Duration = Duration::from_secs(10 * 60);
    /// The download or the load of a model.
    pub(crate) const DOWNLOAD: Duration = Duration::from_secs(2 * 3600);
}

/// The group of handlers a command belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Group {
    Control,
    Settings,
    Response,
    Reports,
    Playbooks,
    Grc,
    Ai,
    Voice,
}

/// Which group handles `command`. The match is exhaustive: a new command
/// does not compile until it is given a group.
fn group_of(command: &GuiCommand) -> Group {
    match command {
        GuiCommand::Pause
        | GuiCommand::Resume
        | GuiCommand::Shutdown
        | GuiCommand::Restart
        | GuiCommand::RunCheck
        | GuiCommand::ForceSync
        | GuiCommand::RunSync
        | GuiCommand::StartDiscovery
        | GuiCommand::StopDiscovery
        | GuiCommand::CheckUpdate
        | GuiCommand::ProposeAsset { .. }
        | GuiCommand::Remediate { .. }
        | GuiCommand::RemediatePreview { .. }
        | GuiCommand::ApplyAiRemediation { .. }
        | GuiCommand::ConnectToPlatform
        | GuiCommand::GetSummary
        | GuiCommand::GetCheckResults
        | GuiCommand::MarkNotificationRead { .. }
        | GuiCommand::MarkAllNotificationsRead
        | GuiCommand::DeleteNotification { .. } => Group::Control,
        GuiCommand::UpdateCheckInterval { .. }
        | GuiCommand::UpdateAllowlist { .. }
        | GuiCommand::SetLogLevel { .. }
        | GuiCommand::SetRansomwareCanaries { .. }
        | GuiCommand::UpdateSiemConfig { .. }
        | GuiCommand::UpdateLogCollectorConfig { .. } => Group::Settings,
        GuiCommand::AcknowledgeFimAlert { .. }
        | GuiCommand::KillProcess { .. }
        | GuiCommand::QuarantineFile { .. }
        | GuiCommand::RestoreQuarantinedFile { .. }
        | GuiCommand::BlockIp { .. }
        | GuiCommand::UnblockIp { .. }
        | GuiCommand::IsolateHost { .. }
        | GuiCommand::ReleaseHost => Group::Response,
        GuiCommand::ExportSbom
        | GuiCommand::GenerateReport { .. }
        | GuiCommand::ExportReportHtml { .. }
        | GuiCommand::ExportCsvAuditTrail => Group::Reports,
        GuiCommand::ExecutePlaybook { .. }
        | GuiCommand::TogglePlaybook { .. }
        | GuiCommand::SavePlaybook { .. }
        | GuiCommand::DeletePlaybook { .. }
        | GuiCommand::SaveDetectionRule { .. }
        | GuiCommand::DeleteDetectionRule { .. }
        | GuiCommand::ToggleDetectionRule { .. } => Group::Playbooks,
        GuiCommand::SaveRisk { .. }
        | GuiCommand::DeleteRisk { .. }
        | GuiCommand::SaveAsset { .. }
        | GuiCommand::UpdateAssetLifecycle { .. }
        | GuiCommand::SaveAlertRule { .. }
        | GuiCommand::DeleteAlertRule { .. }
        | GuiCommand::SaveWebhook { .. }
        | GuiCommand::DeleteWebhook { .. }
        | GuiCommand::TestWebhook { .. } => Group::Grc,
        GuiCommand::ConfigureAiProvider { .. }
        | GuiCommand::TestAiProvider { .. }
        | GuiCommand::LlmPrompt { .. }
        | GuiCommand::LlmCancel
        | GuiCommand::LlmWarmUp { .. }
        | GuiCommand::LlmGetStatus
        | GuiCommand::LlmReloadModel
        | GuiCommand::LlmStartDownload
        | GuiCommand::LlmPauseDownload
        | GuiCommand::LlmResumeDownload
        | GuiCommand::LlmCancelDownload
        | GuiCommand::LlmAnalyzeVulnerability { .. }
        | GuiCommand::LlmSelectModel { .. }
        | GuiCommand::LlmClassifyThreat { .. }
        | GuiCommand::LlmAnalyzeRisk { .. } => Group::Ai,
        GuiCommand::StopVoice
        | GuiCommand::ConfigureVoice { .. }
        | GuiCommand::VoiceRefreshStatus
        | GuiCommand::VoiceInstallModel { .. }
        | GuiCommand::VoiceCancelModelInstall
        | GuiCommand::SetVoiceListening { .. }
        | GuiCommand::SpeakNotification { .. }
        | GuiCommand::LlmToggleVoice => Group::Voice,
    }
}

/// Hand `command` to its group of handlers.
async fn dispatch(ctx: &mut CommandContext, command: GuiCommand) -> Flow {
    match group_of(&command) {
        Group::Control => return control::handle(ctx, command).await,
        Group::Settings => settings::handle(ctx, command).await,
        Group::Response => response::handle(ctx, command).await,
        Group::Reports => reports::handle(ctx, command).await,
        Group::Playbooks => playbooks::handle(ctx, command).await,
        Group::Grc => grc::handle(ctx, command).await,
        Group::Ai => ai::handle(ctx, command).await,
        Group::Voice => voice::handle(ctx, command).await,
    }
    Flow::Continue
}

/// Read the commands of the interface and handle them one at a time, until
/// the interface is gone or the agent was asked to shut down.
pub(crate) async fn run(mut ctx: CommandContext, commands: std::sync::mpsc::Receiver<GuiCommand>) {
    loop {
        // What the handlers started and has ended, panicked or overrun.
        ctx.tasks.reap();
        match commands.try_recv() {
            Ok(command) => {
                if dispatch(&mut ctx, command).await == Flow::Stop {
                    break;
                }
            }
            Err(TryRecvError::Empty) => {
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
            Err(TryRecvError::Disconnected) => break,
        }
    }
    // What is still running goes on to its end, as it always did: a
    // response action is not cut short because the window was closed.
    ctx.tasks.detach();
}

/// A command reached a group of handlers it does not belong to: the
/// dispatcher and the group disagree on who handles it. Nothing is done.
fn misrouted(group: &str, command: &GuiCommand) {
    error!(
        "GUI command {:?} was handed to the {} handlers, which do not know it",
        command, group
    );
}

#[cfg(test)]
pub(crate) mod testing {
    use super::*;
    use agent_common::config::AgentConfig;

    /// A context without database, platform nor AI service, and the events
    /// the handlers send to the interface.
    pub(crate) fn context() -> (CommandContext, std::sync::mpsc::Receiver<AgentEvent>) {
        let (events, received) = std::sync::mpsc::channel();
        let ctx = CommandContext {
            handle: agent_core::AgentRuntime::new(AgentConfig::default()).handle(),
            events,
            db: None,
            sync_client: None,
            llm_service: None,
            audit_trail: None,
            #[cfg(feature = "voice")]
            voice_service: None,
            llm_cancel: Arc::new(Mutex::new(None)),
            remote_ai: RemoteAi::default(),
            tasks: TaskSet::new("interface commands"),
        };
        (ctx, received)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_command_has_its_group_of_handlers() {
        assert_eq!(group_of(&GuiCommand::Pause), Group::Control);
        assert_eq!(group_of(&GuiCommand::Shutdown), Group::Control);
        assert_eq!(
            group_of(&GuiCommand::SetLogLevel { level: 2 }),
            Group::Settings
        );
        assert_eq!(group_of(&GuiCommand::ReleaseHost), Group::Response);
        assert_eq!(group_of(&GuiCommand::ExportSbom), Group::Reports);
        assert_eq!(
            group_of(&GuiCommand::DeletePlaybook {
                playbook_id: "pb-1".to_string()
            }),
            Group::Playbooks
        );
        assert_eq!(
            group_of(&GuiCommand::DeleteRisk {
                risk_id: "risk-1".to_string()
            }),
            Group::Grc
        );
        assert_eq!(group_of(&GuiCommand::LlmCancel), Group::Ai);
        assert_eq!(group_of(&GuiCommand::StopVoice), Group::Voice);
    }

    #[tokio::test]
    async fn commands_are_handled_in_order_until_shutdown() {
        let (ctx, _events) = testing::context();
        let handle = ctx.handle.clone();
        let (commands, received) = std::sync::mpsc::channel();
        commands.send(GuiCommand::Pause).unwrap();
        commands.send(GuiCommand::SetLogLevel { level: 4 }).unwrap();
        commands.send(GuiCommand::Shutdown).unwrap();
        // Never read: the dispatcher stops at the shutdown.
        commands.send(GuiCommand::Resume).unwrap();

        run(ctx, received).await;

        assert!(handle.is_shutdown_requested());
        assert!(handle.is_paused());
        assert_eq!(handle.state.get_log_level(), 4);
    }

    #[tokio::test]
    async fn the_dispatcher_stops_when_the_interface_is_gone() {
        let (ctx, _events) = testing::context();
        let handle = ctx.handle.clone();
        let (commands, received) = std::sync::mpsc::channel();
        commands.send(GuiCommand::RunCheck).unwrap();
        drop(commands);

        run(ctx, received).await;

        // The last command was handled, and nothing asked for a shutdown.
        assert!(
            handle
                .state
                .force_check
                .load(std::sync::atomic::Ordering::Acquire)
        );
        assert!(!handle.is_shutdown_requested());
    }

    #[tokio::test]
    async fn what_a_handler_starts_is_watched_under_its_name() {
        use agent_core::supervised_tasks::TaskEvent;
        let (mut ctx, events) = testing::context();

        // No inventory yet: the export ends at once, with a message.
        reports::handle(&mut ctx, GuiCommand::ExportSbom).await;
        assert!(ctx.tasks.is_running("export sbom"));

        let mut ended = Vec::new();
        while ended.is_empty() {
            tokio::task::yield_now().await;
            ended = ctx.tasks.reap();
        }
        assert_eq!(
            ended,
            vec![TaskEvent::Finished {
                name: "export sbom".to_string()
            }]
        );
        match events.try_recv() {
            Ok(AgentEvent::Notification { notification }) => {
                assert_eq!(notification.title, "Export SBOM impossible");
            }
            other => panic!("expected a notification, got {:?}", other.map(|_| ())),
        }
    }

    #[tokio::test]
    async fn a_misrouted_command_is_ignored() {
        let (mut ctx, events) = testing::context();

        response::handle(&mut ctx, GuiCommand::Pause).await;

        assert!(!ctx.handle.is_paused());
        assert!(events.try_recv().is_err());
    }
}
