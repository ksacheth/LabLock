import { test, expect } from "bun:test";
import { createMemoryStore } from "../memory-store.ts";

const state = (tokens: number) => ({
  tokens,
  lastRefill: new Date("2026-07-04T00:00:00.000Z"),
});

test("returns a stored bucket before it expires", () => {
  const store = createMemoryStore();
  const now = new Date("2026-07-04T00:00:00.000Z");
  const expiresAt = new Date("2026-07-04T00:01:00.000Z");

  store.set("run:user:s1", state(4), expiresAt);

  expect(store.get("run:user:s1", now)).toEqual(state(4));
});

test("evicts a fully-refilled (expired) bucket — get returns undefined", () => {
  const store = createMemoryStore();
  const expiresAt = new Date("2026-07-04T00:01:00.000Z");
  store.set("run:user:s1", state(4), expiresAt);

  // once the bucket would be full again, the entry carries no information.
  const later = new Date("2026-07-04T00:01:01.000Z");
  expect(store.get("run:user:s1", later)).toBeUndefined();
});

test("sweep removes expired entries", () => {
  const store = createMemoryStore();
  store.set("a", state(1), new Date("2026-07-04T00:01:00.000Z"));
  store.set("b", state(1), new Date("2026-07-04T00:05:00.000Z"));

  store.sweep(new Date("2026-07-04T00:02:00.000Z"));

  const after = new Date("2026-07-04T00:02:00.000Z");
  expect(store.get("a", after)).toBeUndefined();
  expect(store.get("b", after)).toEqual(state(1));
});
