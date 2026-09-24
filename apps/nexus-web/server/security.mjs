import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_BODY_BYTES = 64 * 1024;

export const ROLE_GRANTS = Object.freeze({
  auditor: new Set(["workflow:view", "execution:view", "audit:export"]),
  analyst: new Set(["workflow:view", "workflow:execute", "execution:view"]),
  soc_manager: new Set(["workflow:view", "workflow:execute", "workflow:edit", "execution:view", "execution:approve"]),
  tenant_admin: new Set(["workflow:view", "workflow:execute", "workflow:edit", "execution:view", "connector:manage", "role:manage"]),
});

export function authorize(identity, permission, resourceTenantId) {
  if (!identity?.subject || !identity.tenantId || identity.tenantId !== resourceTenantId) return false;
  return identity.roles?.some((role) => ROLE_GRANTS[role]?.has(permission)) ?? false;
}

export function assertSafeVariables(variables) {
  const encoded = JSON.stringify(variables);
  if (Buffer.byteLength(encoded) > MAX_BODY_BYTES) throw new Error("variables_too_large");
  const visit = (value, depth = 0) => {
    if (depth > 8) throw new Error("variables_too_deep");
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) throw new Error("forbidden_variable_key");
      if (typeof child === "string" && child.length > 8_192) throw new Error("variable_value_too_large");
      visit(child, depth + 1);
    }
  };
  visit(variables);
  return structuredClone(variables);
}

export class ReplayGuard {
  #nonces = new Map();
  constructor(maxAgeMs = 300_000) { this.maxAgeMs = maxAgeMs; }
  consume(nonce, timestamp, now = Date.now()) {
    if (!nonce || !Number.isFinite(timestamp) || Math.abs(now - timestamp) > this.maxAgeMs) return false;
    for (const [key, expires] of this.#nonces) if (expires <= now) this.#nonces.delete(key);
    if (this.#nonces.has(nonce)) return false;
    this.#nonces.set(nonce, now + this.maxAgeMs);
    return true;
  }
}

export function signWebhook({ body, timestamp, nonce }, secret) {
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex");
}

export function verifyWebhook(envelope, secret, replayGuard, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/i.test(envelope.signature ?? "")) return false;
  const expected = Buffer.from(signWebhook(envelope, secret), "hex");
  const received = Buffer.from(envelope.signature, "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
  return replayGuard.consume(envelope.nonce, Number(envelope.timestamp), now);
}

export class AuditChain {
  #lastHash = "0".repeat(64);
  #entries = [];
  append(event) {
    const entry = Object.freeze({ ...event, previousHash: this.#lastHash });
    const hash = createHash("sha256").update(JSON.stringify(entry)).digest("hex");
    const sealed = Object.freeze({ ...entry, hash });
    this.#entries.push(sealed); this.#lastHash = hash;
    return sealed;
  }
  entries() { return [...this.#entries]; }
  verify() {
    let previousHash = "0".repeat(64);
    return this.#entries.every(({ hash, ...entry }) => {
      const valid = entry.previousHash === previousHash && createHash("sha256").update(JSON.stringify(entry)).digest("hex") === hash;
      previousHash = hash; return valid;
    });
  }
}
