export type ModelProvider = "kimi" | "openai" | "azure-openai" | "self-hosted";

export type SecurityContext = {
  tenantId: string;
  page: string;
  selectedAssetIds?: string[];
  selectedRiskIds?: string[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  citations?: Array<{ label: string; href: string }>;
  proposedActions?: Array<{ id: string; label: string; risk: "low" | "medium" | "high" }>;
};

export type AssistantRequest = {
  model: ModelProvider;
  messages: Pick<ChatMessage, "role" | "content">[];
  context: SecurityContext;
  mode: "explain" | "investigate" | "build-workflow" | "executive";
};

const TIMEOUT_MS = 45_000;
const MAX_RETRIES = 2;

const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

/** Provider-neutral AI gateway. Provider credentials and prompts remain server-side. */
export class IntelligenceClient {
  constructor(private readonly baseUrl = "/api/intelligence") {}

  async complete(request: AssistantRequest, signal?: AbortSignal): Promise<ChatMessage> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      try {
        const response = await fetch(`${this.baseUrl}/chat`, {
          method: "POST",
          credentials: "include",
          signal: combined,
          headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
          body: JSON.stringify(request),
        });
        if (response.ok) return response.json() as Promise<ChatMessage>;
        if (response.status < 500 && response.status !== 429) throw new Error(`AI request refused (${response.status})`);
        lastError = new Error(`AI provider unavailable (${response.status})`);
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = error instanceof Error ? error : new Error("Unknown AI gateway error");
      }
      if (attempt < MAX_RETRIES) await sleep(350 * 2 ** attempt + Math.random() * 150);
    }
    throw lastError ?? new Error("AI gateway unavailable");
  }

  async *stream(request: AssistantRequest, signal?: AbortSignal): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/chat/stream`, {
      method: "POST",
      credentials: "include",
      signal,
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", "X-CSRF-Protection": "1" },
      body: JSON.stringify(request),
    });
    if (!response.ok || !response.body) throw new Error(`AI stream unavailable (${response.status})`);
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const data = event.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
        if (data && data !== "[DONE]") yield JSON.parse(data).delta as string;
      }
    }
  }
}

export const intelligenceClient = new IntelligenceClient();

export const modelCatalog: Array<{ id: ModelProvider; name: string; detail: string; location: string }> = [
  { id: "kimi", name: "Kimi K2", detail: "Contexte long · raisonnement agentique", location: "Cloud souverain" },
  { id: "openai", name: "OpenAI", detail: "Analyse multimodale · outils", location: "Cloud" },
  { id: "azure-openai", name: "Azure OpenAI", detail: "Déploiement entreprise privé", location: "Région UE" },
  { id: "self-hosted", name: "Nexus Local", detail: "Modèle privé sans exfiltration", location: "Sur site" },
];
