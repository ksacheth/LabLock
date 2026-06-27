import { test, expect } from "bun:test";
import {
  outputsAreEquivalent,
  formatExecutionInputForCompetitiveProgramming,
} from "../judge.ts";

test("exact match is equivalent, ignoring trailing whitespace and CRLF", () => {
  expect(outputsAreEquivalent("42", "42")).toBe(true);
  expect(outputsAreEquivalent("42\n", "42")).toBe(true);
  expect(outputsAreEquivalent("42\r\n", "42\n")).toBe(true);
  expect(outputsAreEquivalent("42", "43")).toBe(false);
});

test("JSON objects are equivalent regardless of key order", () => {
  expect(outputsAreEquivalent('{"a":1,"b":2}', '{"b":2,"a":1}')).toBe(true);
  expect(
    outputsAreEquivalent('{"x":{"p":1,"q":2}}', '{"x":{"q":2,"p":1}}'),
  ).toBe(true);
  expect(outputsAreEquivalent('{"a":1,"b":2}', '{"a":1,"b":3}')).toBe(false);
});

test("array-style and space-separated outputs are token-equivalent", () => {
  expect(outputsAreEquivalent("1 2 3", "[1, 2, 3]")).toBe(true);
  expect(outputsAreEquivalent("[1,2,3]", "1 2 3")).toBe(true);
  expect(outputsAreEquivalent("1 2 4", "[1, 2, 3]")).toBe(false);
  // plain scalars that aren't array-style fall through to inequality
  expect(outputsAreEquivalent("hello", "world")).toBe(false);
});

test("array-style input lines expand to a count line plus space-joined values", () => {
  expect(formatExecutionInputForCompetitiveProgramming("[1, 2, 3]")).toBe(
    "3\n1 2 3",
  );
  // only the array line is expanded; other lines pass through
  expect(formatExecutionInputForCompetitiveProgramming("2\n[10, 20]")).toBe(
    "2\n2\n10 20",
  );
  // non-array input is unchanged (CRLF normalized)
  expect(formatExecutionInputForCompetitiveProgramming("hello\r\nworld")).toBe(
    "hello\nworld",
  );
});
