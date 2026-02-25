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
 * Register all document CRUD tools on the MCP server.
 */
export function registerDocumentTools(server: McpServer, db: JsonDB): void {
  // ── create_document ──────────────────────────────────────────────
  server.tool(
    "create_document",
    "Create a new JSON document in a jsondb.cloud collection. Returns the created document with auto-generated _id, $createdAt, $updatedAt, and $version metadata.",
    {
      collection: z.string().describe("The collection name (e.g., 'users', 'posts', 'settings')"),
      data: z
        .record(z.string(), z.any())
        .describe("The JSON document to store. Can contain any valid JSON."),
      id: z
        .string()
        .optional()
        .describe("Optional custom document ID. If not provided, an ID is auto-generated."),
    },
    async ({ collection, data, id }) => {
      try {
        const coll = db.collection(collection);
        const doc = await coll.create(data, id ? { id } : undefined);
        return success(doc);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 409) {
          return error(
            "DOCUMENT_CONFLICT",
            `A document with this ID already exists in collection '${collection}'.`,
            `Use update_document to replace an existing document, or omit the 'id' parameter to auto-generate a unique ID.`,
          );
        }
        if (e.status === 413) {
          return error(
            "DOCUMENT_TOO_LARGE",
            `The document exceeds the maximum allowed size.`,
            `Reduce the document size. Free plans allow up to 16 KB per document, Pro plans allow up to 1 MB.`,
          );
        }
        if (e.status === 400) {
          return error(
            "VALIDATION_ERROR",
            e.message || `The document failed schema validation for collection '${collection}'.`,
            `Use get_schema({ collection: '${collection}' }) to see the required schema, then adjust your document to match.`,
          );
        }
        return error(
          "CREATE_FAILED",
          e.message || "Failed to create document",
          `Check that the collection name '${collection}' is valid and the data is a valid JSON object.`,
        );
      }
    },
  );

  // ── get_document ─────────────────────────────────────────────────
  server.tool(
    "get_document",
    "Read a single document by ID from a jsondb.cloud collection. Returns the full document including metadata fields (_id, $createdAt, $updatedAt, $version).",
    {
      collection: z.string().describe("The collection name"),
      id: z.string().describe("The document ID to retrieve"),
    },
    async ({ collection, id }) => {
      try {
        const coll = db.collection(collection);
        const doc = await coll.get(id);
        return success(doc);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "DOCUMENT_NOT_FOUND",
            `Document '${id}' not found in collection '${collection}'.`,
            `Use list_documents({ collection: '${collection}' }) to see available documents, or check that the ID is correct.`,
          );
        }
        return error(
          "GET_FAILED",
          e.message || "Failed to get document",
          `Verify that the collection '${collection}' exists and the document ID '${id}' is correct.`,
        );
      }
    },
  );

  // ── list_documents ───────────────────────────────────────────────
  server.tool(
    "list_documents",
    "List documents in a jsondb.cloud collection with optional filtering, sorting, and pagination. Returns a paginated response with data array and metadata (total count, hasMore).",
    {
      collection: z.string().describe("The collection name"),
      filter: z
        .record(z.string(), z.any())
        .optional()
        .describe(
          "Filter criteria. Keys are field names, values are match values. Use {field: {$gt: N}} for comparisons.",
        ),
      sort: z
        .string()
        .optional()
        .describe("Field to sort by. Prefix with '-' for descending (e.g., '-$createdAt')"),
      limit: z.number().optional().describe("Max documents to return (default: 20, max: 100)"),
      offset: z.number().optional().describe("Number of documents to skip for pagination"),
      select: z
        .array(z.string())
        .optional()
        .describe(
          "Field names to return. Omit to return all fields. Example: ['name', 'email', '$createdAt']",
        ),
    },
    async ({ collection, filter, sort, limit, offset, select }) => {
      try {
        const coll = db.collection(collection);
        const result = await coll.list({
          filter,
          sort,
          limit,
          offset,
          select,
        });
        return success(result);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        return error(
          "LIST_FAILED",
          e.message || `Failed to list documents in collection '${collection}'.`,
          `Verify the collection name is correct. Use list_collections to see available collections.`,
        );
      }
    },
  );

  // ── update_document ──────────────────────────────────────────────
  server.tool(
    "update_document",
    "Replace a document entirely in a jsondb.cloud collection. The new data replaces all existing fields (except metadata). Use patch_document for partial updates.",
    {
      collection: z.string().describe("The collection name"),
      id: z.string().describe("The document ID to replace"),
      data: z
        .record(z.string(), z.any())
        .describe("The complete new document data. This replaces all existing fields."),
    },
    async ({ collection, id, data }) => {
      try {
        const coll = db.collection(collection);
        const doc = await coll.update(id, data);
        return success(doc);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "DOCUMENT_NOT_FOUND",
            `Document '${id}' not found in collection '${collection}'.`,
            `Use list_documents({ collection: '${collection}' }) to see available documents. To create a new document, use create_document instead.`,
          );
        }
        if (e.status === 400) {
          return error(
            "VALIDATION_ERROR",
            e.message || `The document failed schema validation.`,
            `Use get_schema({ collection: '${collection}' }) to see the required schema, then adjust your document to match.`,
          );
        }
        return error(
          "UPDATE_FAILED",
          e.message || "Failed to update document",
          `Verify that collection '${collection}' and document ID '${id}' are correct.`,
        );
      }
    },
  );

  // ── patch_document ───────────────────────────────────────────────
  server.tool(
    "patch_document",
    "Partially update a document in a jsondb.cloud collection using merge patch. Only the provided fields are updated; other fields remain unchanged. This is preferred over update_document when you only need to change a few fields.",
    {
      collection: z.string().describe("The collection name"),
      id: z.string().describe("The document ID to patch"),
      data: z
        .record(z.string(), z.any())
        .describe(
          "The fields to update. Only these fields are modified; other existing fields are preserved.",
        ),
    },
    async ({ collection, id, data }) => {
      try {
        const coll = db.collection(collection);
        const doc = await coll.patch(id, data);
        return success(doc);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "DOCUMENT_NOT_FOUND",
            `Document '${id}' not found in collection '${collection}'.`,
            `Use list_documents({ collection: '${collection}' }) to see available documents. To create a new document, use create_document instead.`,
          );
        }
        if (e.status === 400) {
          return error(
            "VALIDATION_ERROR",
            e.message || `The patched document failed schema validation.`,
            `Use get_schema({ collection: '${collection}' }) to see the required schema. Ensure the patched result conforms to it.`,
          );
        }
        return error(
          "PATCH_FAILED",
          e.message || "Failed to patch document",
          `Verify that collection '${collection}' and document ID '${id}' are correct.`,
        );
      }
    },
  );

  // ── delete_document ──────────────────────────────────────────────
  server.tool(
    "delete_document",
    "Delete a document by ID from a jsondb.cloud collection. This action is permanent and cannot be undone.",
    {
      collection: z.string().describe("The collection name"),
      id: z.string().describe("The document ID to delete"),
    },
    async ({ collection, id }) => {
      try {
        const coll = db.collection(collection);
        await coll.delete(id);
        return success({
          deleted: true,
          _id: id,
          collection,
        });
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "DOCUMENT_NOT_FOUND",
            `Document '${id}' not found in collection '${collection}'.`,
            `The document may have already been deleted. Use list_documents({ collection: '${collection}' }) to see current documents.`,
          );
        }
        return error(
          "DELETE_FAILED",
          e.message || "Failed to delete document",
          `Verify that collection '${collection}' and document ID '${id}' are correct.`,
        );
      }
    },
  );

  // ── count_documents ────────────────────────────────────────────────
  server.tool(
    "count_documents",
    "Count documents in a jsondb.cloud collection, optionally filtered. Returns a single number. Use this instead of list_documents when you only need a count.",
    {
      collection: z.string().describe("The collection name"),
      filter: z
        .record(z.string(), z.any())
        .optional()
        .describe(
          "Filter criteria. Same format as list_documents. Only matching documents are counted.",
        ),
    },
    async ({ collection, filter }) => {
      try {
        const coll = db.collection(collection);
        const count = await coll.count(filter);
        return success({ collection, count });
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        return error(
          "COUNT_FAILED",
          e.message || `Failed to count documents in collection '${collection}'.`,
          `Verify the collection name is correct. Use list_collections to see available collections.`,
        );
      }
    },
  );

  // ── json_patch_document ────────────────────────────────────────────
  server.tool(
    "json_patch_document",
    "Apply RFC 6902 JSON Patch operations to a document. Supports op types: add, remove, replace, move, copy, test. Use patch_document for simple field merges; use this for precise structural mutations like array element updates.",
    {
      collection: z.string().describe("The collection name"),
      id: z.string().describe("The document ID to patch"),
      operations: z
        .array(
          z.object({
            op: z
              .enum(["add", "remove", "replace", "move", "copy", "test"])
              .describe("Patch operation type"),
            path: z.string().describe("JSON Pointer path (e.g., '/name', '/tags/0')"),
            value: z.any().optional().describe("Value for add/replace/test operations"),
            from: z.string().optional().describe("Source path for move/copy operations"),
          }),
        )
        .describe("Array of JSON Patch operations to apply in order"),
    },
    async ({ collection, id, operations }) => {
      try {
        const coll = db.collection(collection);
        const doc = await coll.jsonPatch(id, operations);
        return success(doc);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "DOCUMENT_NOT_FOUND",
            `Document '${id}' not found in collection '${collection}'.`,
            `Use list_documents({ collection: '${collection}' }) to see available documents.`,
          );
        }
        if (e.status === 409) {
          return error(
            "PATCH_CONFLICT",
            e.message || "A 'test' operation failed or a path conflict occurred.",
            `Review the patch operations. A 'test' op asserts a value must match before applying changes.`,
          );
        }
        if (e.status === 400) {
          return error(
            "VALIDATION_ERROR",
            e.message || "The patched document failed schema validation.",
            `Use get_schema({ collection: '${collection}' }) to review the required schema.`,
          );
        }
        return error(
          "JSON_PATCH_FAILED",
          e.message || "Failed to apply JSON Patch",
          `Verify the patch operations are valid RFC 6902. Paths must use JSON Pointer format (e.g., '/field', '/nested/key').`,
        );
      }
    },
  );
}
