import type { WebhookConfig } from "../config.js";
import type { DiscordWebhookPayload } from "./createDiscordPayload.js";

export type WebhookSendResult = {
  name: string;
  ok: boolean;
  status: number | null;
  message: string;
};

export type SendDiscordWebhookOptions = {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

const MAX_ATTEMPTS = 2;

export async function sendDiscordPayloadToWebhooks(
  webhooks: WebhookConfig[],
  payload: DiscordWebhookPayload,
  options: SendDiscordWebhookOptions
): Promise<WebhookSendResult[]> {
  validatePayload(payload);

  const results: WebhookSendResult[] = [];
  const fetchImpl = options.fetchImpl ?? fetch;

  for (const webhook of webhooks) {
    const result = await sendOneWebhook(fetchImpl, webhook, payload, options.timeoutMs);
    results.push(result);

    if (result.ok) {
      console.log(`[discord] ${webhook.name} 전송 성공`);
    } else {
      console.warn(`[discord] ${webhook.name} 전송 실패: ${result.message}`);
    }
  }

  return results;
}

function validatePayload(payload: DiscordWebhookPayload): void {
  const hasContent = typeof payload.content === "string" && payload.content.trim().length > 0;
  const hasEmbeds = Array.isArray(payload.embeds) && payload.embeds.length > 0;

  if (!hasContent && !hasEmbeds) {
    throw new Error("Discord payload must include content or embeds.");
  }
}

async function sendOneWebhook(
  fetchImpl: typeof fetch,
  webhook: WebhookConfig,
  payload: DiscordWebhookPayload,
  timeoutMs: number
): Promise<WebhookSendResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        fetchImpl,
        webhook.url,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(payload)
        },
        timeoutMs
      );

      if (response.ok) {
        return {
          name: webhook.name,
          ok: true,
          status: response.status,
          message: "sent"
        };
      }

      if (shouldRetry(response.status) && attempt < MAX_ATTEMPTS) {
        await wait(getRetryDelayMs(response));
        continue;
      }

      return {
        name: webhook.name,
        ok: false,
        status: response.status,
        message: getStatusMessage(response.status)
      };
    } catch (error) {
      if (attempt < MAX_ATTEMPTS) {
        await wait(750);
        continue;
      }

      return {
        name: webhook.name,
        ok: false,
        status: null,
        message: `network request failed: ${errorToMessage(error)}`
      };
    }
  }

  return {
    name: webhook.name,
    ok: false,
    status: null,
    message: "unknown webhook send failure"
  };
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetry(status: number): boolean {
  return status === 429 || status >= 500;
}

function getRetryDelayMs(response: Response): number {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) {
    return 750;
  }

  const parsedSeconds = Number.parseFloat(retryAfter);
  if (!Number.isFinite(parsedSeconds) || parsedSeconds <= 0) {
    return 750;
  }

  return Math.min(parsedSeconds * 1000, 5_000);
}

function getStatusMessage(status: number): string {
  if (status === 404) {
    return "webhook was deleted or is invalid";
  }
  if (status === 429) {
    return "Discord rate limit";
  }
  if (status >= 500) {
    return "Discord temporary server error";
  }
  return `Discord webhook HTTP ${status}`;
}

function errorToMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
