// A bounded concurrency semaphore with a small overflow queue (ADR-0006).
//
// Each sandbox container reserves up to the platform memory ceiling, so
// unbounded concurrency lets the sandbox OOM the host it is meant to protect.
// This caps GLOBAL in-flight executions; when full, callers wait in a short
// bounded queue, and on overflow / excessive wait they get a QueueOverflowError
// which the adapter maps to SYSTEM_ERROR ("system busy → re-run me").
//
// This is COMPLEMENTARY to the rate limiter (ADR-0005), not redundant: the rate
// limiter caps a single user's request RATE; this caps the whole process's
// concurrent execution COUNT. A user under their rate limit can still arrive at
// the same instant as everyone else during an exam.
//
// Pure and Docker-free so it can be unit-tested by injecting a fake task fn.

class QueueOverflowError extends Error {
  constructor(message = "Sandbox execution queue is saturated.") {
    super(message);
    this.name = "QueueOverflowError";
  }
}

type BoundedSemaphoreOptions = {
  // Max executions running at once (≈ memory budget ÷ per-container ceiling).
  concurrency: number;
  // Max executions allowed to wait once concurrency is saturated.
  maxQueue: number;
  // How long a queued execution waits before giving up with QueueOverflowError.
  queueTimeoutMs: number;
};

type BoundedSemaphore = {
  // Runs `task` once a slot is free. Rejects with QueueOverflowError if the
  // queue is full or the wait exceeds queueTimeoutMs — never silently hangs.
  run<T>(task: () => Promise<T>): Promise<T>;
  readonly activeCount: number;
  readonly queuedCount: number;
};

function assertValidOptions({
  concurrency,
  maxQueue,
  queueTimeoutMs,
}: BoundedSemaphoreOptions): void {
  if (concurrency <= 0) {
    throw new Error(`Invalid semaphore concurrency ${concurrency} — must be > 0.`);
  }
  if (queueTimeoutMs <= 0) {
    throw new Error(
      `Invalid semaphore queueTimeoutMs ${queueTimeoutMs} — must be > 0.`,
    );
  }
  if (maxQueue < 0) {
    throw new Error(`Invalid semaphore maxQueue ${maxQueue} — must be >= 0.`);
  }
}

function createBoundedSemaphore(
  options: BoundedSemaphoreOptions,
): BoundedSemaphore {
  assertValidOptions(options);
  const { concurrency, maxQueue, queueTimeoutMs } = options;

  let active = 0;
  type Waiter = {
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  };
  const waiters: Waiter[] = [];

  function release(): void {
    const next = waiters.shift();
    if (next) {
      // Hand the just-freed slot straight to the next waiter — `active` stays
      // reserved, so it never dips and lets an extra task slip in.
      clearTimeout(next.timer);
      next.resolve();
      return;
    }
    active -= 1;
  }

  function acquire(): Promise<void> {
    if (active < concurrency) {
      active += 1;
      return Promise.resolve();
    }
    if (waiters.length >= maxQueue) {
      return Promise.reject(new QueueOverflowError());
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = waiters.findIndex((waiter) => waiter.timer === timer);
        if (index >= 0) {
          waiters.splice(index, 1);
        }
        reject(
          new QueueOverflowError(
            `Timed out after ${queueTimeoutMs}ms waiting for a sandbox slot.`,
          ),
        );
      }, queueTimeoutMs);
      waiters.push({ resolve, reject, timer });
    });
  }

  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
    get activeCount() {
      return active;
    },
    get queuedCount() {
      return waiters.length;
    },
  };
}

export { createBoundedSemaphore, QueueOverflowError };
export type { BoundedSemaphore, BoundedSemaphoreOptions };
