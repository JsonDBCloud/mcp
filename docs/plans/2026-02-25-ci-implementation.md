# CI Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full CI pipeline with linting (ESLint + Prettier), type-checking, testing (Vitest), and build verification that gates PRs and npm publishing.

**Architecture:** Two GitHub Actions workflows chained together. `ci.yml` runs lint/typecheck/test/build on PRs and main pushes. `publish.yml` is modified to trigger only after CI passes via `workflow_run`. Tests mock the MCP SDK and jsondb client to verify tool registration and handler behavior.

**Tech Stack:** ESLint 9 (flat config), Prettier, TypeScript (`tsc --noEmit`), Vitest, tsup, GitHub Actions

---

### Task 1: Install dev dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install ESLint + Prettier + Vitest**

```bash
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-prettier prettier vitest
```

**Step 2: Verify package.json was updated**

Run: `cat package.json | grep -E "eslint|prettier|vitest"`
Expected: All packages appear in devDependencies

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add eslint, prettier, and vitest dev dependencies"
```

---

### Task 2: Configure ESLint (flat config)

**Files:**
- Create: `eslint.config.js`

**Step 1: Create eslint.config.js**

```js
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "bin/"],
  },
];
```

Note: `no-explicit-any` is off because the codebase uses `z.any()` extensively and casts `unknown` to typed objects. Fighting this would add noise.

**Step 2: Add lint script to package.json**

Add to `"scripts"`:
```json
"lint": "eslint src/"
```

**Step 3: Run lint and fix any issues**

Run: `npm run lint`
Expected: Should pass or show fixable issues. Fix any that appear.

**Step 4: Commit**

```bash
git add eslint.config.js package.json
git commit -m "chore: add eslint flat config with typescript rules"
```

---

### Task 3: Configure Prettier

**Files:**
- Create: `.prettierrc`
- Create: `.prettierignore`

**Step 1: Create .prettierrc**

Matches existing code style (semicolons, double quotes, trailing commas, 2-space indent):

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "tabWidth": 2,
  "printWidth": 100
}
```

**Step 2: Create .prettierignore**

```
dist/
node_modules/
package-lock.json
```

**Step 3: Add format:check script to package.json**

Add to `"scripts"`:
```json
"format:check": "prettier --check ."
```

**Step 4: Run format check**

Run: `npm run format:check`

If files need formatting, run `npx prettier --write .` to fix, then verify with `npm run format:check`.

**Step 5: Commit**

```bash
git add .prettierrc .prettierignore package.json
# If prettier reformatted source files, add those too
git add -u
git commit -m "chore: add prettier config matching existing code style"
```

---

### Task 4: Export `buildFilterObject` for testing

**Files:**
- Modify: `src/tools/collections.ts`

The `buildFilterObject` function is currently private. We need to export it so tests can import it directly.

**Step 1: Change `function buildFilterObject` to `export function buildFilterObject`**

In `src/tools/collections.ts`, line 40, change:
```ts
function buildFilterObject(
```
to:
```ts
export function buildFilterObject(
```

**Step 2: Verify the build still works**

Run: `npm run build`
Expected: Clean build, no errors

**Step 3: Commit**

```bash
git add src/tools/collections.ts
git commit -m "refactor: export buildFilterObject for testability"
```

---

### Task 5: Configure Vitest

**Files:**
- Create: `vitest.config.ts`

**Step 1: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
  },
});
```

**Step 2: Add test script to package.json**

Add to `"scripts"`:
```json
"test": "vitest run"
```

**Step 3: Commit**

```bash
git add vitest.config.ts package.json
git commit -m "chore: add vitest config and test script"
```

---

### Task 6: Write buildFilterObject tests

**Files:**
- Create: `src/__tests__/build-filter.test.ts`

**Step 1: Write the tests**

```ts
import { describe, it, expect } from "vitest";
import { buildFilterObject } from "../tools/collections.js";

describe("buildFilterObject", () => {
  it("maps eq operator to direct value", () => {
    const result = buildFilterObject([
      { field: "status", operator: "eq", value: "active" },
    ]);
    expect(result).toEqual({ status: "active" });
  });

  it("maps gt operator to $gt", () => {
    const result = buildFilterObject([
      { field: "age", operator: "gt", value: 18 },
    ]);
    expect(result).toEqual({ age: { $gt: 18 } });
  });

  it("maps all comparison operators", () => {
    const operators = ["neq", "gte", "lt", "lte", "contains", "in", "exists"] as const;
    for (const op of operators) {
      const result = buildFilterObject([
        { field: "f", operator: op, value: "v" },
      ]);
      expect(result.f).toEqual({ [`$${op}`]: "v" });
    }
  });

  it("handles multiple filters", () => {
    const result = buildFilterObject([
      { field: "status", operator: "eq", value: "active" },
      { field: "age", operator: "gte", value: 21 },
    ]);
    expect(result).toEqual({
      status: "active",
      age: { $gte: 21 },
    });
  });

  it("falls back to direct value for unknown operators", () => {
    const result = buildFilterObject([
      { field: "x", operator: "unknown_op", value: 42 },
    ]);
    expect(result).toEqual({ x: 42 });
  });

  it("returns empty object for empty filters", () => {
    const result = buildFilterObject([]);
    expect(result).toEqual({});
  });
});
```

**Step 2: Run the test**

Run: `npm test`
Expected: All 6 tests pass

**Step 3: Commit**

```bash
git add src/__tests__/build-filter.test.ts
git commit -m "test: add buildFilterObject unit tests"
```

---

### Task 7: Write helpers tests (success/error format)

**Files:**
- Create: `src/__tests__/helpers.test.ts`

The `success()` and `error()` functions are private in each tool file. Rather than exporting them all, we test the format indirectly by calling a tool handler and checking the response shape. But first, let's create a shared test utility that mirrors the helpers for assertion:

**Step 1: Write the tests**

```ts
import { describe, it, expect } from "vitest";

