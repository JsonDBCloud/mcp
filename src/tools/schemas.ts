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
 * Register schema management tools on the MCP server.
 */
export function registerSchemaTools(server: McpServer, db: JsonDB): void {
  // ── get_schema ───────────────────────────────────────────────────
  server.tool(
    "get_schema",
    "Get the JSON Schema for a jsondb.cloud collection. Returns the schema if one is set, or null if no schema is configured. Knowing the schema helps you create valid documents.",
    {
      collection: z
        .string()
        .describe("The collection name to get the schema for"),
    },
    async ({ collection }) => {
      try {
        const coll = db.collection(collection);
        const schema = await coll.getSchema();
        if (schema === null) {
          return success({
            collection,
            schema: null,
            message: `No schema is set for collection '${collection}'. Any valid JSON document can be stored.`,
          });
        }
        return success({ collection, schema });
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        return error(
          "GET_SCHEMA_FAILED",
          e.message || `Failed to get schema for collection '${collection}'.`,
          `Verify the collection name is correct. Use list_collections to see available collections.`,
        );
      }
    },
  );

  // ── set_schema ───────────────────────────────────────────────────
  server.tool(
    "set_schema",
    "Set a JSON Schema for a jsondb.cloud collection. Documents created or updated in this collection will be validated against the schema. Supports standard JSON Schema keywords: type, required, properties, enum, minimum, maximum, minLength, maxLength, pattern, and additionalProperties.",
    {
      collection: z
        .string()
        .describe("The collection name to set the schema for"),
      schema: z
        .record(z.string(), z.any())
        .describe(
          "The JSON Schema object. Example: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, age: { type: 'number', minimum: 0 } } }",
        ),
    },
    async ({ collection, schema }) => {
      try {
        const coll = db.collection(collection);
        await coll.setSchema(schema);
        return success({
          collection,
          schema,
          message: `Schema set successfully for collection '${collection}'. All new and updated documents will be validated against this schema.`,
        });
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 400) {
          return error(
            "INVALID_SCHEMA",
            e.message || "The provided schema is not a valid JSON Schema.",
            `Ensure the schema follows JSON Schema format. The top-level 'type' should typically be 'object'. Example: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }`,
          );
        }
        return error(
          "SET_SCHEMA_FAILED",
          e.message || `Failed to set schema for collection '${collection}'.`,
          `Verify the collection name and ensure the schema is valid JSON Schema format.`,
        );
      }
    },
  );

  // ── remove_schema ──────────────────────────────────────────────────
  server.tool(
    "remove_schema",
    "Remove the JSON Schema from a jsondb.cloud collection. After removal, any valid JSON document can be stored without validation. Existing documents are not affected.",
    {
      collection: z
        .string()
        .describe("The collection name to remove the schema from"),
    },
    async ({ collection }) => {
      try {
        const coll = db.collection(collection);
        await coll.removeSchema();
        return success({
          collection,
          schema: null,
          message: `Schema removed from collection '${collection}'. Documents are no longer validated.`,
        });
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "SCHEMA_NOT_FOUND",
            `No schema is set for collection '${collection}'.`,
            `Use get_schema({ collection: '${collection}' }) to check whether a schema exists.`,
          );
        }
        return error(
          "REMOVE_SCHEMA_FAILED",
          e.message || `Failed to remove schema from collection '${collection}'.`,
          `Verify the collection name is correct. Use list_collections to see available collections.`,
        );
      }
    },
  );

  // ── validate_document ──────────────────────────────────────────────
  server.tool(
    "validate_document",
    "Dry-run validate a document against a collection's schema without storing it. Returns { valid: true } or { valid: false, errors: [...] } with field-level error details. Use this before create_document when unsure if a document conforms to the schema.",
    {
      collection: z
        .string()
        .describe("The collection name whose schema to validate against"),
      data: z
        .record(z.string(), z.any())
        .describe("The document to validate"),
    },
    async ({ collection, data }) => {
      try {
        const coll = db.collection(collection);
        const result = await coll.validate(data as Record<string, unknown>);
        return success({ collection, ...result });
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "SCHEMA_NOT_FOUND",
            `No schema is set for collection '${collection}'.`,
            `Use set_schema to add a schema first, or use create_document directly if no validation is needed.`,
          );
        }
        return error(
          "VALIDATE_FAILED",
          e.message || `Failed to validate document against collection '${collection}' schema.`,
          `Verify the collection name is correct and the data is a valid JSON object.`,
        );
      }
    },
  );
}
