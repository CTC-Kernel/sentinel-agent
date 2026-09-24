export type ExecutionRequest = {
  workflowId: number;
  variables: Record<string, string>;
  approval: { confirmed: true; reason: string };
  idempotencyKey?: string;
};

export type Execution = {
  id: string;
  status: "queued" | "running" | "waiting_approval" | "succeeded" | "failed" | "cancelled";
  createdAt: string;
  updatedAt?: string;
  timeline?: Array<{ id: string; status: Execution["status"]; at: string; actorId?: string; reason?: string }>;
};

export type ExecutionPage = { items: Execution[]; nextCursor?: string };

/**
 * Browser-side gateway for Sentinel's orchestration backend.
 *
 * The browser never receives an n8n API key and never calls n8n directly.
 * The backend derives tenant and role from the HttpOnly session, applies RBAC,
 * resolves secrets in Vault and signs the internal n8n request.
 */
export class OrchestrationClient {
  constructor(private readonly baseUrl = "/api/orchestration") {}

  async execute(request: ExecutionRequest): Promise<Execution> {
    const idempotencyKey = request.idempotencyKey ?? crypto.randomUUID();
    const response = await fetch(`${this.baseUrl}/executions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ ...request, idempotencyKey }),
    });
    if (!response.ok) throw new Error(`Execution refused (${response.status})`);
    return response.json() as Promise<Execution>;
  }

  async cancel(executionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/executions/${encodeURIComponent(executionId)}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
      body: JSON.stringify({ reason: "Cancelled by operator" }),
    });
    if (!response.ok) throw new Error(`Cancellation refused (${response.status})`);
  }

  async listExecutions(cursor?: string, signal?: AbortSignal): Promise<ExecutionPage> {
    const query = new URLSearchParams({ limit: "50" });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(`${this.baseUrl}/executions?${query}`, { credentials: "include", signal });
    if (!response.ok) throw new Error(`Execution history unavailable (${response.status})`);
    return response.json() as Promise<ExecutionPage>;
  }

  async approve(executionId: string, approved: boolean, reason: string): Promise<Execution> {
    const response = await fetch(`${this.baseUrl}/executions/${encodeURIComponent(executionId)}/approval`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
      body: JSON.stringify({ approved, reason }),
    });
    if (!response.ok) throw new Error(`Approval refused (${response.status})`);
    return response.json() as Promise<Execution>;
  }
}

export const orchestrationClient = new OrchestrationClient();
