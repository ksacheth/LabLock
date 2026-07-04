import { test, expect } from "bun:test";
import type { Request, Response } from "express";
import { rateLimitRequest } from "../rate-limit-request.ts";
import { createMemoryStore, type RateLimitStore } from "../memory-store.ts";

// Minimal fakes: rateLimitRequest only touches req.userId and res
// setHeader/status/json.
function fakeReq(userId: string): Request {
  return { userId } as unknown as Request;
}

function fakeRes() {
  const headers: Record<string, unknown> = {};
  const captured: { status?: number; body?: unknown } = {};
  const res = {
    setHeader: (k: string, v: unknown) => {
      headers[k] = v;
    },
    status: (code: number) => {
      captured.status = code;
      return res;
    },
    json: (body: unknown) => {
      captured.body = body;
      return res;
    },
  };
  return { res: res as unknown as Response, headers, captured };
}

test("allows requests up to capacity, then denies with 429 + Retry-After", () => {
  const store = createMemoryStore();
  const req = fakeReq("s1");

  // run capacity is 10 — the first 10 in the same instant are allowed.
  for (let i = 0; i < 10; i++) {
    const { res } = fakeRes();
    expect(rateLimitRequest(req, res, "run", store)).toBe(true);
  }

  const { res, headers, captured } = fakeRes();
  expect(rateLimitRequest(req, res, "run", store)).toBe(false);
  expect(captured.status).toBe(429);
  expect(captured.body).toMatchObject({ code: "RATE_LIMITED" });
  expect(headers["Retry-After"]).toBeGreaterThan(0);
  expect(headers["RateLimit-Remaining"]).toBe(0);
});

test("different users have independent budgets", () => {
  const store = createMemoryStore();
  // drain s1 entirely
  for (let i = 0; i < 11; i++) {
    const { res } = fakeRes();
    rateLimitRequest(fakeReq("s1"), res, "run", store);
  }
  // s2 is untouched
  const { res } = fakeRes();
  expect(rateLimitRequest(fakeReq("s2"), res, "run", store)).toBe(true);
});

test("submit has a tighter budget (5) and its own key, independent of run", () => {
  const store = createMemoryStore();
  const req = fakeReq("s1");

  for (let i = 0; i < 5; i++) {
    const { res } = fakeRes();
    expect(rateLimitRequest(req, res, "submit", store)).toBe(true);
  }
  const { res, captured } = fakeRes();
  expect(rateLimitRequest(req, res, "submit", store)).toBe(false);
  expect(captured.status).toBe(429);

  // run budget for the same user is untouched (different policy + key).
  const { res: runRes } = fakeRes();
  expect(rateLimitRequest(req, runRes, "run", store)).toBe(true);
});

function fakeLoginReq(ip: string, email: string): Request {
  return { ip, body: { email } } as unknown as Request;
}

test("login denies after 5 failed attempts per IP+email, then 429", () => {
  const store = createMemoryStore();
  const req = fakeLoginReq("1.2.3.4", "victim@nitk.edu.in");

  for (let i = 0; i < 5; i++) {
    const { res } = fakeRes();
    expect(rateLimitRequest(req, res, "login", store)).toBe(true);
  }
  const { res, headers, captured } = fakeRes();
  expect(rateLimitRequest(req, res, "login", store)).toBe(false);
  expect(captured.status).toBe(429);
  expect(headers["Retry-After"]).toBeGreaterThan(0);
});

test("login budgets are independent per IP+email pair", () => {
  const store = createMemoryStore();
  // exhaust one pair
  for (let i = 0; i < 6; i++) {
    const { res } = fakeRes();
    rateLimitRequest(fakeLoginReq("1.2.3.4", "a@x.edu"), res, "login", store);
  }
  // a different email from the same IP is unaffected
  const { res } = fakeRes();
  expect(
    rateLimitRequest(fakeLoginReq("1.2.3.4", "b@x.edu"), res, "login", store),
  ).toBe(true);
});

test("fails open (allows) when the store throws", () => {
  const brokenStore: RateLimitStore = {
    get() {
      throw new Error("store down");
    },
    set() {},
    sweep() {},
  };
  const { res, captured } = fakeRes();

  expect(rateLimitRequest(fakeReq("s1"), res, "run", brokenStore)).toBe(true);
  // never blocks a student because the limiter itself failed.
  expect(captured.status).toBeUndefined();
});
