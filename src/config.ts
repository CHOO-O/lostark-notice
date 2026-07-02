export const WEBHOOK_SECRET_NAMES = [
  "DISCORD_WEBHOOK_TEST",
  "DISCORD_WEBHOOK_MAIN",
  "DISCORD_WEBHOOK_EXTRA"
] as const;

export type WebhookSecretName = (typeof WEBHOOK_SECRET_NAMES)[number];

export type WebhookConfig = {
  name: WebhookSecretName;
  url: string;
};

export type AppConfig = {
  lostArkApiKey: string;
  lostArkApiBaseUrl: string;
  requestTimeoutMs: number;
  webhooks: WebhookConfig[];
};

const DEFAULT_LOSTARK_API_BASE_URL = "https://developer-lostark.game.onstove.com";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const lostArkApiKey = readRequiredSecret(env, "LOSTARK_API_KEY");
  const requestTimeoutMs = readPositiveInteger(
    env.REQUEST_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS
  );

  const webhooks = WEBHOOK_SECRET_NAMES.flatMap((name) => {
    const url = readOptionalSecret(env, name);
    return url ? [{ name, url }] : [];
  });

  if (webhooks.length === 0) {
    throw new Error(
      `Discord webhook secret is required. Set at least one of: ${WEBHOOK_SECRET_NAMES.join(", ")}.`
    );
  }

  return {
    lostArkApiKey,
    lostArkApiBaseUrl:
      env.LOSTARK_API_BASE_URL?.trim() || DEFAULT_LOSTARK_API_BASE_URL,
    requestTimeoutMs,
    webhooks
  };
}

function readRequiredSecret(env: NodeJS.ProcessEnv, name: string): string {
  const value = readOptionalSecret(env, name);
  if (!value) {
    throw new Error(`${name} secret is required.`);
  }
  return value;
}

function readOptionalSecret(env: NodeJS.ProcessEnv, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
