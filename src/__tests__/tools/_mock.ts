import { vi } from "vitest";

export function createMockServer() {
  return {
    tool: vi.fn(),
    resource: vi.fn(),
  } as any;
}

export function createMockDb() {
  return {
    collection: vi.fn(() => ({
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      jsonPatch: vi.fn(),
      getSchema: vi.fn(),
      setSchema: vi.fn(),
      removeSchema: vi.fn(),
      validate: vi.fn(),
    })),
  } as any;
}
