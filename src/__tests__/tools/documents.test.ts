import { describe, it, expect, vi } from "vitest";
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

describe("document tool handlers", () => {
  function getHandler(server: any, toolName: string) {
    const call = server.tool.mock.calls.find((c: any[]) => c[0] === toolName);
    if (!call) throw new Error(`Tool "${toolName}" was not registered`);
    return call[call.length - 1];
  }

  it("create_document returns success on happy path", async () => {
    const server = createMockServer();
    const db = createMockDb();
    const mockDoc = { _id: "abc", name: "test" };
    db.collection.mockReturnValue({
      create: vi.fn().mockResolvedValue(mockDoc),
    });
    registerDocumentTools(server, db);
    const handler = getHandler(server, "create_document");
    const result = await handler({
      collection: "users",
      data: { name: "test" },
    });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual(mockDoc);
    expect(result.isError).toBeUndefined();
  });

  it("create_document returns DOCUMENT_CONFLICT on 409", async () => {
    const server = createMockServer();
    const db = createMockDb();
    db.collection.mockReturnValue({
      create: vi.fn().mockRejectedValue({ status: 409, message: "conflict" }),
    });
    registerDocumentTools(server, db);
    const handler = getHandler(server, "create_document");
    const result = await handler({
      collection: "users",
      data: { name: "test" },
      id: "dup",
    });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error.code).toBe("DOCUMENT_CONFLICT");
  });

  it("get_document returns DOCUMENT_NOT_FOUND on 404", async () => {
    const server = createMockServer();
    const db = createMockDb();
    db.collection.mockReturnValue({
      get: vi.fn().mockRejectedValue({ status: 404, message: "not found" }),
    });
    registerDocumentTools(server, db);
    const handler = getHandler(server, "get_document");
    const result = await handler({ collection: "users", id: "missing" });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("get_document returns success with document data", async () => {
    const server = createMockServer();
    const db = createMockDb();
    const mockDoc = { _id: "abc", name: "Alice" };
    db.collection.mockReturnValue({
      get: vi.fn().mockResolvedValue(mockDoc),
    });
    registerDocumentTools(server, db);
    const handler = getHandler(server, "get_document");
    const result = await handler({ collection: "users", id: "abc" });
    expect(JSON.parse(result.content[0].text)).toEqual(mockDoc);
  });

  it("create_document returns VALIDATION_ERROR on 400", async () => {
    const server = createMockServer();
    const db = createMockDb();
    db.collection.mockReturnValue({
      create: vi.fn().mockRejectedValue({ status: 400, message: "invalid field" }),
    });
    registerDocumentTools(server, db);
    const handler = getHandler(server, "create_document");
    const result = await handler({
      collection: "users",
      data: { bad: true },
    });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error.code).toBe("VALIDATION_ERROR");
  });
});
