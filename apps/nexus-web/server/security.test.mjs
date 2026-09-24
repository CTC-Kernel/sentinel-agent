import assert from "node:assert/strict";
import test from "node:test";
import { AuditChain, ReplayGuard, assertSafeVariables, authorize, signWebhook, verifyWebhook } from "./security.mjs";

test("RBAC enforces both role and tenant boundary", () => {
  const analyst = { subject: "user-1", tenantId: "acme", roles: ["analyst"] };
  assert.equal(authorize(analyst, "workflow:execute", "acme"), true);
  assert.equal(authorize(analyst, "workflow:edit", "acme"), false);
  assert.equal(authorize(analyst, "workflow:execute", "other"), false);
});

test("webhook signature is constant-time checked and nonce cannot replay", () => {
  const now = 1_750_000_000_000;
  const guard = new ReplayGuard();
  const envelope = { body: '{"alert":"critical"}', timestamp: now, nonce: "unique-128-bit-nonce" };
  const signed = { ...envelope, signature: signWebhook(envelope, "rotation-secret") };
  assert.equal(verifyWebhook(signed, "rotation-secret", guard, now), true);
  assert.equal(verifyWebhook(signed, "rotation-secret", guard, now), false);
  assert.equal(verifyWebhook({ ...signed, body: "tampered" }, "rotation-secret", new ReplayGuard(), now), false);
});

test("stale webhooks are rejected", () => {
  const now = 1_750_000_000_000;
  const envelope = { body: "{}", timestamp: now - 300_001, nonce: "stale" };
  assert.equal(verifyWebhook({ ...envelope, signature: signWebhook(envelope, "secret") }, "secret", new ReplayGuard(), now), false);
});

test("workflow variables reject dangerous and oversized values", () => {
  assert.deepEqual(assertSafeVariables({ scope: "prod/*", severity: "high" }), { scope: "prod/*", severity: "high" });
  assert.throws(() => assertSafeVariables(JSON.parse('{"__proto__":{"admin":true}}')), /forbidden_variable_key/);
  assert.throws(() => assertSafeVariables({ payload: "x".repeat(8_193) }), /variable_value_too_large/);
});

test("audit chain detects mutation", () => {
  const audit = new AuditChain();
  audit.append({ action: "workflow.execute", tenantId: "acme" });
  audit.append({ action: "workflow.approve", tenantId: "acme" });
  assert.equal(audit.verify(), true);
  assert.equal(Object.isFrozen(audit.entries()[0]), true);
});
