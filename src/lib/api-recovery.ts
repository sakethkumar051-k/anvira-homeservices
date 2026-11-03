type RecoveryOptions = {
  fetcher?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
  attemptTimeoutMs?: number;
  beforeAttempt?: () => void;
};

// A sleeping free host can return an HTML gateway error before starting up.
// Only reads are safe to replay. Mutations retain their explicit retry flow.
export async function fetchWithRecovery(
  url: string,
  init: RequestInit = {},
  options: RecoveryOptions = {},
): Promise<Response> {
  const send = options.fetcher || fetch;
  const wait = options.wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const attempts = ["GET", "HEAD"].includes((init.method || "GET").toUpperCase())
    ? 4
    : 1;
  for (let attempt = 0; ; attempt++) {
    if (init.signal?.aborted) {
      const error = new Error("Request cancelled.");
      error.name = "AbortError";
      throw error;
    }
    options.beforeAttempt?.();
    const controller = new AbortController();
    const abort = () => controller.abort();
    init.signal?.addEventListener("abort", abort);
    const timer = setTimeout(abort, options.attemptTimeoutMs ?? 20000);
    try {
      const response = await send(url, { ...init, signal: controller.signal });
      // Keep body reads inside the deadline too: fetch resolves at headers.
      const body = await response.arrayBuffer();
      if (![502, 503, 504].includes(response.status) || attempt + 1 >= attempts)
        return new Response([204, 205, 304].includes(response.status) ? null : body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
    } catch (error) {
      const transient =
        error instanceof TypeError ||
        (error instanceof Error && error.name === "AbortError");
      if (init.signal?.aborted || !transient || attempt + 1 >= attempts)
        throw error;
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", abort);
    }
    await wait((attempt + 1) * 1000);
  }
}
