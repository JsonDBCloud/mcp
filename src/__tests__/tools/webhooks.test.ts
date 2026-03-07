import { describe, it, expect } from "vitest";
import { createMockServer, createMockDb } from "./_mock.js";
import { registerWebhookTools } from "../../tools/webhooks.js";

describe("registerWebhookTools", () => {
  it("registers all webhook tools", () => {
    const server = createMockServer();
    const db = createMockDb();
    registerWebhookTools(server, db);
    const toolNames = server.tool.mock.calls.map((c: any[]) => c[0]);
    expect(toolNames).toContain("create_webhook");
    expect(toolNames).toContain("list_webhooks");
    expect(toolNames).toContain("get_webhook");
    expect(toolNames).toContain("update_webhook");
    expect(toolNames).toContain("delete_webhook");
    expect(toolNames).toContain("test_webhook");
    expect(toolNames).toHaveLength(6);
  });
});
