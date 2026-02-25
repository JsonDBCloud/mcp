import { describe, it, expect } from "vitest";
import { createMockServer, createMockDb } from "./_mock.js";
import { registerSchemaTools } from "../../tools/schemas.js";

describe("registerSchemaTools", () => {
  it("registers all schema tools", () => {
    const server = createMockServer();
    const db = createMockDb();
    registerSchemaTools(server, db);
    const toolNames = server.tool.mock.calls.map((c: any[]) => c[0]);
    expect(toolNames).toContain("get_schema");
    expect(toolNames).toContain("set_schema");
    expect(toolNames).toContain("remove_schema");
    expect(toolNames).toContain("validate_document");
    expect(toolNames).toHaveLength(4);
  });
});
