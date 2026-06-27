// In-memory Runner for testing the Judge without a toolchain.
// Returns a canned RunnerResult regardless of input; case ids in the canned
// result must line up with the cases handed to judge().
import type { Runner, RunnerResult } from "../runner.ts";

function createFakeRunner(result: RunnerResult): Runner {
  return {
    run: async () => result,
  };
}

export { createFakeRunner };
