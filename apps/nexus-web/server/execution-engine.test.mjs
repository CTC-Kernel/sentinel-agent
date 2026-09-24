import assert from "node:assert/strict";
import test from "node:test";
import { AuditChain } from "./security.mjs";
import { InMemoryExecutionRepository, createExecutionEngine, transitionExecution } from "./execution-engine.mjs";

const clock = () => new Date("2026-09-24T16:00:00.000Z");
const requester = { subject: "analyst", tenantId: "acme", roles: ["analyst"], mfa: true };
const approver = { subject: "manager", tenantId: "acme", roles: ["soc_manager"], mfa: true };

function fixture() {
  const repository = new InMemoryExecutionRepository();
  const audit = new AuditChain();
  const calls = [];
  const n8n = { resume: async (value) => calls.push(["resume", value]), cancel: async (value) => calls.push(["cancel", value]) };
  return { engine: createExecutionEngine({ repository, audit, n8n, clock }), repository, audit, calls };
}

test("state machine accepts expected transitions and rejects impossible ones", () => {
  const execution = { status: "queued", version: 1, timeline: [] };
  assert.equal(transitionExecution(execution, "running", {}, clock()).status, "running");
  assert.throws(() => transitionExecution(execution, "succeeded", {}, clock()), /invalid_transition/);
});

test("four-eyes policy prevents requester from self-approving", async () => {
  const { engine, calls } = fixture();
  engine.register({ id: "ex-1", tenantId: "acme", actorId: requester.subject, workflowId: 42, status: "waiting_approval" });
  const result = await engine.approve({ ...requester, roles: ["soc_manager"] }, "ex-1", { approved: true, reason: "reviewed" });
  assert.equal(result.body.code, "four_eyes_violation");
  assert.equal(calls.length, 0);
});

test("MFA manager can approve and resume a waiting execution", async () => {
  const { engine, calls, audit } = fixture();
  engine.register({ id: "ex-2", tenantId: "acme", actorId: requester.subject, workflowId: 42, status: "waiting_approval" });
  const result = await engine.approve(approver, "ex-2", { approved: true, reason: "change approved" });
  assert.equal(result.body.status, "running");
  assert.equal(result.body.version, 2);
  assert.equal(calls[0][0], "resume");
  assert.equal(audit.entries()[0].action, "execution.approved");
});

test("terminal callbacks are idempotently ignored", () => {
  const { engine } = fixture();
  engine.register({ id: "ex-3", tenantId: "acme", actorId: requester.subject, workflowId: 42 });
  assert.equal(engine.applyOrchestratorEvent("acme", "ex-3", "running").status, 200);
  assert.equal(engine.applyOrchestratorEvent("acme", "ex-3", "succeeded").body.status, "succeeded");
  const duplicate = engine.applyOrchestratorEvent("acme", "ex-3", "failed");
  assert.equal(duplicate.ignored, true);
  assert.equal(duplicate.body.status, "succeeded");
});

test("execution lists are tenant isolated and cursor paginated", () => {
  const { engine } = fixture();
  engine.register({ id: "a1", tenantId: "acme", actorId: "u", workflowId: 1 });
  engine.register({ id: "a2", tenantId: "acme", actorId: "u", workflowId: 1 });
  engine.register({ id: "b1", tenantId: "other", actorId: "u", workflowId: 1 });
  const first = engine.list(requester, { limit: 1 });
  assert.equal(first.body.items.length, 1);
  assert.equal(first.body.items[0].tenantId, "acme");
  assert.ok(first.body.nextCursor);
});
