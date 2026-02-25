import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { JsonDB } from "@jsondb-cloud/client";

/**
 * Format a successful result as MCP tool content.
 */
function success(data: unknown): { content: { type: "text"; text: string }[] } {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Format an error result with a suggestion for the AI agent.
 */
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

/**
 * Build SDK-compatible filter object from the search_documents filter array format.
 *
 * The SDK expects filters like:
 *   { field: value }              for equality
 *   { field: { $gt: value } }    for operators
 */
export function buildFilterObject(
  filters: { field: string; operator: string; value: unknown }[],
): Record<string, unknown> {
  const filterObj: Record<string, unknown> = {};

  const opMap: Record<string, string> = {
    eq: "$eq",
    neq: "$neq",
    gt: "$gt",
    gte: "$gte",
    lt: "$lt",
    lte: "$lte",
    contains: "$contains",
    in: "$in",
    exists: "$exists",
  };

  for (const f of filters) {
    if (f.operator === "eq") {
      filterObj[f.field] = f.value;
    } else {
      const sdkOp = opMap[f.operator];
      if (sdkOp) {
        filterObj[f.field] = { [sdkOp]: f.value };
      } else {
        // Fallback: treat unknown operators as equality
        filterObj[f.field] = f.value;
      }
    }
  }

  return filterObj;
}

/**
 * Register collection-level tools on the MCP server.
 */
export function registerCollectionTools(server: McpServer, db: JsonDB): void {
  // ── list_collections ─────────────────────────────────────────────
  server.tool(
    "list_collections",
    "List all collections in the current jsondb.cloud project. Returns collection names that contain documents. Use this to discover what data is available before querying.",
    {},
    async () => {
      try {
        // The SDK doesn't have a dedicated list-collections method.
        // We use the REST API directly by listing at the project level.
        // For now, we make a request to the base project URL.
        // The Collection class builds URLs as /{ns}/{collection},
        // so we use a special "_collections" pseudo-collection approach.
        // However, since the public API lists collections at GET /{ns},
        // we need to make a direct fetch call.
        const apiKey = process.env.JSONDB_API_KEY || "";
        const project = process.env.JSONDB_PROJECT || process.env.JSONDB_NAMESPACE || "v1";
        const baseUrl = (process.env.JSONDB_BASE_URL || "https://api.jsondb.cloud").replace(
          /\/$/,
          "",
        );

        const res = await fetch(`${baseUrl}/${project}`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw {
            status: res.status,
            message: (body as { error?: string }).error || res.statusText,
          };
        }

        const data = await res.json();
        return success(data);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        return error(
          "LIST_COLLECTIONS_FAILED",
          e.message || "Failed to list collections.",
          `Verify that the JSONDB_API_KEY and JSONDB_PROJECT environment variables are set correctly.`,
        );
      }
    },
  );

  // ── search_documents ─────────────────────────────────────────────
  server.tool(
    "search_documents",
    "Search for documents matching specific criteria. Supports equality, comparison operators (gt, gte, lt, lte), contains (case-insensitive substring), and in (value in list). Filters are combined with AND logic.",
    {
      collection: z.string().describe("The collection name"),
      filters: z
        .array(
          z.object({
            field: z.string().describe("Field path (supports dot notation for nested fields)"),
            operator: z
              .enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in", "exists"])
              .describe("Comparison operator"),
            value: z.any().describe("Value to compare against"),
          }),
        )
        .describe("Array of filter conditions (combined with AND logic)"),
      sort: z
        .string()
        .optional()
        .describe("Field to sort by. Prefix with '-' for descending (e.g., '-$createdAt')"),
      limit: z.number().optional().describe("Max documents to return (default: 20, max: 100)"),
      offset: z.number().optional().describe("Number of documents to skip for pagination"),
    },
    async ({ collection, filters, sort, limit, offset }) => {
      try {
        const coll = db.collection(collection);
        const filterObj = buildFilterObject(filters);
        const result = await coll.list({
          filter: filterObj,
          sort,
          limit,
          offset,
        });
        return success(result);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        return error(
          "SEARCH_FAILED",
          e.message || `Failed to search documents in collection '${collection}'.`,
          `Verify the collection name and filter syntax. Available operators: eq, neq, gt, gte, lt, lte, contains, in. Use list_collections to see available collections.`,
        );
      }
    },
  );

  // ── import_documents ─────────────────────────────────────────────
  server.tool(
    "import_documents",
    "Bulk import multiple documents into a jsondb.cloud collection at once. More efficient than creating documents one by one. Supports conflict resolution and custom ID field mapping.",
    {
      collection: z.string().describe("The collection name to import into"),
      documents: z
        .array(z.record(z.string(), z.any()))
        .describe("Array of JSON documents to import"),
      onConflict: z
        .enum(["fail", "skip", "overwrite"])
        .optional()
        .describe(
          "How to handle ID conflicts: 'fail' (default) rejects the batch, 'skip' ignores duplicates, 'overwrite' replaces existing documents",
        ),
      idField: z
        .string()
        .optional()
        .describe("Field in each document to use as _id. If omitted, IDs are auto-generated."),
    },
    async ({ collection, documents, onConflict, idField }) => {
      try {
        const apiKey = process.env.JSONDB_API_KEY || "";
        const project = process.env.JSONDB_PROJECT || process.env.JSONDB_NAMESPACE || "v1";
        const baseUrl = (process.env.JSONDB_BASE_URL || "https://api.jsondb.cloud").replace(
          /\/$/,
          "",
        );

        const params = new URLSearchParams();
        if (onConflict) params.set("onConflict", onConflict);
        if (idField) params.set("idField", idField);
        const qs = params.toString();

        const res = await fetch(
          `${baseUrl}/${project}/${collection}/_import${qs ? `?${qs}` : ""}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(documents),
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw {
            status: res.status,
            message: (body as { error?: string }).error || res.statusText,
          };
        }

        const data = await res.json();
        return success(data);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 413) {
          return error(
            "IMPORT_TOO_LARGE",
            "The import payload exceeds the maximum allowed size.",
            `Free plans support up to 1,000 documents (5 MB). Pro plans support up to 10,000 documents (50 MB). Try importing in smaller batches.`,
          );
        }
        if (e.status === 409) {
          return error(
            "IMPORT_CONFLICT",
            e.message || "One or more documents conflict with existing IDs.",
            `Use onConflict: 'skip' to ignore duplicates or 'overwrite' to replace existing documents.`,
          );
        }
        return error(
          "IMPORT_FAILED",
          e.message || `Failed to import documents into collection '${collection}'.`,
          `Verify each document is a valid JSON object. Check the import limits for your plan.`,
        );
      }
    },
  );

  // ── export_collection ──────────────────────────────────────────────
  server.tool(
    "export_collection",
    "Export all documents from a jsondb.cloud collection as a JSON array. Supports optional filtering to export a subset. Free plans support up to 1,000 documents, Pro plans up to 100,000.",
    {
      collection: z.string().describe("The collection name to export"),
      filter: z
        .record(z.string(), z.any())
        .optional()
        .describe(
          "Optional filter to export only matching documents. Same format as list_documents filter.",
        ),
    },
    async ({ collection, filter }) => {
      try {
        const apiKey = process.env.JSONDB_API_KEY || "";
        const project = process.env.JSONDB_PROJECT || process.env.JSONDB_NAMESPACE || "v1";
        const baseUrl = (process.env.JSONDB_BASE_URL || "https://api.jsondb.cloud").replace(
          /\/$/,
          "",
        );

        const params = new URLSearchParams();
        if (filter) {
          for (const [field, value] of Object.entries(filter)) {
            if (typeof value === "object" && value !== null) {
              const ops = value as Record<string, unknown>;
              for (const [op, v] of Object.entries(ops)) {
                const cleanOp = op.replace(/^\$/, "");
                params.set(`filter[${field}][${cleanOp}]`, String(v));
              }
            } else {
              params.set(`filter[${field}]`, String(value));
            }
          }
        }
        const qs = params.toString();

        const res = await fetch(
          `${baseUrl}/${project}/${collection}/_export${qs ? `?${qs}` : ""}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: "application/json",
            },
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw {
            status: res.status,
            message: (body as { error?: string }).error || res.statusText,
          };
        }

        const data = await res.json();
        const documents = Array.isArray(data) ? data : (data.data ?? []);
        return success({ collection, count: documents.length, documents });
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 403) {
          return error(
            "EXPORT_LIMIT_EXCEEDED",
            "Export limit exceeded for your plan.",
            `Free plans support up to 1,000 documents per export. Upgrade to Pro for up to 100,000.`,
          );
        }
        return error(
          "EXPORT_FAILED",
          e.message || `Failed to export collection '${collection}'.`,
          `Verify the collection name is correct. Use list_collections to see available collections.`,
        );
      }
    },
  );
}
