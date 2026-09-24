import { randomUUID } from "node:crypto";
import { authorize } from "./security.mjs";

export const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);
const TRANSITIONS = Object.freeze({
  queued: new Set(["running", "cancelled", "failed"]),
  running: new Set(["waiting_approval", "succeeded", "failed", "cancelled"]),
  waiting_approval: new Set(["running", "cancelled", "failed"]),
  succeeded: new Set(), failed: new Set(), cancelled: new Set(),
});

export class InMemoryExecutionRepository {
  #executions = new Map();
  create(execution) { const record = structuredClone(execution); this.#executions.set(record.id, record); return structuredClone(record); }
  get(tenantId, id) { const value = this.#executions.get(id); return value?.tenantId === tenantId ? structuredClone(value) : undefined; }
  update(tenantId, id, mutate) {
    const current = this.#executions.get(id);
    if (!current || current.tenantId !== tenantId) return undefined;
    const next = mutate(structuredClone(current)); this.#executions.set(id, next); return structuredClone(next);
  }
  list(tenantId, { cursor, limit = 50 } = {}) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const values = [...this.#executions.values()].filter((item) => item.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = cursor ? Math.max(values.findIndex((item) => item.id === cursor) + 1, 0) : 0;
    const items = values.slice(start, start + safeLimit).map((item) => structuredClone(item));
    return { items, nextCursor: values[start + safeLimit]?.id };
  }
}

export function transitionExecution(execution, nextStatus, metadata = {}, now = new Date()) {
  if (!TRANSITIONS[execution.status]?.has(nextStatus)) throw new Error(`invalid_transition:${execution.status}:${nextStatus}`);
  return { ...execution, status: nextStatus, updatedAt: now.toISOString(), version: execution.version + 1, timeline: [...execution.timeline, { id: randomUUID(), status: nextStatus, at: now.toISOString(), ...metadata }] };
}

export function createExecutionEngine({ repository, n8n, audit, clock = () => new Date() }) {
  return Object.freeze({
    register({ id, tenantId, actorId, workflowId, status = "queued" }) {
      const now = clock().toISOString();
      return repository.create({ id, tenantId, requestedBy: actorId, workflowId, status, version: 1, createdAt: now, updatedAt: now, timeline: [{ id: randomUUID(), status, at: now, actorId }] });
    },
    list(identity, query) {
      if (!authorize(identity, "execution:view", identity.tenantId)) return { status: 403, body: { code: "insufficient_permission" } };
      return { status: 200, body: repository.list(identity.tenantId, query) };
    },
    async approve(identity, executionId, decision) {
      const execution = repository.get(identity.tenantId, executionId);
      if (!execution) return { status: 404, body: { code: "execution_not_found" } };
      if (!authorize(identity, "execution:approve", execution.tenantId)) return { status: 403, body: { code: "insufficient_permission" } };
      if (!identity.mfa) return { status: 403, body: { code: "mfa_required" } };
      if (execution.requestedBy === identity.subject) return { status: 409, body: { code: "four_eyes_violation" } };
      if (execution.status !== "waiting_approval") return { status: 409, body: { code: "execution_not_waiting_approval" } };
      const nextStatus = decision.approved ? "running" : "cancelled";
      const updated = repository.update(identity.tenantId, executionId, (current) => transitionExecution(current, nextStatus, { actorId: identity.subject, reason: decision.reason }, clock()));
      audit.append(auditEvent(identity, decision.approved ? "execution.approved" : "execution.rejected", executionId, clock));
      if (decision.approved) await n8n.resume({ executionId, tenantId: identity.tenantId });
      else await n8n.cancel({ executionId, tenantId: identity.tenantId });
      return { status: 200, body: updated };
    },
    async cancel(identity, executionId, reason) {
      const execution = repository.get(identity.tenantId, executionId);
      if (!execution) return { status: 404, body: { code: "execution_not_found" } };
      if (!authorize(identity, "workflow:execute", execution.tenantId)) return { status: 403, body: { code: "insufficient_permission" } };
      if (TERMINAL_STATUSES.has(execution.status)) return { status: 409, body: { code: "execution_already_terminal" } };
      const updated = repository.update(identity.tenantId, executionId, (current) => transitionExecution(current, "cancelled", { actorId: identity.subject, reason }, clock()));
      await n8n.cancel({ executionId, tenantId: identity.tenantId });
      audit.append(auditEvent(identity, "execution.cancelled", executionId, clock));
      return { status: 200, body: updated };
    },
    applyOrchestratorEvent(tenantId, executionId, nextStatus, metadata = {}) {
      const current = repository.get(tenantId, executionId);
      if (!current) return { status: 404, body: { code: "execution_not_found" } };
      if (TERMINAL_STATUSES.has(current.status)) return { status: 202, body: current, ignored: true };
      try {
        const updated = repository.update(tenantId, executionId, (execution) => transitionExecution(execution, nextStatus, { source: "n8n", ...metadata }, clock()));
        return { status: 200, body: updated };
      } catch (error) { return { status: 409, body: { code: "invalid_execution_transition", detail: error.message } }; }
    },
  });
}

function auditEvent(identity, action, resourceId, clock) {
  return { id: randomUUID(), occurredAt: clock().toISOString(), tenantId: identity.tenantId, actorId: identity.subject, action, resourceType: "execution", resourceId };
}
