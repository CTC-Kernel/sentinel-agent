import assert from "node:assert/strict";
import test from "node:test";
import { createOrchestrationGateway } from "./orchestration-gateway.mjs";
import { AuditChain } from "./security.mjs";

const identity = { subject: "analyst-7", tenantId: "acme", roles: ["analyst"] };
const clock = () => new Date("2026-09-24T15:42:00.000Z");

function fixture(overrides = {}) {
  const audit = new AuditChain();
  const calls = [];
  const dependencies = {
    workflowRepository: { getById: async (tenantId, id) => ({ id, tenantId, n8nWorkflowId: "n8n-42", requiresApproval: true }) },
    n8n: { execute: async (request) => { calls.push(request); return { status: "queued" }; } },
    audit, clock, ...overrides,
  };
  return { gateway: createOrchestrationGateway(dependencies), audit, calls };
}

test("approved execution is tenant-bound, audited and forwards server identity", async () => {
  const { gateway, audit, calls } = fixture();
  const result = await gateway.execute(identity, { workflowId: 42, variables: { scope: "prod/*" }, approval: { confirmed: true } });
  assert.equal(result.status, 202);
  assert.equal(result.body.status, "queued");
  assert.equal(calls[0].tenantId, "acme");
  assert.equal(calls[0].actorId, "analyst-7");
  assert.equal(audit.entries().length, 2);
  assert.equal(audit.verify(), true);
});

test("approval is mandatory for a sensitive workflow", async () => {
  const { gateway, calls } = fixture();
  const result = await gateway.execute(identity, { workflowId: 42, variables: {} });
  assert.deepEqual(result, { status: 422, body: { code: "approval_required" } });
  assert.equal(calls.length, 0);
});

test("cross-tenant execution is denied and audited", async () => {
  const { gateway, audit, calls } = fixture({ workflowRepository: { getById: async () => ({ id: 42, tenantId: "other", n8nWorkflowId: "private" }) } });
  const result = await gateway.execute(identity, { workflowId: 42, variables: {} });
  assert.equal(result.status, 403);
  assert.equal(calls.length, 0);
  assert.equal(audit.entries()[0].action, "workflow.execute.denied");
});

test("n8n failure is converted to a stable gateway error and audited", async () => {
  const { gateway, audit } = fixture({ n8n: { execute: async () => { throw new Error("offline"); } } });
  const result = await gateway.execute(identity, { workflowId: 42, variables: {}, approval: { confirmed: true } });
  assert.equal(result.status, 502);
  assert.equal(result.body.code, "orchestrator_unavailable");
  assert.equal(audit.entries().at(-1).action, "workflow.execute.failed");
});
