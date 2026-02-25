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
    const operators = [
      "neq",
      "gte",
      "lt",
      "lte",
      "contains",
      "in",
      "exists",
    ] as const;
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
