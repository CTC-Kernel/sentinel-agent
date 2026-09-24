import assert from "node:assert/strict";
import test from "node:test";
import { AuditChain, IdempotencyStore, ReplayGuard, SlidingWindowLimiter, assertSafeVariables, authorize, identityFromClaims, signWebhook, validateVariableSchema, verifyWebhook } from "./security.mjs";

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

test("OIDC claims require issuer, audience, lifetime and expose MFA assurance", () => {
  const policy = { issuer: "https://id.sentinel.test", audience: "nexus" };
  const claims = { sub: "u1", tenant_id: "acme", roles: ["analyst"], iss: policy.issuer, aud: ["other", "nexus"], exp: 2_000, amr: ["pwd", "mfa"], sid: "s1" };
  assert.equal(identityFromClaims(claims, policy, 1_000).mfa, true);
  assert.throws(() => identityFromClaims({ ...claims, exp: 999 }, policy, 1_000), /invalid_token_time/);
  assert.throws(() => identityFromClaims({ ...claims, tenant_id: undefined }, policy, 1_000), /invalid_identity_claims/);
});

test("dynamic workflow schema returns precise validation errors", () => {
  const schema = { required: ["scope", "severity"], additionalProperties: false, properties: { scope: { type: "string", pattern: "^prod/" }, severity: { type: "string", enum: ["high", "critical"] } } };
  assert.deepEqual(validateVariableSchema({ scope: "prod/eu", severity: "high" }, schema), []);
  assert.deepEqual(validateVariableSchema({ scope: "dev/eu", extra: true }, schema), [{ path: "severity", code: "required" }, { path: "scope", code: "pattern" }, { path: "extra", code: "unknown" }]);
});

test("rate limiter resets and idempotency values expire", () => {
  const limiter = new SlidingWindowLimiter(2, 1_000);
  assert.equal(limiter.consume("actor", 0).allowed, true);
  assert.equal(limiter.consume("actor", 1).allowed, true);
  assert.equal(limiter.consume("actor", 2).allowed, false);
  assert.equal(limiter.consume("actor", 1_001).allowed, true);
  const store = new IdempotencyStore(100);
  store.set("tenant:user", "key", { status: 202 }, 0);
  assert.equal(store.get("tenant:user", "key", 50).status, 202);
  assert.equal(store.get("tenant:user", "key", 101), undefined);
});
