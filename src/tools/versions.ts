import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { JsonDB } from "@jsondb-cloud/client";

function success(data: unknown): { content: { type: "text"; text: string }[] } {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function error(
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

function resolveEnv(): { apiKey: string; project: string; baseUrl: string } {
  return {
    apiKey: process.env.JSONDB_API_KEY || "",
    project: process.env.JSONDB_PROJECT || process.env.JSONDB_NAMESPACE || "v1",
    baseUrl: (process.env.JSONDB_BASE_URL || "https://api.jsondb.cloud").replace(
      /\/$/,
      "",
    ),
  };
}

async function versionFetch(
  url: string,
  apiKey: string,
  opts: RequestInit = {},
): Promise<unknown> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(opts.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw {
      status: res.status,
      message: (body as { error?: string }).error || res.statusText,
    };
  }
  if (res.status === 204) return { ok: true };
  return res.json();
}

/**
 * Register document version history tools on the MCP server.
 */
export function registerVersionTools(server: McpServer, _db: JsonDB): void {
  // ── list_versions ──────────────────────────────────────────────────
  server.tool(
    "list_versions",
    "List all stored versions of a document. Returns version numbers, timestamps, and size. Version history depth depends on plan (Free: 5, Pro: 50).",
    {
      collection: z.string().describe("The collection name"),
      id: z.string().describe("The document ID"),
    },
    async ({ collection, id }) => {
      try {
        const { apiKey, project, baseUrl } = resolveEnv();
        const data = await versionFetch(
          `${baseUrl}/${project}/${collection}/${id}/versions`,
          apiKey,
        );
        return success(data);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "DOCUMENT_NOT_FOUND",
            `Document '${id}' not found in collection '${collection}'.`,
            `Use list_documents({ collection: '${collection}' }) to see available documents.`,
          );
        }
        return error(
          "LIST_VERSIONS_FAILED",
          e.message || `Failed to list versions for document '${id}'.`,
          `Verify the collection and document ID are correct.`,
        );
      }
    },
  );

  // ── get_version ────────────────────────────────────────────────────
  server.tool(
    "get_version",
    "Retrieve the document as it existed at a specific version number. Returns the full document snapshot at that version.",
    {
      collection: z.string().describe("The collection name"),
      id: z.string().describe("The document ID"),
      version: z
        .number()
        .int()
        .positive()
        .describe("The version number to retrieve (from list_versions)"),
    },
    async ({ collection, id, version }) => {
      try {
        const { apiKey, project, baseUrl } = resolveEnv();
        const data = await versionFetch(
          `${baseUrl}/${project}/${collection}/${id}/versions/${version}`,
          apiKey,
        );
        return success(data);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "VERSION_NOT_FOUND",
            `Version ${version} of document '${id}' not found in collection '${collection}'.`,
            `Use list_versions({ collection: '${collection}', id: '${id}' }) to see available versions.`,
          );
        }
        return error(
          "GET_VERSION_FAILED",
          e.message || `Failed to get version ${version} of document '${id}'.`,
          `Verify the collection, document ID, and version number are correct.`,
        );
      }
    },
  );

  // ── restore_version ────────────────────────────────────────────────
  server.tool(
    "restore_version",
    "Restore a document to a previous version. The current document is overwritten with the historical snapshot. Creates a new version entry. This action cannot be undone.",
    {
      collection: z.string().describe("The collection name"),
      id: z.string().describe("The document ID"),
      version: z
        .number()
        .int()
        .positive()
        .describe("The version number to restore to (from list_versions)"),
    },
    async ({ collection, id, version }) => {
      try {
        const { apiKey, project, baseUrl } = resolveEnv();
        const data = await versionFetch(
          `${baseUrl}/${project}/${collection}/${id}/versions/${version}/restore`,
          apiKey,
          { method: "POST" },
        );
        return success(data);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "VERSION_NOT_FOUND",
            `Version ${version} of document '${id}' not found in collection '${collection}'.`,
            `Use list_versions({ collection: '${collection}', id: '${id}' }) to see available versions.`,
          );
        }
        if (e.status === 400) {
          return error(
            "VALIDATION_ERROR",
            e.message || "The restored document failed schema validation.",
            `The historical version may not match the current schema. Use get_schema({ collection: '${collection}' }) to review.`,
          );
        }
        return error(
          "RESTORE_VERSION_FAILED",
          e.message || `Failed to restore document '${id}' to version ${version}.`,
          `Verify the collection, document ID, and version number are correct.`,
        );
      }
    },
  );

  // ── diff_versions ──────────────────────────────────────────────────
  server.tool(
    "diff_versions",
    "Compare two versions of a document and return a structured diff showing added, removed, and changed fields. Pro plan feature only.",
    {
      collection: z.string().describe("The collection name"),
      id: z.string().describe("The document ID"),
      from: z
        .number()
        .int()
        .positive()
        .describe("The base version number (older version)"),
      to: z
        .number()
        .int()
        .positive()
        .describe("The target version number (newer version)"),
    },
    async ({ collection, id, from, to }) => {
      try {
        const { apiKey, project, baseUrl } = resolveEnv();
        const params = new URLSearchParams({
          from: String(from),
          to: String(to),
        });
        const data = await versionFetch(
          `${baseUrl}/${project}/${collection}/${id}/versions/diff?${params.toString()}`,
          apiKey,
        );
        return success(data);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 403) {
          return error(
            "PRO_FEATURE",
            "Version diff is a Pro plan feature.",
            `Upgrade to Pro at https://jsondb.cloud/dashboard/billing to enable version diffs.`,
          );
        }
        if (e.status === 404) {
          return error(
            "VERSION_NOT_FOUND",
            `One or both versions (${from}, ${to}) not found for document '${id}'.`,
            `Use list_versions({ collection: '${collection}', id: '${id}' }) to see available version numbers.`,
          );
        }
        return error(
          "DIFF_VERSIONS_FAILED",
          e.message || `Failed to diff versions ${from} and ${to} of document '${id}'.`,
          `Verify the collection, document ID, and both version numbers are correct.`,
        );
      }
    },
  );
}
