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
    baseUrl: (process.env.JSONDB_BASE_URL || "https://api.jsondb.cloud").replace(/\/$/, ""),
  };
}

async function webhookFetch(
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

const webhookEventEnum = z.enum(["document.created", "document.updated", "document.deleted"]);

/**
 * Register webhook management tools on the MCP server.
 */
export function registerWebhookTools(server: McpServer, _db: JsonDB): void {
  // ── create_webhook ─────────────────────────────────────────────────
  server.tool(
    "create_webhook",
    "Register a webhook on a jsondb.cloud collection. The webhook URL receives POST requests signed with HMAC-SHA256 when the specified events occur.",
    {
      collection: z.string().describe("The collection name to watch"),
      url: z.string().url().describe("The HTTPS URL to deliver webhook events to"),
      events: z
        .array(webhookEventEnum)
        .describe(
          "Events to subscribe to: 'document.created', 'document.updated', 'document.deleted'",
        ),
      description: z.string().optional().describe("Optional human-readable label for this webhook"),
    },
    async ({ collection, url: webhookUrl, events, description }) => {
      try {
        const { apiKey, project, baseUrl } = resolveEnv();
        const data = await webhookFetch(
          `${baseUrl}/${project}/${collection}/_webhooks`,
          apiKey,
          "POST",
          { url: webhookUrl, events, description },
        );
        return success(data);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 403) {
          return error(
            "WEBHOOK_LIMIT",
            e.message || "Webhook limit reached for this collection or plan.",
            `Free plans allow 3 total webhooks (1 per collection). Pro plans allow 50 total (10 per collection). Delete unused webhooks or upgrade.`,
          );
        }
        return error(
          "CREATE_WEBHOOK_FAILED",
          e.message || `Failed to create webhook for collection '${collection}'.`,
          `Verify the URL is reachable HTTPS and the event names are valid.`,
        );
      }
    },
  );

  // ── list_webhooks ──────────────────────────────────────────────────
  server.tool(
    "list_webhooks",
    "List all webhooks registered on a jsondb.cloud collection. Returns webhook IDs, URLs, subscribed events, and status.",
    {
      collection: z.string().describe("The collection name"),
    },
    async ({ collection }) => {
      try {
        const { apiKey, project, baseUrl } = resolveEnv();
        const data = await webhookFetch(`${baseUrl}/${project}/${collection}/_webhooks`, apiKey);
        return success(data);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        return error(
          "LIST_WEBHOOKS_FAILED",
          e.message || `Failed to list webhooks for collection '${collection}'.`,
          `Verify the collection name is correct. Use list_collections to see available collections.`,
        );
      }
    },
  );

  // ── get_webhook ────────────────────────────────────────────────────
  server.tool(
    "get_webhook",
    "Get details for a specific webhook including its recent delivery history and failure counts.",
    {
      collection: z.string().describe("The collection name"),
      webhookId: z.string().describe("The webhook ID (from list_webhooks or create_webhook)"),
    },
    async ({ collection, webhookId }) => {
      try {
        const { apiKey, project, baseUrl } = resolveEnv();
        const data = await webhookFetch(
          `${baseUrl}/${project}/${collection}/_webhooks/${webhookId}`,
          apiKey,
        );
        return success(data);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "WEBHOOK_NOT_FOUND",
            `Webhook '${webhookId}' not found in collection '${collection}'.`,
            `Use list_webhooks({ collection: '${collection}' }) to see available webhooks.`,
          );
        }
        return error(
          "GET_WEBHOOK_FAILED",
          e.message || `Failed to get webhook '${webhookId}'.`,
          `Verify the collection name and webhook ID are correct.`,
        );
      }
    },
  );

  // ── update_webhook ─────────────────────────────────────────────────
  server.tool(
    "update_webhook",
    "Update a webhook's URL, subscribed events, description, or enabled status. Only provided fields are changed.",
    {
      collection: z.string().describe("The collection name"),
      webhookId: z.string().describe("The webhook ID to update"),
      url: z.string().url().optional().describe("New delivery URL"),
      events: z
        .array(webhookEventEnum)
        .optional()
        .describe("New event subscriptions (replaces existing list)"),
      description: z.string().optional().describe("New description"),
      status: z
        .enum(["active", "disabled"])
        .optional()
        .describe("Set to 'disabled' to pause delivery, 'active' to resume"),
    },
    async ({
      collection,
      webhookId,
      url: webhookUrl,
      events,
      description,
      status: webhookStatus,
    }) => {
      try {
        const { apiKey, project, baseUrl } = resolveEnv();
        const body: Record<string, unknown> = {};
        if (webhookUrl !== undefined) body.url = webhookUrl;
        if (events !== undefined) body.events = events;
        if (description !== undefined) body.description = description;
        if (webhookStatus !== undefined) body.status = webhookStatus;

        const data = await webhookFetch(
          `${baseUrl}/${project}/${collection}/_webhooks/${webhookId}`,
          apiKey,
          "PUT",
          body,
        );
        return success(data);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "WEBHOOK_NOT_FOUND",
            `Webhook '${webhookId}' not found in collection '${collection}'.`,
            `Use list_webhooks({ collection: '${collection}' }) to see available webhooks.`,
          );
        }
        return error(
          "UPDATE_WEBHOOK_FAILED",
          e.message || `Failed to update webhook '${webhookId}'.`,
          `Verify the collection name and webhook ID are correct.`,
        );
      }
    },
  );

  // ── delete_webhook ─────────────────────────────────────────────────
  server.tool(
    "delete_webhook",
    "Delete a webhook permanently. Delivery of pending events is stopped immediately. This action cannot be undone.",
    {
      collection: z.string().describe("The collection name"),
      webhookId: z.string().describe("The webhook ID to delete"),
    },
    async ({ collection, webhookId }) => {
      try {
        const { apiKey, project, baseUrl } = resolveEnv();
        await webhookFetch(
          `${baseUrl}/${project}/${collection}/_webhooks/${webhookId}`,
          apiKey,
          "DELETE",
        );
        return success({ deleted: true, webhookId, collection });
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "WEBHOOK_NOT_FOUND",
            `Webhook '${webhookId}' not found in collection '${collection}'.`,
            `Use list_webhooks({ collection: '${collection}' }) to see available webhooks.`,
          );
        }
        return error(
          "DELETE_WEBHOOK_FAILED",
          e.message || `Failed to delete webhook '${webhookId}'.`,
          `Verify the collection name and webhook ID are correct.`,
        );
      }
    },
  );

  // ── test_webhook ───────────────────────────────────────────────────
  server.tool(
    "test_webhook",
    "Send a test event to a webhook to verify the endpoint is reachable and signature verification is working. Returns the delivery result.",
    {
      collection: z.string().describe("The collection name"),
      webhookId: z.string().describe("The webhook ID to test"),
    },
    async ({ collection, webhookId }) => {
      try {
        const { apiKey, project, baseUrl } = resolveEnv();
        const data = await webhookFetch(
          `${baseUrl}/${project}/${collection}/_webhooks/${webhookId}/test`,
          apiKey,
          "POST",
        );
        return success(data);
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        if (e.status === 404) {
          return error(
            "WEBHOOK_NOT_FOUND",
            `Webhook '${webhookId}' not found in collection '${collection}'.`,
            `Use list_webhooks({ collection: '${collection}' }) to see available webhooks.`,
          );
        }
        return error(
          "TEST_WEBHOOK_FAILED",
          e.message || `Failed to send test event to webhook '${webhookId}'.`,
          `Verify the webhook URL is reachable and responding with a 2xx status.`,
        );
      }
    },
  );
}
