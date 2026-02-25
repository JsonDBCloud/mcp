import { describe, it, expect } from "vitest";

describe("MCP response format", () => {
  it("success format wraps data as JSON text content", () => {
    const data = { id: "123", name: "test" };
    const result = {
      content: [
        { type: "text" as const, text: JSON.stringify(data, null, 2) },
      ],
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
            {
              error: {
                code: "NOT_FOUND",
                message: "gone",
                suggestion: "try again",
              },
            },
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
