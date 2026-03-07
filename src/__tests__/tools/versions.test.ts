import { describe, it, expect } from "vitest";
import { createMockServer, createMockDb } from "./_mock.js";
import { registerVersionTools } from "../../tools/versions.js";

describe("registerVersionTools", () => {
  it("registers all version tools", () => {
    const server = createMockServer();
    const db = createMockDb();
    registerVersionTools(server, db);
    const toolNames = server.tool.mock.calls.map((c: any[]) => c[0]);
    expect(toolNames).toContain("list_versions");
    expect(toolNames).toContain("get_version");
    expect(toolNames).toContain("restore_version");
    expect(toolNames).toContain("diff_versions");
    expect(toolNames).toHaveLength(4);
  });
});
