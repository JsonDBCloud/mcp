import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { JsonDB } from "@jsondb-cloud/client";
import http from "node:http";

import { registerDocumentTools } from "./tools/documents.js";
import { registerCollectionTools } from "./tools/collections.js";
import { registerSchemaTools } from "./tools/schemas.js";
import { registerVersionTools } from "./tools/versions.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerVectorTools } from "./tools/vectors.js";
import { registerCollectionResources } from "./resources/collections.js";

/**
 * @jsondb-cloud/mcp
 *
 * An MCP (Model Context Protocol) server that exposes jsondb.cloud operations
 * to AI agents such as Claude Code, Cursor, Windsurf, and other MCP-compatible tools.
 *
 * Environment variables:
 *   JSONDB_API_KEY          — Required. Your jsondb.cloud API key (jdb_sk_live_... or jdb_sk_test_...)
 *   JSONDB_PROJECT          — Optional. Project to use (default: "v1"). Falls back to JSONDB_NAMESPACE.
 *   JSONDB_BASE_URL         — Optional. API base URL (default: "https://api.jsondb.cloud")
 *   JSONDB_MCP_TRANSPORT    — Optional. Transport type: "stdio" (default) or "http"
 *   JSONDB_MCP_PORT         — Optional. HTTP port (default: 3100). Only used when transport is "http".
 *   JSONDB_MCP_HOST         — Optional. HTTP bind address (default: "127.0.0.1"). Only used when transport is "http".
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

  /** Create a fresh MCP server instance with all tools registered */
  function createServer(): McpServer {
    const s = new McpServer({ name: "jsondb-cloud", version: "1.0.0" });
    registerDocumentTools(s, db);
    registerCollectionTools(s, db);
    registerSchemaTools(s, db);
    registerVersionTools(s, db);
    registerWebhookTools(s, db);
    registerVectorTools(s, db);
    registerCollectionResources(s, db);
    return s;
  }

  // Choose transport based on environment
  const transportType = process.env.JSONDB_MCP_TRANSPORT || "stdio";

  if (transportType === "http") {
    const port = parseInt(process.env.JSONDB_MCP_PORT || "3100", 10);
    const host = process.env.JSONDB_MCP_HOST || "127.0.0.1";

    const httpServer = http.createServer(async (req, res) => {
      // Health check endpoint
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      // MCP endpoint — new server+transport per request (stateless)
      if (req.url === "/mcp") {
        const server = createServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        res.on("close", () => {
          transport.close().catch(() => {});
          server.close().catch(() => {});
        });
        await server.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    });

    httpServer.listen(port, host, () => {
      console.error(`MCP HTTP server listening on ${host}:${port}`);
    });
  } else {
    // Default: stdio transport
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
