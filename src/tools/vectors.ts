import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { JsonDB } from "@jsondb-cloud/client";
import { success, error, resolveEnv, apiFetch } from "./_helpers.js";

/**
 * Register vector / semantic-search tools on the MCP server.
 */
export function registerVectorTools(server: McpServer, _db: JsonDB): void {
  // ── semantic_search ───────────────────────────────────────────────
  server.tool(
    "semantic_search",
    "Search documents using natural language semantic similarity. Returns ranked results with relevance scores. Requires documents to have been stored with embeddings.",
    {
      collection: z.string().describe("Collection to search in"),
      query: z.string().describe("Natural language search query"),
      limit: z.number().min(1).max(100).default(10).optional().describe("Max results to return"),
      threshold: z
        .number()
        .min(0)
        .max(1)
        .default(0.7)
        .optional()
        .describe("Minimum similarity score (0-1)"),
      filter: z.record(z.unknown()).optional().describe("Additional filter criteria"),
    },
    async ({ collection, query, limit, threshold, filter }) => {
      try {
        const { apiKey, project, baseUrl } = resolveEnv();
        const body: Record<string, unknown> = { query };
        if (limit !== undefined) body.limit = limit;
        if (threshold !== undefined) body.threshold = threshold;
        if (filter !== undefined) body.filter = filter;

        const data = await apiFetch(
          `${baseUrl}/${project}/${collection}/_search`,
          apiKey,
          "POST",
          body,
        );
        return success(data);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "COLLECTION_NOT_FOUND",
            `Collection '${collection}' not found or has no embeddings.`,
            `Ensure the collection exists and documents were stored with store_with_embedding. Use list_collections to see available collections.`,
          );
        }
        if (e.status === 400) {
          return error(
            "INVALID_SEARCH",
            e.message || `Invalid search request for collection '${collection}'.`,
            `Check that the query is a non-empty string and threshold is between 0 and 1.`,
          );
        }
        if (e.status === 403) {
          return error(
            "SEARCH_NOT_AVAILABLE",
            e.message || "Semantic search is not available on your current plan.",
            `Upgrade your plan at https://jsondb.cloud/dashboard/billing to enable vector search.`,
          );
        }
        return error(
          "SEARCH_FAILED",
          e.message || `Failed to search collection '${collection}'.`,
          `Verify the collection name and that documents have been stored with embeddings.`,
        );
      }
    },
  );

  // ── store_with_embedding ──────────────────────────────────────────
  server.tool(
    "store_with_embedding",
    "Store a document and automatically generate a vector embedding for semantic search. The embed_field specifies which field's text content should be embedded.",
    {
      collection: z.string().describe("Collection to store in"),
      data: z.record(z.unknown()).describe("Document data to store"),
      embed_field: z.string().describe("Field name whose content will be embedded for search"),
      id: z.string().optional().describe("Optional custom document ID"),
    },
    async ({ collection, data, embed_field, id }) => {
      try {
        const { apiKey, project, baseUrl } = resolveEnv();
        const payload = { ...data, $embed: embed_field };

        let result: unknown;
        if (id) {
          result = await apiFetch(
            `${baseUrl}/${project}/${collection}/${id}`,
            apiKey,
            "PUT",
            payload,
          );
        } else {
          result = await apiFetch(`${baseUrl}/${project}/${collection}`, apiKey, "POST", payload);
        }
        return success(result);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 400) {
          return error(
            "VALIDATION_ERROR",
            e.message || `The document failed validation for collection '${collection}'.`,
            `Ensure the embed_field '${embed_field}' exists in your data and contains text content suitable for embedding.`,
          );
        }
        if (e.status === 413) {
          return error(
            "DOCUMENT_TOO_LARGE",
            `The document exceeds the maximum allowed size.`,
            `Reduce the document size. Free plans allow up to 16 KB per document, Pro plans allow up to 1 MB.`,
          );
        }
        if (e.status === 403) {
          return error(
            "EMBEDDING_NOT_AVAILABLE",
            e.message || "Embedding generation is not available on your current plan.",
            `Upgrade your plan at https://jsondb.cloud/dashboard/billing to enable automatic embeddings.`,
          );
        }
        return error(
          "STORE_EMBEDDING_FAILED",
          e.message || `Failed to store document with embedding in collection '${collection}'.`,
          `Check that the collection name is valid, the data is a valid JSON object, and the embed_field references an existing text field.`,
        );
      }
    },
  );
}
