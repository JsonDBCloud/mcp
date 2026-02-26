/**
 * Shared helper functions for MCP tool responses.
 */

/**
 * Format a successful result as MCP tool content.
 */
export function success(data: unknown): { content: { type: "text"; text: string }[] } {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Format an error result with a suggestion for the AI agent.
 */
export function error(
  code: string,
  message: string,
  suggestion: string,
): { content: { type: "text"; text: string }[]; isError: true } {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: { code, message, suggestion } }, null, 2),
      },
    ],
    isError: true as const,
  };
}

/**
 * Resolve common environment variables for direct REST API calls.
 */
export function resolveEnv(): { apiKey: string; project: string; baseUrl: string } {
  return {
    apiKey: process.env.JSONDB_API_KEY || "",
    project: process.env.JSONDB_PROJECT || process.env.JSONDB_NAMESPACE || "v1",
    baseUrl: (process.env.JSONDB_BASE_URL || "https://api.jsondb.cloud").replace(/\/$/, ""),
  };
}

/**
 * Perform an authenticated fetch against the JsonDB REST API.
 */
export async function apiFetch(
  url: string,
  apiKey: string,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined && ["POST", "PUT", "PATCH"].includes(method)) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw {
      status: res.status,
      message: (b as { error?: string }).error || res.statusText,
    };
  }
  if (res.status === 204) return { ok: true };
  return res.json();
}
