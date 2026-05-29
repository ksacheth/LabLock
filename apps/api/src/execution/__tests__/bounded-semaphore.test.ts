import { test, expect } from "bun:test";
import {
  createBoundedSemaphore,
  QueueOverflowError,
} from "../bounded-semaphore.ts";

// A task whose completion we control from the outside.
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

test("caps concurrency: never more than `concurrency` tasks run at once", async () => {
  const semaphore = createBoundedSemaphore({
    concurrency: 2,
    maxQueue: 10,
    queueTimeoutMs: 1000,
  });

  let running = 0;
  let peak = 0;
  const gates = Array.from({ length: 5 }, () => deferred());

  const runs = gates.map((gate, index) =>
    semaphore.run(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await gate.promise;
      running -= 1;
      return index;
    }),
  );

  // Let the first batch schedule, then release them one at a time.
  await Promise.resolve();
  expect(semaphore.activeCount).toBe(2);
  for (const gate of gates) {
    gate.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }

  const results = await Promise.all(runs);
  expect(results.sort()).toEqual([0, 1, 2, 3, 4]);
  expect(peak).toBe(2);
});

test("overflow beyond concurrency + maxQueue rejects with QueueOverflowError", async () => {
  const semaphore = createBoundedSemaphore({
    concurrency: 1,
    maxQueue: 1,
    queueTimeoutMs: 1000,
  });

  const active = deferred();
  const running = semaphore.run(() => active.promise); // occupies the one slot
  const queued = semaphore.run(async () => {}); // fills the one queue seat

  await Promise.resolve();
  // Third arrival has nowhere to go → immediate overflow, not a hang.
  await expect(semaphore.run(async () => {})).rejects.toBeInstanceOf(
    QueueOverflowError,
  );

  active.resolve();
  await running;
  await queued;
});

test("a queued task that waits past queueTimeoutMs rejects with QueueOverflowError", async () => {
  const semaphore = createBoundedSemaphore({
    concurrency: 1,
    maxQueue: 5,
    queueTimeoutMs: 20,
  });

  const active = deferred();
  const running = semaphore.run(() => active.promise);
  const queued = semaphore.run(async () => "never runs in time");

  await expect(queued).rejects.toBeInstanceOf(QueueOverflowError);

  active.resolve();
  await running;
});

test("rejects invalid options loudly", () => {
  expect(() =>
    createBoundedSemaphore({ concurrency: 0, maxQueue: 1, queueTimeoutMs: 1 }),
  ).toThrow();
  expect(() =>
    createBoundedSemaphore({ concurrency: 1, maxQueue: 1, queueTimeoutMs: 0 }),
  ).toThrow();
});