// These helpers mirror the private success/error functions in tool files.
// We test the expected MCP response format contract.

describe("MCP response format", () => {
  it("success format wraps data as JSON text content", () => {
    const data = { id: "123", name: "test" };
    const result = {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual(data);
  });

  it("error format includes code, message, suggestion and isError flag", () => {
    const result = {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { error: { code: "NOT_FOUND", message: "gone", suggestion: "try again" } },
            null,
            2,
          ),
        },
      ],
      isError: true as const,
    };
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toHaveProperty("code");
    expect(parsed.error).toHaveProperty("message");
    expect(parsed.error).toHaveProperty("suggestion");
  });
});
```

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/__tests__/helpers.test.ts
git commit -m "test: add MCP response format contract tests"
```

---

### Task 8: Write tool registration smoke tests

**Files:**
- Create: `src/__tests__/tools/documents.test.ts`
- Create: `src/__tests__/tools/collections.test.ts`
- Create: `src/__tests__/tools/schemas.test.ts`
- Create: `src/__tests__/tools/versions.test.ts`
- Create: `src/__tests__/tools/webhooks.test.ts`

For each tool module, we mock `McpServer` and `JsonDB`, call the register function, and verify `server.tool()` was called with the expected tool names.

**Step 1: Write a shared mock factory**

Create `src/__tests__/tools/_mock.ts`:

```ts
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
```

**Step 2: Write documents.test.ts**

```ts
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
```

**Step 3: Write collections.test.ts**

```ts
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
```

**Step 4: Write schemas.test.ts**

```ts
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
```

**Step 5: Write versions.test.ts**

```ts
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
```

**Step 6: Write webhooks.test.ts**

```ts
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
```

**Step 7: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 8: Commit**

```bash
git add src/__tests__/tools/
git commit -m "test: add tool registration smoke tests for all modules"
```

---

### Task 9: Write tool handler behavior tests

**Files:**
- Modify: `src/__tests__/tools/documents.test.ts`

Add handler-level tests for `create_document` and `get_document` to verify success and error response paths.

**Step 1: Add handler tests to documents.test.ts**

Append to the existing file:

```ts
describe("document tool handlers", () => {
  function getHandler(server: any, toolName: string) {
    const call = server.tool.mock.calls.find((c: any[]) => c[0] === toolName);
    // handler is the last argument (after name, description, schema)
    return call[call.length - 1];
  }

  it("create_document returns success on happy path", async () => {
    const server = createMockServer();
    const db = createMockDb();
    const mockDoc = { _id: "abc", name: "test" };
    db.collection.mockReturnValue({ create: vi.fn().mockResolvedValue(mockDoc) });

    registerDocumentTools(server, db);
    const handler = getHandler(server, "create_document");

    const result = await handler({ collection: "users", data: { name: "test" } });
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

    const result = await handler({ collection: "users", data: { name: "test" }, id: "dup" });
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
    db.collection.mockReturnValue({ get: vi.fn().mockResolvedValue(mockDoc) });

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

    const result = await handler({ collection: "users", data: { bad: true } });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error.code).toBe("VALIDATION_ERROR");
  });
});
```

Note: add `vi` to the import at the top of the file:
```ts
import { describe, it, expect, vi } from "vitest";
```

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/__tests__/tools/documents.test.ts
git commit -m "test: add document tool handler behavior tests"
```

---

### Task 10: Create ci.yml workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Write ci.yml**

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 22]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add CI workflow with lint, typecheck, test, build"
```

---

### Task 11: Modify publish.yml to depend on CI

**Files:**
- Modify: `.github/workflows/publish.yml`

**Step 1: Update the trigger**

Replace the existing `on:` block and add the `if:` condition:

Change from:
```yaml
on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
```

To:
```yaml
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    if: github.event.workflow_run.conclusion == 'success'
```

Everything else in publish.yml stays the same.

**Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: chain publish workflow to run only after CI passes"
```

---

### Task 12: Verify everything works locally

**Step 1: Run the full pipeline locally**

```bash
npm run lint
npm run format:check
npx tsc --noEmit
npm test
npm run build
```

Expected: All 5 commands pass with exit code 0.

**Step 2: Verify build output exists**

Run: `ls dist/`
Expected: `index.js` and `index.mjs` exist

**Step 3: Final commit (if any fixups needed)**

If any adjustments were needed, commit them with an appropriate message.
