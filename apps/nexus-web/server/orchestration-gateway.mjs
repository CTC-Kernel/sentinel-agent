import { randomUUID } from "node:crypto";
import { assertSafeVariables, authorize } from "./security.mjs";

/**
 * Creates the privileged orchestration use-case with all external systems
 * injected. The HTTP adapter must provide a verified OIDC identity and never
 * trust tenant or role fields coming from the request body.
 */
export function createOrchestrationGateway({ workflowRepository, n8n, audit, clock = () => new Date() }) {
  return Object.freeze({
    async execute(identity, request) {
      const workflow = await workflowRepository.getById(identity.tenantId, request.workflowId);
      if (!workflow) return { status: 404, body: { code: "workflow_not_found" } };
      if (!authorize(identity, "workflow:execute", workflow.tenantId)) {
        audit.append(event(identity, "workflow.execute.denied", workflow.id, clock));
        return { status: 403, body: { code: "insufficient_permission" } };
      }
      if (workflow.requiresApproval && request.approval?.confirmed !== true) {
        return { status: 422, body: { code: "approval_required" } };
      }
      let variables;
      try { variables = assertSafeVariables(request.variables ?? {}); }
      catch (error) { return { status: 400, body: { code: error.message } }; }

      const executionId = randomUUID();
      audit.append(event(identity, "workflow.execute.requested", workflow.id, clock, executionId));
      try {
        const upstream = await n8n.execute({
          workflowExternalId: workflow.n8nWorkflowId,
          executionId,
          tenantId: identity.tenantId,
          actorId: identity.subject,
          variables,
        });
        audit.append(event(identity, "workflow.execute.accepted", workflow.id, clock, executionId));
        return { status: 202, body: { id: executionId, status: upstream.status ?? "queued", createdAt: clock().toISOString() } };
      } catch {
        audit.append(event(identity, "workflow.execute.failed", workflow.id, clock, executionId));
        return { status: 502, body: { code: "orchestrator_unavailable", executionId } };
      }
    },
  });
}

function event(identity, action, resourceId, clock, executionId) {
  return { id: randomUUID(), occurredAt: clock().toISOString(), tenantId: identity.tenantId, actorId: identity.subject, action, resourceType: "workflow", resourceId, executionId };
}
