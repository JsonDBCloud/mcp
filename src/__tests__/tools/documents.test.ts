import { describe, it, expect } from "vitest";
import { createMockServer, createMockDb } from "./_mock.js";
import { registerDocumentTools } from "../../tools/documents.js";

describe("registerDocumentTools", () => {
  it("registers all document tools", () => {
    const server = createMockServer();
    const db = createMockDb();
    registerDocumentTools(server, db);
    const toolNames = server.tool.mock.calls.map((c: any[]) => c[0]);
    expect(toolNames).toContain("create_document");
    expect(toolNames).toContain("get_document");
    expect(toolNames).toContain("list_documents");
    expect(toolNames).toContain("update_document");
    expect(toolNames).toContain("patch_document");
    expect(toolNames).toContain("delete_document");
    expect(toolNames).toContain("count_documents");
    expect(toolNames).toContain("json_patch_document");
    expect(toolNames).toHaveLength(8);
  });
});
