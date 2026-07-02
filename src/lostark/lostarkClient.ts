export type LostArkClientOptions = {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

export class LostArkApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message);
    this.name = "LostArkApiError";
  }
}

const CALENDAR_PATH = "/gamecontents/calendar";
const MAX_ATTEMPTS = 2;

export async function fetchLostArkCalendar(options: LostArkClientOptions): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = new URL(CALENDAR_PATH, options.baseUrl);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        fetchImpl,
        endpoint,
        {
          method: "GET",
          headers: {
            accept: "application/json",
            authorization: toBearerToken(options.apiKey)
          }
        },
        options.timeoutMs
      );

      if (response.ok) {
        return await response.json();
      }

      if (shouldRetryStatus(response.status) && attempt < MAX_ATTEMPTS) {
        await wait(750);
        continue;
      }

      throw new LostArkApiError(getStatusMessage(response.status), response.status);
    } catch (error) {
      if (error instanceof LostArkApiError) {
        throw error;
      }

      if (attempt < MAX_ATTEMPTS) {
        await wait(750);
        continue;
      }

      throw new LostArkApiError(
        `Lost Ark API network request failed: ${errorToMessage(error)}.`,
        null
      );
    }
  }

  throw new LostArkApiError("Lost Ark API request failed.", null);
}

function toBearerToken(apiKey: string): string {
  const trimmed = apiKey.trim();
  return /^bearer\s+/i.test(trimmed) ? trimmed : `bearer ${trimmed}`;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: URL,
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

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function getStatusMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "Lost Ark API authentication failed. Check LOSTARK_API_KEY.";
  }
  if (status === 429) {
    return "Lost Ark API rate limit exceeded.";
  }
  if (status >= 500) {
    return "Lost Ark API appears unavailable or under maintenance.";
  }
  return `Lost Ark API request failed with HTTP ${status}.`;
}

function errorToMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
