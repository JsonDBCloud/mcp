import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockServer, createMockDb } from "./_mock.js";
import { registerVectorTools } from "../../tools/vectors.js";

describe("registerVectorTools", () => {
  it("registers all vector tools", () => {
    const server = createMockServer();
    const db = createMockDb();
    registerVectorTools(server, db);
    const toolNames = server.tool.mock.calls.map((c: any[]) => c[0]);
    expect(toolNames).toContain("semantic_search");
    expect(toolNames).toContain("store_with_embedding");
    expect(toolNames).toHaveLength(2);
  });
});

describe("vector tool handlers", () => {
  function getHandler(server: any, toolName: string) {
    const call = server.tool.mock.calls.find((c: any[]) => c[0] === toolName);
    if (!call) throw new Error(`Tool "${toolName}" was not registered`);
    return call[call.length - 1];
  }

  beforeEach(() => {
    vi.stubEnv("JSONDB_API_KEY", "jdb_sk_test_abc");
    vi.stubEnv("JSONDB_PROJECT", "test-project");
    vi.stubEnv("JSONDB_BASE_URL", "https://api.jsondb.cloud");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // ── semantic_search ─────────────────────────────────────────────

  it("semantic_search returns success on happy path", async () => {
    const server = createMockServer();
    const db = createMockDb();
    const mockResults = {
      data: [
        { _id: "doc1", score: 0.95, title: "Hello world" },
        { _id: "doc2", score: 0.82, title: "Another doc" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResults),
    } as Response);

    registerVectorTools(server, db);
    const handler = getHandler(server, "semantic_search");
    const result = await handler({
      collection: "articles",
      query: "hello",
    });

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(mockResults);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(fetchCall[0]).toBe("https://api.jsondb.cloud/test-project/articles/_search");
    expect(fetchCall[1]?.method).toBe("POST");
    const body = JSON.parse(fetchCall[1]?.body as string);
    expect(body.query).toBe("hello");
  });

  it("semantic_search passes limit, threshold, and filter", async () => {
    const server = createMockServer();
    const db = createMockDb();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    } as Response);

    registerVectorTools(server, db);
    const handler = getHandler(server, "semantic_search");
    await handler({
      collection: "articles",
      query: "test",
      limit: 5,
      threshold: 0.8,
      filter: { status: "published" },
    });

    const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string);
    expect(body.limit).toBe(5);
    expect(body.threshold).toBe(0.8);
    expect(body.filter).toEqual({ status: "published" });
  });

  it("semantic_search returns COLLECTION_NOT_FOUND on 404", async () => {
    const server = createMockServer();
    const db = createMockDb();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => Promise.resolve({ error: "not found" }),
    } as Response);

    registerVectorTools(server, db);
    const handler = getHandler(server, "semantic_search");
    const result = await handler({
      collection: "nonexistent",
      query: "test",
    });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error.code).toBe("COLLECTION_NOT_FOUND");
  });

  it("semantic_search returns INVALID_SEARCH on 400", async () => {
    const server = createMockServer();
    const db = createMockDb();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () => Promise.resolve({ error: "invalid query" }),
    } as Response);

    registerVectorTools(server, db);
    const handler = getHandler(server, "semantic_search");
    const result = await handler({
      collection: "articles",
      query: "",
    });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error.code).toBe("INVALID_SEARCH");
  });

  it("semantic_search returns SEARCH_NOT_AVAILABLE on 403", async () => {
    const server = createMockServer();
    const db = createMockDb();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: () => Promise.resolve({ error: "plan limit" }),
    } as Response);

    registerVectorTools(server, db);
    const handler = getHandler(server, "semantic_search");
    const result = await handler({
      collection: "articles",
      query: "test",
    });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error.code).toBe("SEARCH_NOT_AVAILABLE");
  });

  // ── store_with_embedding ────────────────────────────────────────

  it("store_with_embedding calls POST and adds $embed field", async () => {
    const server = createMockServer();
    const db = createMockDb();
    const mockDoc = { _id: "new1", title: "Test", $createdAt: "2026-01-01" };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockDoc),
    } as Response);

    registerVectorTools(server, db);
    const handler = getHandler(server, "store_with_embedding");
    const result = await handler({
      collection: "articles",
      data: { title: "Test", body: "Hello world" },
      embed_field: "body",
    });

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(mockDoc);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(fetchCall[0]).toBe("https://api.jsondb.cloud/test-project/articles");
    expect(fetchCall[1]?.method).toBe("POST");
    const body = JSON.parse(fetchCall[1]?.body as string);
    expect(body.$embed).toBe("body");
    expect(body.title).toBe("Test");
    expect(body.body).toBe("Hello world");
  });

  it("store_with_embedding uses PUT when id is provided", async () => {
    const server = createMockServer();
    const db = createMockDb();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ _id: "custom-id", title: "Test" }),
    } as Response);

    registerVectorTools(server, db);
    const handler = getHandler(server, "store_with_embedding");
    await handler({
      collection: "articles",
      data: { title: "Test" },
      embed_field: "title",
      id: "custom-id",
    });

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(fetchCall[0]).toBe("https://api.jsondb.cloud/test-project/articles/custom-id");
    expect(fetchCall[1]?.method).toBe("PUT");
  });

  it("store_with_embedding returns VALIDATION_ERROR on 400", async () => {
    const server = createMockServer();
    const db = createMockDb();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () => Promise.resolve({ error: "invalid embed field" }),
    } as Response);

    registerVectorTools(server, db);
    const handler = getHandler(server, "store_with_embedding");
    const result = await handler({
      collection: "articles",
      data: { title: "Test" },
      embed_field: "missing_field",
    });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error.code).toBe("VALIDATION_ERROR");
  });

  it("store_with_embedding returns EMBEDDING_NOT_AVAILABLE on 403", async () => {
    const server = createMockServer();
    const db = createMockDb();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: () => Promise.resolve({ error: "not available" }),
    } as Response);

    registerVectorTools(server, db);
    const handler = getHandler(server, "store_with_embedding");
    const result = await handler({
      collection: "articles",
      data: { title: "Test" },
      embed_field: "title",
    });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error.code).toBe("EMBEDDING_NOT_AVAILABLE");
  });
});
