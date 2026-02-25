import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JsonDB } from "@jsondb-cloud/client";

import { registerDocumentTools } from "./tools/documents.js";
import { registerCollectionTools } from "./tools/collections.js";
import { registerSchemaTools } from "./tools/schemas.js";
import { registerVersionTools } from "./tools/versions.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerCollectionResources } from "./resources/collections.js";

/**
 * @jsondb-cloud/mcp
 *
 * An MCP (Model Context Protocol) server that exposes jsondb.cloud operations
 * to AI agents such as Claude Code, Cursor, Windsurf, and other MCP-compatible tools.
 *
 * Environment variables:
 *   JSONDB_API_KEY     — Required. Your jsondb.cloud API key (jdb_sk_live_... or jdb_sk_test_...)
 *   JSONDB_PROJECT     — Optional. Project to use (default: "v1"). Falls back to JSONDB_NAMESPACE.
 *   JSONDB_BASE_URL    — Optional. API base URL (default: "https://api.jsondb.cloud")
 */

async function main(): Promise<void> {
  const apiKey = process.env.JSONDB_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: JSONDB_API_KEY environment variable is required.\n\n" +
        "Set it in your MCP server configuration:\n" +
        '  "env": { "JSONDB_API_KEY": "jdb_sk_live_..." }\n\n' +
        "Get an API key from your jsondb.cloud dashboard.",
    );
    process.exit(1);
  }

  const project = process.env.JSONDB_PROJECT || process.env.JSONDB_NAMESPACE || "v1";
  const baseUrl = process.env.JSONDB_BASE_URL || "https://api.jsondb.cloud";

  // Initialize the jsondb.cloud SDK client
  const db = new JsonDB({
    apiKey,
    project,
    baseUrl,
  });

  // Create the MCP server
  const server = new McpServer({
    name: "jsondb-cloud",
    version: "1.0.0",
  });

  // Register all tools
  registerDocumentTools(server, db);
  registerCollectionTools(server, db);
  registerSchemaTools(server, db);
  registerVersionTools(server, db);
  registerWebhookTools(server, db);

  // Register all resources
  registerCollectionResources(server, db);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
