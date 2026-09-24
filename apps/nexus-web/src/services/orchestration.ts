export type ExecutionRequest = {
  workflowId: number;
  variables: Record<string, string>;
  approval: { confirmed: true; reason: string };
  idempotencyKey?: string;
};

export type Execution = {
  id: string;
  status: "queued" | "running" | "waiting_approval" | "succeeded" | "failed";
  createdAt: string;
};

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
      headers: { "X-CSRF-Protection": "1" },
    });
    if (!response.ok) throw new Error(`Cancellation refused (${response.status})`);
  }
}

export const orchestrationClient = new OrchestrationClient();
