import { describe, it, expect } from "vitest";
import { createMockServer, createMockDb } from "./_mock.js";
import { registerCollectionTools } from "../../tools/collections.js";

describe("registerCollectionTools", () => {
  it("registers all collection tools", () => {
    const server = createMockServer();
    const db = createMockDb();
    registerCollectionTools(server, db);
    const toolNames = server.tool.mock.calls.map((c: any[]) => c[0]);
    expect(toolNames).toContain("list_collections");
    expect(toolNames).toContain("search_documents");
    expect(toolNames).toContain("import_documents");
    expect(toolNames).toContain("export_collection");
    expect(toolNames).toHaveLength(4);
  });
});
