import { randomUUID } from "node:crypto";
import { IdempotencyStore, SlidingWindowLimiter, assertSafeVariables, authorize, validateVariableSchema } from "./security.mjs";

/**
 * Creates the privileged orchestration use-case with all external systems
 * injected. The HTTP adapter must provide a verified OIDC identity and never
 * trust tenant or role fields coming from the request body.
 */
export function createOrchestrationGateway({ workflowRepository, n8n, audit, clock = () => new Date(), idempotency = new IdempotencyStore(), rateLimiter = new SlidingWindowLimiter() }) {
  return Object.freeze({
    async execute(identity, request) {
      if (!request?.idempotencyKey || !/^[a-zA-Z0-9_-]{16,128}$/.test(request.idempotencyKey)) {
        return { status: 400, body: { code: "invalid_idempotency_key" } };
      }
      const scope = `${identity.tenantId}:${identity.subject}`;
      const existing = idempotency.get(scope, request.idempotencyKey);
      if (existing) return { ...existing, replayed: true };
      const quota = rateLimiter.consume(scope);
      if (!quota.allowed) return { status: 429, body: { code: "rate_limited", retryAfterMs: quota.retryAfterMs } };
      const workflow = await workflowRepository.getById(identity.tenantId, request.workflowId);
      if (!workflow) return { status: 404, body: { code: "workflow_not_found" } };
      if (!authorize(identity, "workflow:execute", workflow.tenantId)) {
        audit.append(event(identity, "workflow.execute.denied", workflow.id, clock));
        return { status: 403, body: { code: "insufficient_permission" } };
      }
      if (workflow.requiresApproval && request.approval?.confirmed !== true) {
        return { status: 422, body: { code: "approval_required" } };
      }
      if (workflow.requiresMfa && identity.mfa !== true) return { status: 403, body: { code: "mfa_required" } };
      let variables;
      try { variables = assertSafeVariables(request.variables ?? {}); }
      catch (error) { return { status: 400, body: { code: error.message } }; }
      const schemaErrors = validateVariableSchema(variables, workflow.inputSchema);
      if (schemaErrors.length) return { status: 422, body: { code: "invalid_variables", errors: schemaErrors } };

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
        const result = { status: 202, body: { id: executionId, status: upstream.status ?? "queued", createdAt: clock().toISOString() } };
        idempotency.set(scope, request.idempotencyKey, result);
        return result;
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
