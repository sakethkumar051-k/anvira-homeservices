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
