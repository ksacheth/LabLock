// The Runner seam: the environment-specific compile + run lifecycle.
// A Runner is told WHAT to run, never WHAT is correct — output comparison
// stays in the Judge. Adapters: host (default), sandbox (future), fake (tests).
// See docs/adr/0001-execution-runner-seam.md.
import type { StudentProgrammingLanguage } from "../types.ts";

type RunnerSubmission = {
  code: string;
  language: StudentProgrammingLanguage;
};

type RunnerCaseInput = {
  id: string;
  input: string; // already formatted by the Judge
};

type RunnerLimits = {
  compileTimeoutMs: number;
  runTimeoutMs: number;
};

type RunnerCaseResult = {
  id: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
};

type RunnerResult = {
  // ok:false ⇒ cases is empty (compile failed, nothing ran)
  compile: { ok: boolean; timedOut: boolean; durationMs: number; stderr: string };
  cases: RunnerCaseResult[];
  // runner-level (infrastructure) failure: missing compiler, sandbox start
  // failure, etc. Distinct from a compile failure of the student's code.
  error: { kind: string; message: string } | null;
};

interface Runner {
  run(
    submission: RunnerSubmission,
    cases: RunnerCaseInput[],
    limits: RunnerLimits,
  ): Promise<RunnerResult>;
}

export type {
  Runner,
  RunnerSubmission,
  RunnerCaseInput,
  RunnerLimits,
  RunnerCaseResult,
  RunnerResult,
};
