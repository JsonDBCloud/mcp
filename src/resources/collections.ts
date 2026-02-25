import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JsonDB } from "@jsondb-cloud/client";

/**
 * Register MCP resources for jsondb.cloud collections and schemas.
 *
 * Resources provide read-only context that AI agents can access to understand
 * the structure of the database without needing to call tools.
 */
export function registerCollectionResources(server: McpServer, db: JsonDB): void {
  // ── jsondb://collections ─────────────────────────────────────────
  // Static resource: list of all collections in the project
  server.resource(
    "collections-list",
    "jsondb://collections",
    {
      name: "jsondb.cloud Collections",
      description:
        "List of all collections in the current project. Use this to discover what data is available.",
      mimeType: "application/json",
    },
    async () => {
      try {
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
          return {
            contents: [
              {
                uri: "jsondb://collections",
                mimeType: "application/json" as const,
                text: JSON.stringify(
                  { error: `Failed to fetch collections: ${res.statusText}` },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const data = await res.json();
        return {
          contents: [
            {
              uri: "jsondb://collections",
              mimeType: "application/json" as const,
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const e = err as { message?: string };
        return {
          contents: [
            {
              uri: "jsondb://collections",
              mimeType: "application/json" as const,
              text: JSON.stringify({ error: e.message || "Failed to fetch collections" }, null, 2),
            },
          ],
        };
      }
    },
  );

  // ── jsondb://collections/{collection}/schema ─────────────────────
  // Resource template: schema for a specific collection
  server.resource(
    "collection-schema",
    "jsondb://collections/{collection}/schema",
    {
      name: "Collection Schema",
      description:
        "JSON Schema for a specific collection (if set). Helps AI agents understand the expected document structure.",
      mimeType: "application/json",
    },
    async (uri, params) => {
      const collection =
        typeof params.collection === "string" ? params.collection : String(params.collection);
      try {
        const coll = db.collection(collection);
        const schema = await coll.getSchema();

        const result =
          schema !== null
            ? { collection, schema }
            : {
                collection,
                schema: null,
                message: `No schema is set for collection '${collection}'. Any valid JSON document can be stored.`,
              };

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const e = err as { message?: string };
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json" as const,
              text: JSON.stringify(
                {
                  error: e.message || `Failed to fetch schema for collection '${collection}'`,
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );
}
