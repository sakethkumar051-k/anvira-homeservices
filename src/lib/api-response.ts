function invalidResponse(status: number) {
  const unavailable = status >= 500;
  return Object.assign(
    new Error(
      unavailable
        ? "ANVIRA is temporarily unavailable. Please retry in a moment."
        : "ANVIRA returned an unexpected response. Please retry or contact support if this continues.",
    ),
    {
      code: unavailable ? "SERVICE_UNAVAILABLE" : "INVALID_API_RESPONSE",
      status,
    },
  );
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const type = (response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (response.status === 429) {
    const json = type === "application/json" || type.endsWith("+json");
    let data: { error?: unknown; code?: unknown } | null = null;
    if (json) {
      try { data = await response.json(); } catch {}
    }
    const retry = response.headers.get("retry-after") || "";
    const numeric = Number(retry);
    const seconds = retry && Number.isFinite(numeric)
      ? numeric
      : (Date.parse(retry) - Date.now()) / 1000;
    throw Object.assign(new Error(
      typeof data?.error === "string" ? data.error : json
        ? "Too many requests. Please wait before trying again."
        : "ANVIRA's hosting provider is temporarily limiting this connection. Please wait before trying again.",
    ), {
      code: typeof data?.code === "string" ? data.code : json ? "RATE_LIMITED" : "UPSTREAM_RATE_LIMITED",
      status: 429,
      retryAfterSeconds: Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : 60,
    });
  }
  if (type !== "application/json" && !type.endsWith("+json"))
    throw invalidResponse(response.status);
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw invalidResponse(response.status);
  }
  if (!data || typeof data !== "object") throw invalidResponse(response.status);
  return data as T;
}

type LimitedError = Error & { code?: string; status: number; retryAfterSeconds: number };

// Share cooldown across sign-in, polling and business routes. A user-requested
// logout can still make its single attempt to terminate the server session.
export function createApiTransport(
  send: (url: string, init?: RequestInit, options?: { beforeAttempt?: () => void }) => Promise<Response>,
  now = Date.now,
) {
  let cooldown: { until: number; error: LimitedError } | null = null;
  const checkCooldown = () => {
    if (cooldown && now() < cooldown.until)
      throw Object.assign(new Error(cooldown.error.message), {
        code: cooldown.error.code,
        status: 429,
        retryAfterSeconds: Math.ceil((cooldown.until - now()) / 1000),
      });
  };
  return async (url: string, init?: RequestInit, intent?: { forSignOut?: boolean }): Promise<Response> => {
    const path = new URL(url).pathname;
    const method = (init?.method || "GET").toUpperCase();
    const logout = path === "/api/logout" && method === "POST";
    const logoutCsrf = intent?.forSignOut && path === "/api/csrf" && method === "GET";
    const beforeAttempt = logout || logoutCsrf ? () => {} : checkCooldown;
    beforeAttempt();
    const response = await send(url, init, { beforeAttempt });
    if (response.status === 429) {
      try { await parseApiResponse(response); }
      catch (error) {
        const limited = error as LimitedError;
        if (limited.status === 429) {
          const until = now() + limited.retryAfterSeconds * 1000;
          if (!cooldown || until > cooldown.until) cooldown = { until, error: limited };
          checkCooldown();
        }
        throw error;
      }
    }
    return response;
  };
}
